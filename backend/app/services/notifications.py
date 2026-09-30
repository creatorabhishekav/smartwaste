"""Notification fan-out helpers."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.enums import NotificationType
from app.models.misc import Notification
from app.models.user import User


def notify(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    type_: str = NotificationType.INFO.value,
    complaint_id: int | None = None,
    pickup_ref: str | None = None,
) -> Notification:
    row = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type_,
        complaint_id=complaint_id,
        pickup_ref=pickup_ref,
    )
    db.add(row)
    return row


def notify_role(db: Session, role: str, **kwargs) -> int:
    users = db.query(User).filter(User.role == role, User.is_active.is_(True)).all()
    for user in users:
        notify(db, user_id=user.id, **kwargs)
    return len(users)


def unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .count()
    )
