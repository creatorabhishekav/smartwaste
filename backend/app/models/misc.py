from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.user import utcnow


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(String(400), nullable=False)
    type: Mapped[str] = mapped_column(String(16), default="INFO", nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    complaint_id: Mapped[int | None] = mapped_column(
        ForeignKey("complaints.id", ondelete="CASCADE")
    )
    pickup_ref: Mapped[str | None] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class AwarenessContent(Base):
    __tablename__ = "awareness_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(String(400), nullable=False)
    what_it_is: Mapped[str] = mapped_column(Text, nullable=False)
    which_bin: Mapped[str] = mapped_column(String(80), nullable=False)
    how_to_dispose: Mapped[str] = mapped_column(Text, nullable=False)
    recyclable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hazard_level: Mapped[str] = mapped_column(String(24), default="LOW")
    accent: Mapped[str] = mapped_column(String(24), default="emerald")
    do_list: Mapped[list | None] = mapped_column(JSON, default=list)
    dont_list: Mapped[list | None] = mapped_column(JSON, default=list)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )


class Hotspot(Base):
    __tablename__ = "hotspots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    ward: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    radius_meters: Mapped[int] = mapped_column(Integer, default=250)
    complaint_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    critical_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    open_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    top_issue: Mapped[str | None] = mapped_column(String(120))
    recommended_action: Mapped[str | None] = mapped_column(String(300))
    intensity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )


class EcoTransaction(Base):
    __tablename__ = "eco_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    complaint_id: Mapped[int | None] = mapped_column(
        ForeignKey("complaints.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
