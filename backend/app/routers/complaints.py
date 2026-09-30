"""Complaint lifecycle API - the heart of SmartWaste 360.

Access rules:
  * CITIZEN  -> only their own complaints (create, view, track)
  * WORKER   -> only complaints assigned to them (status + proof)
  * ADMIN    -> everything (review, assign, merge, verify, resolve)
"""
from __future__ import annotations

import math

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.database.session import get_db
from app.models.complaint import Complaint
from app.models.enums import ComplaintStatus, EvidenceType, OPEN_STATUSES, UserRole
from app.models.user import User, Worker
from app.schemas.complaint import (
    AssignRequest,
    ComplaintCreate,
    ComplaintListResponse,
    ComplaintOut,
    ComplaintUpdate,
    EvidenceIn,
    MergeRequest,
    StatusRequest,
)
from app.schemas.serializers import complaint_dict
from app.services import complaint_service as svc
from app.services.ai_service import ai_service
from app.services.gamification import AWARDS
from app.services.storage import FileValidationError, store_upload

router = APIRouter(prefix="/complaints", tags=["complaints"])


def _get_complaint_or_404(db: Session, complaint_ref: str) -> Complaint:
    query = db.query(Complaint).options(
        joinedload(Complaint.user),
        joinedload(Complaint.assigned_worker).joinedload(Worker.user),
        joinedload(Complaint.evidence),
        joinedload(Complaint.assignment),
    )
    complaint = (
        query.filter(Complaint.complaint_id == complaint_ref).first()
        or query.filter(Complaint.id == complaint_ref if complaint_ref.isdigit() else -1).first()
    )
    if complaint is None:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_ref} not found.")
    return complaint


def _authorise(db: Session, complaint: Complaint, user: User) -> None:
    if user.role == UserRole.ADMIN.value:
        return
    if user.role == UserRole.WORKER.value:
        worker = db.query(Worker).filter(Worker.user_id == user.id).first()
        if worker is None or complaint.assigned_worker_id != worker.id:
            raise HTTPException(status_code=403, detail="This task is not assigned to you.")
        return
    if complaint.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only access your own complaints.")


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    category: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    address: str = Form(...),
    description: str | None = Form(default=None),
    ward: str | None = Form(default=None),
    run_ai: bool = Form(default=True),
    image: UploadFile | None = File(default=None),
    user: User = Depends(require_roles(UserRole.CITIZEN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    image_url = None
    image_bytes = None
    image_filename = None
    if image is not None and image.filename:
        try:
            stored = store_upload(image, "complaints")
        except FileValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        image_url = stored.url
        image_bytes = image.file.read()
        image.filename = stored.filename
        image_filename = stored.filename

    complaint = svc.create_complaint(
        db,
        user=user,
        category=category.upper().strip(),
        description=description,
        image_url=image_url,
        image_bytes=image_bytes,
        image_filename=image_filename,
        latitude=latitude,
        longitude=longitude,
        address=address,
        ward=ward,
        analyze=run_ai,
    )
    db.commit()
    db.refresh(complaint)
    return {
        "complaint": complaint_dict(_get_complaint_or_404(db, complaint.complaint_id)),
        "message": f"Report {complaint.complaint_id} created and analysed.",
    }


@router.post("/preview-analysis")
async def preview_analysis(
    category: str = Form(...),
    description: str | None = Form(default=None),
    address: str | None = Form(default=None),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Runs AI + priority analysis on an image *before* the report is saved.

    Powers step 2 of the citizen wizard (instant feedback) and step 5.
    """
    image_bytes = image.file.read() if image is not None and image.filename else None
    if image is not None and image.filename and not image_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    category = category.upper().strip()
    analysis = ai_service.analyze_waste_image(
        image_bytes=image_bytes,
        filename=image.filename if image else None,
        category=category,
        description=description,
        context={"address": address},
    )
    neighbours = []
    if latitude is not None and longitude is not None:
        from app.services.hotspots import nearby_open_complaints

        neighbours = nearby_open_complaints(db, latitude, longitude)
    severity_block = ai_service.estimate_severity(
        category=category,
        analysis=analysis.to_dict(),
        address=address,
        nearby_reports=len(neighbours),
    )

    from app.models.user import utcnow
    from app.services.priority_engine import compute_priority

    priority = compute_priority(
        severity=severity_block["severity"],
        created_at=utcnow(),
        latitude=latitude if latitude is not None else 26.4499,
        longitude=longitude if longitude is not None else 80.3319,
        address=address or "Kanpur",
        ward=None,
        waste_type=analysis.waste_type,
        neighbours=neighbours,
    )

    duplicate_of = None
    if latitude is not None and longitude is not None:
        from app.services.duplicates import find_duplicate_for

        match = find_duplicate_for(
            db.query(Complaint).filter(Complaint.status.in_(OPEN_STATUSES)).all(),
            category=category,
            latitude=latitude,
            longitude=longitude,
            description=description,
        )
        if match:
            duplicate_of = match

    return {
        "analysis": analysis.to_dict(),
        "severity_reasoning": severity_block,
        "priority": priority.to_dict(),
        "duplicate_of": duplicate_of,
        "nearby_reports": len(neighbours),
        "ai_status": ai_service.status(),
    }


@router.get("", response_model=ComplaintListResponse)
def list_complaints(
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = None,
    priority: str | None = None,
    ward: str | None = None,
    worker_id: int | None = None,
    search: str | None = None,
    open_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ComplaintListResponse:
    query = db.query(Complaint).options(
        joinedload(Complaint.user),
        joinedload(Complaint.assigned_worker).joinedload(Worker.user),
        joinedload(Complaint.evidence),
    )

    if user.role == UserRole.CITIZEN.value:
        query = query.filter(Complaint.user_id == user.id)
    elif user.role == UserRole.WORKER.value:
        worker = db.query(Worker).filter(Worker.user_id == user.id).first()
        if worker is None:
            return ComplaintListResponse(items=[], total=0, page=1, page_size=page_size, pages=0)
        query = query.filter(Complaint.assigned_worker_id == worker.id)

    if status_filter:
        query = query.filter(Complaint.status == status_filter.upper())
    if open_only:
        query = query.filter(Complaint.status.in_(OPEN_STATUSES))
    if category:
        query = query.filter(Complaint.category == category.upper())
    if priority:
        query = query.filter(Complaint.priority_level == priority.upper())
    if ward:
        query = query.filter(Complaint.ward == ward)
    if worker_id:
        query = query.filter(Complaint.assigned_worker_id == worker_id)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter(
            (Complaint.complaint_id.ilike(like))
            | (Complaint.address.ilike(like))
            | (Complaint.description.ilike(like))
            | (Complaint.issue_type.ilike(like))
        )

    total = query.count()
    order = Complaint.priority_score.desc(), Complaint.created_at.desc()
    rows = query.order_by(*order).offset((page - 1) * page_size).limit(page_size).all()

    return ComplaintListResponse(
        items=[ComplaintOut.model_validate(complaint_dict(c)) for c in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/{complaint_ref}", response_model=dict)
def get_complaint(
    complaint_ref: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    complaint = _get_complaint_or_404(db, complaint_ref)
    _authorise(db, complaint, user)
    return {"complaint": complaint_dict(complaint)}


@router.patch("/{complaint_ref}", response_model=dict)
def update_complaint(
    complaint_ref: str,
    payload: ComplaintUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    complaint = _get_complaint_or_404(db, complaint_ref)
    _authorise(db, complaint, user)
    data = payload.model_dump(exclude_none=True)

    if "status" in data:
        if user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Only admins can change complaint status.")
        svc.admin_set_status(db, complaint, data.pop("status"), actor_id=user.id)

    for field in ("category", "description", "address", "ward", "latitude", "longitude", "admin_note"):
        if field in data:
            setattr(complaint, field, data[field])

    if {"category", "description", "address", "latitude", "longitude"} & set(data):
        svc.run_ai_analysis(db, complaint, actor_id=user.id)

    db.commit()
    db.refresh(complaint)
    return {"complaint": complaint_dict(_get_complaint_or_404(db, complaint.complaint_id))}


@router.post("/{complaint_ref}/analyze", response_model=dict)
def analyze_complaint(
    complaint_ref: str,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CITIZEN)),
    db: Session = Depends(get_db),
) -> dict:
    complaint = _get_complaint_or_404(db, complaint_ref)
    _authorise(db, complaint, user)
    svc.run_ai_analysis(db, complaint, actor_id=user.id)
    db.commit()
    db.refresh(complaint)
    return {
        "complaint": complaint_dict(complaint),
        "message": f"AI analysis refreshed with {ai_service.status()['provider']} provider.",
    }


@router.post("/{complaint_ref}/assign", response_model=dict)
def assign_complaint(
    complaint_ref: str,
    payload: AssignRequest,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    complaint = _get_complaint_or_404(db, complaint_ref)
    worker = db.query(Worker).filter(Worker.id == payload.worker_id).first()
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found.")
    svc.assign_worker(db, complaint, worker, actor_id=user.id)
    db.commit()
    db.refresh(complaint)
    return {
        "complaint": complaint_dict(_get_complaint_or_404(db, complaint.complaint_id)),
        "message": f"Assigned to {worker.user.name if worker.user else worker.employee_code}.",
    }


@router.get("/{complaint_ref}/suggest-workers", response_model=dict)
def suggest(
    complaint_ref: str,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    complaint = _get_complaint_or_404(db, complaint_ref)
    return {"suggestions": svc.suggest_workers(db, complaint)}


@router.post("/{complaint_ref}/status", response_model=dict)
def set_status(
    complaint_ref: str,
    payload: StatusRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Admin override, or a worker's own next step on an assigned task."""
    complaint = _get_complaint_or_404(db, complaint_ref)
    _authorise(db, complaint, user)
    target = payload.status.upper()

    if user.role == UserRole.ADMIN.value:
        svc.admin_set_status(db, complaint, target, actor_id=user.id, note=payload.note)
    else:
        worker = db.query(Worker).filter(Worker.user_id == user.id).first()
        if worker is None:
            raise HTTPException(status_code=403, detail="Worker profile missing.")
        svc.worker_transition(db, complaint, worker, target)
    db.commit()
    db.refresh(complaint)
    return {"complaint": complaint_dict(_get_complaint_or_404(db, complaint.complaint_id))}


@router.post("/{complaint_ref}/evidence", response_model=dict)
def add_evidence(
    complaint_ref: str,
    payload: EvidenceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    complaint = _get_complaint_or_404(db, complaint_ref)
    _authorise(db, complaint, user)
    svc.add_evidence(
        db,
        complaint,
        evidence_type=payload.evidence_type,
        url=payload.file_url,
        uploaded_by_id=user.id,
        note=payload.note,
    )
    db.commit()
    db.refresh(complaint)
    return {"complaint": complaint_dict(complaint)}


@router.post("/{complaint_ref}/proof", response_model=dict)
async def upload_proof(
    complaint_ref: str,
    before_image: UploadFile = File(...),
    after_image: UploadFile = File(...),
    note: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Worker uploads before/after proof -> verification -> auto resolve."""
    complaint = _get_complaint_or_404(db, complaint_ref)
    _authorise(db, complaint, user)
    worker = db.query(Worker).filter(Worker.user_id == user.id).first()

    try:
        before = store_upload(before_image, "proof/before")
        after = store_upload(after_image, "proof/after")
    except FileValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = svc.finalize_with_evidence(
        db,
        complaint,
        before_url=before.url,
        after_url=after.url,
        before_bytes=before_image.file.read(),
        after_bytes=after_image.file.read(),
        before_filename=before.filename,
        after_filename=after.filename,
        worker=worker,
        note=note,
    )
    db.commit()
    db.refresh(complaint)
    return {
        "complaint": complaint_dict(_get_complaint_or_404(db, complaint.complaint_id)),
        "verification": result,
        "message": f"Proof uploaded. Verification status: {result['status']}.",
    }


@router.post("/{complaint_ref}/verify", response_model=dict)
def admin_verify(
    complaint_ref: str,
    payload: StatusRequest,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    """Admin accepts or rejects worker proof and closes the complaint."""
    complaint = _get_complaint_or_404(db, complaint_ref)
    if not complaint.after_cleanliness:
        raise HTTPException(status_code=400, detail="No before/after evidence uploaded yet.")
    if payload.status.upper() in {"VERIFIED", "RESOLVED"}:
        svc.admin_set_status(
            db, complaint, ComplaintStatus.VERIFIED.value, actor_id=user.id, note=payload.note
        )
        svc.admin_set_status(
            db, complaint, ComplaintStatus.RESOLVED.value, actor_id=user.id, note=payload.note
        )
        from app.services import gamification

        gamification.award_points(
            db,
            user_id=complaint.user_id,
            points=AWARDS["REPORT_VERIFIED"],
            reason=f"Admin verified {complaint.complaint_id}",
            complaint_id=complaint.id,
        )
    else:
        svc.admin_set_status(
            db, complaint, ComplaintStatus.REJECTED.value, actor_id=user.id, note=payload.note
        )
    db.commit()
    db.refresh(complaint)
    return {"complaint": complaint_dict(_get_complaint_or_404(db, complaint.complaint_id))}


@router.post("/merge", response_model=dict)
def merge_duplicates(
    payload: MergeRequest,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    primary = _get_complaint_or_404(db, payload.primary_complaint_id)
    duplicates = [_get_complaint_or_404(db, ref) for ref in payload.duplicate_complaint_ids]
    svc.merge_duplicate(db, primary, duplicates, actor_id=user.id)
    db.commit()
    db.refresh(primary)
    return {
        "complaint": complaint_dict(_get_complaint_or_404(db, primary.complaint_id)),
        "merged": len(duplicates),
    }
