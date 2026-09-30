from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import ComplaintStatus
from app.models.user import utcnow


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    complaint_id: Mapped[str] = mapped_column(
        String(24), unique=True, index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)

    image_url: Mapped[str | None] = mapped_column(String(400))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str] = mapped_column(String(400), nullable=False)
    ward: Mapped[str | None] = mapped_column(String(80), index=True)

    # AI analysis output
    waste_type: Mapped[str | None] = mapped_column(String(80))
    issue_type: Mapped[str | None] = mapped_column(String(120))
    severity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    detected_objects: Mapped[list | None] = mapped_column(JSON, default=list)
    recommended_action: Mapped[str | None] = mapped_column(String(300))
    ai_provider: Mapped[str | None] = mapped_column(String(32))
    ai_confidence: Mapped[float | None] = mapped_column(Float)
    ai_raw: Mapped[dict | None] = mapped_column(JSON, default=dict)

    # Priority engine output
    priority_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    priority_level: Mapped[str] = mapped_column(String(16), default="LOW", index=True)
    priority_reasons: Mapped[list | None] = mapped_column(JSON, default=list)
    priority_breakdown: Mapped[dict | None] = mapped_column(JSON, default=dict)

    status: Mapped[str] = mapped_column(
        String(24), default=ComplaintStatus.SUBMITTED.value, index=True, nullable=False
    )
    assigned_worker_id: Mapped[int | None] = mapped_column(
        ForeignKey("workers.id", ondelete="SET NULL"), index=True
    )

    duplicate_group: Mapped[str | None] = mapped_column(String(32), index=True)
    merged_into_id: Mapped[int | None] = mapped_column(Integer)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    before_cleanliness: Mapped[float | None] = mapped_column(Float)
    after_cleanliness: Mapped[float | None] = mapped_column(Float)
    verification_status: Mapped[str | None] = mapped_column(String(24))
    verification_notes: Mapped[str | None] = mapped_column(String(300))

    response_minutes: Mapped[float | None] = mapped_column(Float)
    admin_note: Mapped[str | None] = mapped_column(String(400))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    assigned_worker: Mapped["Worker | None"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    events: Mapped[list["ComplaintEvent"]] = relationship(
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="ComplaintEvent.id",
    )
    evidence: Mapped[list["Evidence"]] = relationship(
        back_populates="complaint", cascade="all, delete-orphan"
    )
    assignment: Mapped["Assignment | None"] = relationship(
        back_populates="complaint",
        cascade="all, delete-orphan",
        uselist=False,
    )


class ComplaintEvent(Base):
    __tablename__ = "complaint_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    complaint_id: Mapped[int] = mapped_column(
        ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    note: Mapped[str | None] = mapped_column(String(400))
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    complaint: Mapped[Complaint] = relationship(back_populates="events")


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    complaint_id: Mapped[int] = mapped_column(
        ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    worker_id: Mapped[int] = mapped_column(
        ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    distance_km: Mapped[float | None] = mapped_column(Float)
    eta_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(24), default="ASSIGNED", nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    on_way_at: Mapped[datetime | None] = mapped_column(DateTime)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime)
    collected_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    complaint: Mapped[Complaint] = relationship(back_populates="assignment")
    worker: Mapped["Worker"] = relationship()  # type: ignore[name-defined]  # noqa: F821


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    complaint_id: Mapped[int] = mapped_column(
        ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    evidence_type: Mapped[str] = mapped_column(String(12), nullable=False)
    file_url: Mapped[str] = mapped_column(String(400), nullable=False)
    note: Mapped[str | None] = mapped_column(String(300))
    cleanliness_score: Mapped[float | None] = mapped_column(Float)
    uploaded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    complaint: Mapped[Complaint] = relationship(back_populates="evidence")
