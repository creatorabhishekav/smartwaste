"""Bulk pickup request lifecycle."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enums import PickupStatus, UserRole
from app.models.pickup import PickupEvent, PickupRequest
from app.models.user import User, Worker, utcnow
from app.services import gamification
from app.services.geo import nearest_ward
from app.services.notifications import notify, notify_role

PICKUP_LABELS: dict[str, str] = {
    PickupStatus.REQUESTED.value: "Requested",
    PickupStatus.ASSIGNED.value: "Assigned",
    PickupStatus.ON_THE_WAY.value: "On The Way",
    PickupStatus.COLLECTED.value: "Collected",
    PickupStatus.COMPLETED.value: "Completed",
    PickupStatus.CANCELLED.value: "Cancelled",
}

PICKUP_TRANSITIONS: dict[str, set[str]] = {
    PickupStatus.REQUESTED.value: {PickupStatus.ASSIGNED.value, PickupStatus.CANCELLED.value},
    PickupStatus.ASSIGNED.value: {PickupStatus.ON_THE_WAY.value, PickupStatus.CANCELLED.value},
    PickupStatus.ON_THE_WAY.value: {PickupStatus.COLLECTED.value, PickupStatus.CANCELLED.value},
    PickupStatus.COLLECTED.value: {PickupStatus.COMPLETED.value},
    PickupStatus.COMPLETED.value: set(),
    PickupStatus.CANCELLED.value: set(),
}

BULK_REWARD_THRESHOLD = 50.0


def next_pickup_ref(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"PU-{year}-"
    count = db.query(PickupRequest).filter(PickupRequest.pickup_id.like(f"{prefix}%")).count()
    for offset in range(1, 10_000):
        candidate = f"{prefix}{count + offset:04d}"
        if not db.query(PickupRequest.id).filter(PickupRequest.pickup_id == candidate).first():
            return candidate
    raise HTTPException(status_code=500, detail="Unable to allocate a pickup reference")


def add_event(db: Session, pickup: PickupRequest, status_value: str, note: str | None = None) -> None:
    db.add(
        PickupEvent(
            pickup_id=pickup.id,
            status=status_value,
            label=PICKUP_LABELS.get(status_value, status_value.title()),
            note=note,
        )
    )


def create_pickup(
    db: Session,
    *,
    user: User,
    waste_type: str,
    quantity: float,
    unit: str,
    address: str,
    latitude: float,
    longitude: float,
    preferred_date: date | None,
    preferred_time: str | None,
    notes: str | None,
    photo_url: str | None,
) -> PickupRequest:
    pickup = PickupRequest(
        pickup_id=next_pickup_ref(db),
        user_id=user.id,
        waste_type=waste_type,
        quantity=quantity,
        unit=unit,
        address=address,
        latitude=latitude,
        longitude=longitude,
        ward=user.ward or nearest_ward(latitude, longitude),
        preferred_date=preferred_date,
        preferred_time=preferred_time,
        notes=notes,
        photo_url=photo_url,
        status=PickupStatus.REQUESTED.value,
    )
    db.add(pickup)
    db.flush()
    add_event(db, pickup, PickupStatus.REQUESTED.value, note=f"{quantity} {unit} of {waste_type}")
    notify_role(
        db,
        UserRole.ADMIN.value,
        title=f"Pickup request {pickup.pickup_id}",
        message=f"{quantity} {unit} {waste_type} requested at {address}",
        type_="INFO",
        pickup_ref=pickup.pickup_id,
    )
    db.flush()
    return pickup


def assign_pickup(db: Session, pickup: PickupRequest, worker: Worker, actor_id: int) -> PickupRequest:
    if pickup.status != PickupStatus.REQUESTED.value:
        raise HTTPException(
            status_code=400, detail=f"Pickup {pickup.pickup_id} is already {pickup.status}."
        )
    pickup.assigned_worker_id = worker.id
    pickup.status = PickupStatus.ASSIGNED.value
    add_event(db, pickup, PickupStatus.ASSIGNED.value, note=f"Crew {worker.employee_code} assigned")
    notify(
        db,
        user_id=pickup.user_id,
        title=f"Pickup {pickup.pickup_id} assigned",
        message="A collection vehicle has been assigned for your request.",
        type_="INFO",
        pickup_ref=pickup.pickup_id,
    )
    notify(
        db,
        user_id=worker.user_id,
        title=f"Pickup task {pickup.pickup_id}",
        message=f"{pickup.quantity} {pickup.unit} {pickup.waste_type} at {pickup.address}",
        type_="INFO",
        pickup_ref=pickup.pickup_id,
    )
    worker.status = "BUSY"
    db.flush()
    return pickup


def transition_pickup(
    db: Session,
    pickup: PickupRequest,
    target: str,
    *,
    actor: User,
    note: str | None = None,
) -> PickupRequest:
    allowed = PICKUP_TRANSITIONS.get(pickup.status, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400, detail=f"Cannot move pickup from {pickup.status} to {target}."
        )
    if target == PickupStatus.ON_THE_WAY.value and actor.role == UserRole.WORKER.value:
        if pickup.assigned_worker_id is None or pickup.assigned_worker.user_id != actor.id:
            raise HTTPException(status_code=403, detail="This pickup is not assigned to you.")
    pickup.status = target
    add_event(db, pickup, target, note=note)
    if target == PickupStatus.COMPLETED.value:
        pickup.completed_at = utcnow()
        points = (
            gamification.AWARDS["PICKUP_COMPLETED_LARGE"]
            if pickup.quantity >= BULK_REWARD_THRESHOLD
            else gamification.AWARDS["PICKUP_COMPLETED"]
        )
        pickup.eco_points_awarded = points
        gamification.award_points(
            db,
            user_id=pickup.user_id,
            points=points,
            reason=f"Bulk pickup {pickup.pickup_id} completed",
        )
        if pickup.assigned_worker:
            pickup.assigned_worker.status = "AVAILABLE"
        notify(
            db,
            user_id=pickup.user_id,
            title=f"Pickup {pickup.pickup_id} completed",
            message=f"Great! You earned {points} eco points for responsible disposal.",
            type_="SUCCESS",
            pickup_ref=pickup.pickup_id,
        )
    else:
        notify(
            db,
            user_id=pickup.user_id,
            title=f"Pickup {pickup.pickup_id}: {PICKUP_LABELS[target]}",
            message=note or PICKUP_LABELS[target],
            type_="INFO",
            pickup_ref=pickup.pickup_id,
        )
    db.flush()
    return pickup


def timeline_for(pickup: PickupRequest) -> list[dict[str, Any]]:
    events = {e.status: e for e in pickup.events}
    out: list[dict[str, Any]] = []
    for stage in (
        PickupStatus.REQUESTED.value,
        PickupStatus.ASSIGNED.value,
        PickupStatus.ON_THE_WAY.value,
        PickupStatus.COLLECTED.value,
        PickupStatus.COMPLETED.value,
    ):
        event = events.get(stage)
        out.append(
            {
                "status": stage,
                "label": PICKUP_LABELS[stage],
                "completed": event is not None,
                "timestamp": event.created_at.isoformat() if event else None,
                "note": event.note if event else None,
            }
        )
    return out
