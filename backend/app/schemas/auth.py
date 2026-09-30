from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=20)
    ward: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    role: str = Field(default="CITIZEN")

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        allowed = {"CITIZEN", "WORKER", "ADMIN"}
        if value.upper() not in allowed:
            raise ValueError(f"Role must be one of {sorted(allowed)}")
        return value.upper()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None = None
    role: str
    ward: str | None = None
    address: str | None = None
    eco_points: int = 0
    created_at: datetime | None = None


class WorkerOut(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    employee_code: str
    ward: str
    zone: str | None = None
    vehicle_number: str | None = None
    status: str
    total_assigned: int
    total_completed: int
    average_resolution_minutes: float
    rating: float
    latitude: float | None = None
    longitude: float | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    worker: WorkerOut | None = None


class DemoLoginRequest(BaseModel):
    role: str = Field(default="CITIZEN")

    @field_validator("role")
    @classmethod
    def validate(cls, value: str) -> str:
        allowed = {"CITIZEN", "WORKER", "ADMIN"}
        if value.upper() not in allowed:
            raise ValueError(f"Role must be one of {sorted(allowed)}")
        return value.upper()


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    ward: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    latitude: float | None = None
    longitude: float | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
