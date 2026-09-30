from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import UserRole, WorkerStatus


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(24), default=UserRole.CITIZEN.value, nullable=False)
    ward: Mapped[str | None] = mapped_column(String(80))
    address: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    eco_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    worker_profile: Mapped["Worker | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    employee_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    ward: Mapped[str] = mapped_column(String(80), nullable=False)
    zone: Mapped[str | None] = mapped_column(String(120))
    vehicle_number: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(24), default=WorkerStatus.AVAILABLE.value)
    total_assigned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    average_resolution_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=4.5, nullable=False)
    current_latitude: Mapped[float | None] = mapped_column(Float)
    current_longitude: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    user: Mapped[User] = relationship(back_populates="worker_profile")
