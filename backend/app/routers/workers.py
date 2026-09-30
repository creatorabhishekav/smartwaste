"""Worker directory, worker self-service task queue, and status updates."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.database.session import get_db
from app.models.complaint import Complaint
from app.models.enums import OPEN_STATUSES, UserRole
from app.models.pickup import PickupRequest
from app.models.user import User, Worker, utcnow
from app.schemas.auth import WorkerOut
from app.schemas.complaint import WorkerStatusRequest
from app.schemas.serializers import complaint_dict, pickup_dict, worker_dict
from app.services.geo import haversine_km

router = APIRouter(prefix="/workers", tags=["workers"])

WORKER_ORIGIN = (26.4499, 80.3319)


def _require_worker(db: Session, user: User) -> Worker:
    worker = db.query(Worker).filter(Worker.user_id == user.id).first()
    if worker is None:
        raise HTTPException(status_code=404, detail="No worker profile linked to this account.")
    return worker


@router.get("")
def list_workers(
    status_filter: str | None = Query(default=None, alias="status"),
    ward: str | None = None,
    available_only: bool = False,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> list[WorkerOut]:
    query = db.query(Worker).options(joinedload(Worker.user))
    if status_filter:
        query = query.filter(Worker.status == status_filter.upper())
    if ward:
        query = query.filter(Worker.ward == ward)
    if available_only:
        query = query.filter(Worker.status.in_(["AVAILABLE", "BUSY"]))
    rows = query.order_by(Worker.total_completed.desc()).all()
    return [WorkerOut.model_validate(worker_dict(w)) for w in rows]


@router.get("/me")
def me(user: User = Depends(require_roles(UserRole.WORKER)), db: Session = Depends(get_db)) -> dict:
    worker = _require_worker(db, user)
    return {"worker": worker_dict(worker)}


@router.patch("/{worker_id}")
def update_worker(
    worker_id: int,
    payload: WorkerStatusRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Workers can update their own availability; admins can update anyone."""
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found.")
    if user.role == UserRole.WORKER.value and worker.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only update your own availability.")
    if user.role == UserRole.CITIZEN.value:
        raise HTTPException(status_code=403, detail="Not permitted.")
    if payload.status is None and payload.latitude is None and payload.longitude is None:
        raise HTTPException(status_code=422, detail="Provide a status, a location, or both.")
    if payload.status:
        worker.status = payload.status.upper()
    if payload.latitude is not None and payload.longitude is not None:
        worker.current_latitude = payload.latitude
        worker.current_longitude = payload.longitude
        worker.location_updated_at = utcnow()
    db.commit()
    db.refresh(worker)
    return {"worker": worker_dict(worker)}


@router.get("/me/dashboard")
def worker_dashboard(
    user: User = Depends(require_roles(UserRole.WORKER)), db: Session = Depends(get_db)
) -> dict:
    worker = _require_worker(db, user)
    tasks = (
        db.query(Complaint)
        .options(joinedload(Complaint.user), joinedload(Complaint.evidence))
        .filter(Complaint.assigned_worker_id == worker.id)
        .order_by(Complaint.priority_score.desc(), Complaint.created_at.desc())
        .all()
    )

    def with_distance(c: Complaint) -> dict:
        data = complaint_dict(c)
        base_lat = worker.current_latitude or WORKER_ORIGIN[0]
        base_lon = worker.current_longitude or WORKER_ORIGIN[1]
        data["distance_km"] = round(haversine_km(base_lat, base_lon, c.latitude, c.longitude), 2)
        return data

    pending = [with_distance(c) for c in tasks if c.status in {"ASSIGNED", "REVIEWED"}]
    active = [
        with_distance(c)
        for c in tasks
        if c.status in {"ON_THE_WAY", "ARRIVED", "COLLECTED"}
    ]
    completed = [with_distance(c) for c in tasks if c.status in {"PROOF_UPLOADED", "VERIFIED", "RESOLVED"}]
    pickups = (
        db.query(PickupRequest)
        .options(joinedload(PickupRequest.user))
        .filter(PickupRequest.assigned_worker_id == worker.id)
        .all()
    )
    resolution_times = [
        c.response_minutes for c in tasks if c.response_minutes is not None and c.status == "RESOLVED"
    ]
    return {
        "worker": worker_dict(worker),
        "summary": {
            "today_tasks": len(tasks),
            "pending": len(pending),
            "active": len(active),
            "completed": len(completed),
            "critical": sum(1 for c in tasks if c.priority_level == "CRITICAL"),
            "pickups": len(pickups),
            "avg_resolution_minutes": round(sum(resolution_times) / len(resolution_times), 1)
            if resolution_times
            else 0.0,
        },
        "pending": pending,
        "active": active,
        "completed": completed[:15],
        "pickups": [pickup_dict(p) for p in pickups],
    }
