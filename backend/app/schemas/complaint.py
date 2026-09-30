from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ComplaintBase(BaseModel):
    category: str
    description: str | None = Field(default=None, max_length=1500)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str = Field(min_length=4, max_length=400)
    ward: str | None = Field(default=None, max_length=80)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        allowed = {
            "OVERFLOWING_BIN",
            "GARBAGE_ON_ROAD",
            "ILLEGAL_DUMPING",
            "MISSED_COLLECTION",
            "IMPROPER_SEGREGATION",
            "OTHER",
        }
        v = value.upper().strip()
        if v not in allowed:
            raise ValueError(f"Category must be one of {sorted(allowed)}")
        return v


class ComplaintCreate(ComplaintBase):
    image_url: str | None = None
    run_ai: bool = True


class ComplaintUpdate(BaseModel):
    category: str | None = None
    description: str | None = Field(default=None, max_length=1500)
    address: str | None = Field(default=None, max_length=400)
    ward: str | None = Field(default=None, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    status: str | None = None
    admin_note: str | None = Field(default=None, max_length=400)


class WorkerBrief(BaseModel):
    id: int
    name: str
    employee_code: str
    ward: str | None = None
    vehicle_number: str | None = None
    status: str | None = None


class EvidenceOut(BaseModel):
    id: int
    evidence_type: str
    file_url: str
    note: str | None = None
    cleanliness_score: float | None = None
    created_at: datetime


class TimelineStep(BaseModel):
    status: str
    label: str
    completed: bool
    timestamp: str | None = None
    note: str | None = None


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    complaint_id: str
    user_id: int
    category: str
    description: str | None = None
    image_url: str | None = None
    latitude: float
    longitude: float
    address: str
    ward: str | None = None
    waste_type: str | None = None
    issue_type: str | None = None
    severity: float
    detected_objects: list[str] | None = None
    recommended_action: str | None = None
    ai_provider: str | None = None
    ai_confidence: float | None = None
    priority_score: float
    priority_level: str
    priority_reasons: list[str] | None = None
    priority_breakdown: dict[str, Any] | None = None
    status: str
    assigned_worker_id: int | None = None
    duplicate_group: str | None = None
    is_duplicate: bool = False
    merged_into_id: int | None = None
    before_cleanliness: float | None = None
    after_cleanliness: float | None = None
    verification_status: str | None = None
    verification_notes: str | None = None
    response_minutes: float | None = None
    admin_note: str | None = None
    created_at: datetime
    updated_at: datetime
    assigned_at: datetime | None = None
    resolved_at: datetime | None = None
    citizen_name: str | None = None
    worker: WorkerBrief | None = None
    evidence: list[EvidenceOut] = Field(default_factory=list)
    timeline: list[TimelineStep] = Field(default_factory=list)
    distance_km: float | None = None


class ComplaintListResponse(BaseModel):
    items: list[ComplaintOut]
    total: int
    page: int
    page_size: int
    pages: int


class AssignRequest(BaseModel):
    worker_id: int
    note: str | None = Field(default=None, max_length=300)


class StatusRequest(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=400)


class EvidenceIn(BaseModel):
    evidence_type: str = Field(pattern="^(BEFORE|AFTER)$")
    file_url: str = Field(max_length=400)
    note: str | None = Field(default=None, max_length=300)


class WorkerStatusRequest(BaseModel):
    status: str | None = Field(default=None, pattern="^(AVAILABLE|BUSY|OFFLINE)$")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_updated_at: str | None = None


class MergeRequest(BaseModel):
    primary_complaint_id: str
    duplicate_complaint_ids: list[str] = Field(min_length=1)


class AnalyzeResponse(BaseModel):
    complaint_id: str
    waste_type: str | None
    issue_type: str | None
    severity: float
    priority_score: float
    priority_level: str
    reasons: list[str]
    detected_objects: list[str]
    recommended_action: str | None
    provider: str | None
    confidence: float | None
    breakdown: dict[str, Any] | None = None
    duplicate_of: str | None = None
    raw: dict[str, Any] | None = None
