"""Bulk waste pickup requests."""
from __future__ import annotations

import math

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.pickup import PickupRequest
from app.models.user import User, Worker
from app.schemas.ops import PickupCreate, PickupStatusUpdate
from app.schemas.serializers import pickup_dict
from app.services import pickup_service as svc
from app.services.storage import FileValidationError, store_upload

router = APIRouter(prefix="/pickup-requests", tags=["pickup-requests"])


def _get(db: Session, ref: str) -> PickupRequest:
    query = db.query(PickupRequest).options(joinedload(PickupRequest.user))
    row = (
        query.filter(PickupRequest.pickup_id == ref).first()
        or (query.filter(PickupRequest.id == int(ref)).first() if ref.isdigit() else None)
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"Pickup {ref} not found.")
    return row


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_pickup(
    waste_type: str = Form(...),
    quantity: float = Form(...),
    address: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    unit: str = Form(default="kg"),
    preferred_date: str | None = Form(default=None),
    preferred_time: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
    user: User = Depends(require_roles(UserRole.CITIZEN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    photo_url = None
    if photo is not None and photo.filename:
        try:
            photo_url = store_upload(photo, "pickups").url
        except FileValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    parsed_date = None
    if preferred_date:
        from datetime import date

        try:
            parsed_date = date.fromisoformat(preferred_date)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="preferred_date must be YYYY-MM-DD") from exc

    pickup = svc.create_pickup(
        db,
        user=user,
        waste_type=waste_type,
        quantity=quantity,
        unit=unit,
        address=address,
        latitude=latitude,
        longitude=longitude,
        preferred_date=parsed_date,
        preferred_time=preferred_time,
        notes=notes,
        photo_url=photo_url,
    )
    db.commit()
    db.refresh(pickup)
    return {"pickup": pickup_dict(pickup), "message": f"Pickup request {pickup.pickup_id} created."}


@router.get("")
def list_pickups(
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(PickupRequest).options(
        joinedload(PickupRequest.user), joinedload(PickupRequest.assigned_worker)
    )
    if user.role == UserRole.CITIZEN.value:
        query = query.filter(PickupRequest.user_id == user.id)
    elif user.role == UserRole.WORKER.value:
        worker = db.query(Worker).filter(Worker.user_id == user.id).first()
        if worker is None:
            return {"items": [], "total": 0, "page": 1, "page_size": page_size, "pages": 0}
        query = query.filter(
            (PickupRequest.assigned_worker_id == worker.id)
            | (PickupRequest.assigned_worker_id.is_(None))
        )
    if status_filter:
        query = query.filter(PickupRequest.status == status_filter.upper())

    total = query.count()
    rows = (
        query.order_by(PickupRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [pickup_dict(p) for p in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }


@router.get("/{pickup_ref}")
def get_pickup(
    pickup_ref: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    pickup = _get(db, pickup_ref)
    if user.role == UserRole.CITIZEN.value and pickup.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only access your own pickup requests.")
    return {"pickup": pickup_dict(pickup)}


@router.post("/{pickup_ref}/assign")
def assign_pickup(
    pickup_ref: str,
    worker_id: int = Form(...),
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    pickup = _get(db, pickup_ref)
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found.")
    svc.assign_pickup(db, pickup, worker, actor_id=user.id)
    db.commit()
    db.refresh(pickup)
    return {"pickup": pickup_dict(pickup)}


@router.post("/{pickup_ref}/status")
def update_pickup_status(
    pickup_ref: str,
    payload: PickupStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    pickup = _get(db, pickup_ref)
    if user.role == UserRole.CITIZEN.value:
        if payload.status.upper() != "CANCELLED" or pickup.user_id != user.id:
            raise HTTPException(status_code=403, detail="You can only cancel your own request.")
    svc.transition_pickup(db, pickup, payload.status.upper(), actor=user, note=payload.note)
    db.commit()
    db.refresh(pickup)
    return {"pickup": pickup_dict(pickup)}


@router.get("/summary/overview")
def pickup_summary(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    query = db.query(PickupRequest)
    if user.role == UserRole.CITIZEN.value:
        query = query.filter(PickupRequest.user_id == user.id)
    rows = query.all()
    return {
        "total": len(rows),
        "pending": sum(1 for p in rows if p.status in {"REQUESTED", "ASSIGNED", "ON_THE_WAY"}),
        "completed": sum(1 for p in rows if p.status == "COMPLETED"),
        "eco_points_awarded": sum(p.eco_points_awarded for p in rows),
    }
