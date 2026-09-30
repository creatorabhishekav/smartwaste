"""Per-user notification inbox."""
from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models.misc import Notification
from app.models.user import User
from app.schemas.ops import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    unread_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    total = query.count()
    rows = (
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        .count()
    )
    return {
        "items": [NotificationOut.model_validate(n) for n in rows],
        "total": total,
        "unread": unread,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    row = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .first()
    )
    if row is None:
        return {"ok": False, "detail": "Notification not found"}
    row.is_read = True
    db.commit()
    return {"ok": True, "notification": NotificationOut.model_validate(row)}


@router.post("/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "updated": updated}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    row = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .first()
    )
    if row is not None:
        db.delete(row)
        db.commit()
    return {"ok": True}
