from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PickupCreate(BaseModel):
    waste_type: str = Field(min_length=2, max_length=60)
    quantity: float = Field(gt=0, le=100_000)
    unit: str = Field(default="kg", max_length=20)
    address: str = Field(min_length=4, max_length=400)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    preferred_date: date | None = None
    preferred_time: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)
    photo_url: str | None = None


class PickupStatusUpdate(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=300)


class PickupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pickup_id: str
    user_id: int
    waste_type: str
    quantity: float
    unit: str
    address: str
    latitude: float
    longitude: float
    ward: str | None = None
    preferred_date: date | None = None
    preferred_time: str | None = None
    notes: str | None = None
    photo_url: str | None = None
    status: str
    assigned_worker_id: int | None = None
    eco_points_awarded: int = 0
    created_at: datetime
    completed_at: datetime | None = None
    citizen_name: str | None = None
    worker_name: str | None = None
    timeline: list[dict] = Field(default_factory=list)


class AwarenessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    category: str
    summary: str
    what_it_is: str
    which_bin: str
    how_to_dispose: str
    recyclable: bool
    hazard_level: str
    accent: str
    do_list: list[str] | None = None
    dont_list: list[str] | None = None
    is_published: bool = True
    updated_at: datetime | None = None


class AwarenessUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    summary: str | None = Field(default=None, max_length=400)
    what_it_is: str | None = None
    which_bin: str | None = Field(default=None, max_length=80)
    how_to_dispose: str | None = None
    recyclable: bool | None = None
    hazard_level: str | None = None
    accent: str | None = None
    do_list: list[str] | None = None
    dont_list: list[str] | None = None
    is_published: bool | None = None


class AwarenessAsk(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: str
    type: str
    is_read: bool
    complaint_id: int | None = None
    pickup_ref: str | None = None
    created_at: datetime


class HotspotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    label: str
    ward: str
    latitude: float
    longitude: float
    radius_meters: int
    complaint_count: int
    critical_count: int
    open_count: int
    top_issue: str | None = None
    recommended_action: str | None = None
    intensity: float
    last_updated: datetime | None = None


class EcoSummary(BaseModel):
    eco_points: int
    level: str
    level_number: int
    level_icon: str
    xp_into_level: int
    next_level: dict | None = None
    badges: list[dict]
    history: list[dict]
