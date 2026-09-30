"""Waste awareness content + 'Ask Waste AI'."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_optional_user, require_roles
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.misc import AwarenessContent
from app.models.user import User
from app.schemas.ops import AwarenessAsk, AwarenessOut, AwarenessUpdate
from app.services.ai_service import ai_service
from app.services.gamification import AWARDS, award_points

router = APIRouter(prefix="/awareness", tags=["awareness"])


@router.get("", response_model=list[AwarenessOut])
def list_content(
    category: str | None = None,
    admin: bool = False,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> list[AwarenessOut]:
    """Published guidance is public; the `admin=true` listing requires an ADMIN token."""
    if admin:
        if user is None or user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin access required.")
        query = db.query(AwarenessContent)
    else:
        query = db.query(AwarenessContent).filter(AwarenessContent.is_published.is_(True))
    if category:
        query = query.filter(AwarenessContent.category == category)
    return query.order_by(AwarenessContent.category, AwarenessContent.title).all()


@router.post("", response_model=AwarenessOut, status_code=201)
def create_content(
    payload: AwarenessUpdate,
    slug: str = Query(min_length=3, max_length=64),
    category: str = Query(min_length=2, max_length=48),
    summary: str = Query(min_length=4, max_length=400),
    what_it_is: str = Query(min_length=4),
    which_bin: str = Query(min_length=2, max_length=80),
    how_to_dispose: str = Query(min_length=4),
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AwarenessOut:
    if db.query(AwarenessContent).filter(AwarenessContent.slug == slug).first():
        raise HTTPException(status_code=409, detail="A content item with this slug exists.")
    row = AwarenessContent(
        slug=slug,
        title=payload.title or slug.replace("-", " ").title(),
        category=category,
        summary=summary,
        what_it_is=what_it_is,
        which_bin=which_bin,
        how_to_dispose=how_to_dispose,
        recyclable=payload.recyclable or False,
        hazard_level=payload.hazard_level or "LOW",
        accent=payload.accent or "emerald",
        do_list=payload.do_list or [],
        dont_list=payload.dont_list or [],
        is_published=payload.is_published if payload.is_published is not None else True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{content_id}", response_model=AwarenessOut)
def update_content(
    content_id: int,
    payload: AwarenessUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AwarenessOut:
    row = db.get(AwarenessContent, content_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Awareness content not found.")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.post("/ask")
def ask_waste_ai(
    payload: AwarenessAsk,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    answer = ai_service.generate_awareness_answer(payload.question)
    award_points(
        db,
        user_id=user.id,
        points=AWARDS["AWARENESS_ASKED"],
        reason="Asked Waste AI a disposal question",
    )
    db.commit()
    return {
        "question": payload.question,
        "answer": answer.answer,
        "category": answer.category,
        "bin_colour": answer.bin_colour,
        "recyclable": answer.recyclable,
        "steps": answer.steps,
        "hazard_note": answer.hazard_note,
        "provider": answer.provider,
        "ai_status": ai_service.status(),
        "suggested_questions": [
            "Where should I dispose of a used battery?",
            "How do I dispose of a broken phone?",
            "Where does vegetable waste go?",
            "Can I recycle a plastic milk bottle?",
            "What should I do with a hospital sharps container?",
        ],
    }
