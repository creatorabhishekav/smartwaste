from __future__ import annotations

from datetime import datetime, date, time

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import PickupStatus
from app.models.user import utcnow


class PickupRequest(Base):
    __tablename__ = "pickup_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pickup_id: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    waste_type: Mapped[str] = mapped_column(String(60), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="kg", nullable=False)
    address: Mapped[str] = mapped_column(String(400), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    ward: Mapped[str | None] = mapped_column(String(80), index=True)
    preferred_date: Mapped[date | None] = mapped_column(Date)
    preferred_time: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(String(400))
    status: Mapped[str] = mapped_column(
        String(20), default=PickupStatus.REQUESTED.value, index=True, nullable=False
    )
    assigned_worker_id: Mapped[int | None] = mapped_column(
        ForeignKey("workers.id", ondelete="SET NULL")
    )
    eco_points_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    events: Mapped[list["PickupEvent"]] = relationship(
        back_populates="pickup", cascade="all, delete-orphan", order_by="PickupEvent.id"
    )

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    assigned_worker: Mapped["Worker | None"] = relationship()  # type: ignore[name-defined]  # noqa: F821


class PickupEvent(Base):
    __tablename__ = "pickup_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pickup_id: Mapped[int] = mapped_column(
        ForeignKey("pickup_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    pickup: Mapped[PickupRequest] = relationship(back_populates="events")
