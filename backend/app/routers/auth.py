"""POST /auth/register, /auth/login, /auth/demo-login, /auth/me"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models.enums import UserRole, WorkerStatus
from app.models.misc import EcoTransaction
from app.models.user import User, Worker
from app.schemas.auth import (
    DemoLoginRequest,
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    RegisterRequest,
    TokenResponse,
    UserOut,
    WorkerOut,
)
from app.schemas.serializers import eco_dict, user_dict, worker_dict
from app.services.geo import nearest_ward

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_ACCOUNTS = {
    "CITIZEN": ("citizen@demo.com", "demo123"),
    "WORKER": ("worker@demo.com", "demo123"),
    "ADMIN": ("admin@demo.com", "demo123"),
}


def _token_response(user: User, db: Session) -> TokenResponse:
    token = create_access_token(subject=str(user.id), role=user.role)
    worker_profile = db.query(Worker).filter(Worker.user_id == user.id).first()
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user_dict(user)),
        worker=WorkerOut.model_validate(worker_dict(worker_profile)) if worker_profile else None,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    ward = payload.ward

    user = User(
        name=payload.name.strip(),
        email=email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        ward=ward,
        address=payload.address,
        eco_points=0,
    )
    db.add(user)
    db.flush()

    if user.role == UserRole.WORKER.value:
        worker = Worker(
            user_id=user.id,
            employee_code=f"SW-WK-{user.id:04d}",
            ward=ward or "Barauna",
            zone="Zone 1",
            vehicle_number=f"UP32-AB-{1000 + user.id}",
            status=WorkerStatus.AVAILABLE.value,
        )
        db.add(worker)

    db.commit()
    db.refresh(user)
    return _token_response(user, db)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password."
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated.")
    return _token_response(user, db)


@router.post("/demo-login", response_model=TokenResponse)
def demo_login(payload: DemoLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """One-click demo access used by the 'Launch Demo' buttons."""
    email, password = DEMO_ACCOUNTS[payload.role]
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=503,
            detail="Demo data is not seeded yet. Restart the backend to seed demo accounts.",
        )
    assert user is not None
    if not user.password_hash:
        user.password_hash = hash_password(password)
        db.commit()
    return _token_response(user, db)


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    worker = db.query(Worker).filter(Worker.user_id == user.id).first()
    return {
        "user": user_dict(user),
        "worker": worker_dict(worker) if worker else None,
        "permissions": {
            "can_report": True,
            "can_manage_workers": user.role == UserRole.ADMIN.value,
            "can_assign": user.role in {UserRole.ADMIN.value, UserRole.WORKER.value},
            "can_view_analytics": user.role == UserRole.ADMIN.value,
        },
        "environment": settings.environment,
    }


@router.get("/me/eco")
def my_eco_points(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Eco points, level, badges and earning history for the signed-in user."""
    transactions = (
        db.query(EcoTransaction)
        .filter(EcoTransaction.user_id == user.id)
        .order_by(EcoTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    return eco_dict(user, transactions)


@router.patch("/me")
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    data = payload.model_dump(exclude_none=True)
    for field in ("name", "phone", "ward", "address", "latitude", "longitude"):
        if field in data:
            setattr(user, field, data[field])
    if not user.ward and user.latitude is not None and user.longitude is not None:
        user.ward = nearest_ward(user.latitude, user.longitude)
    db.commit()
    db.refresh(user)
    return {"user": user_dict(user)}


@router.post("/me/password")
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Self-service password change; requires the current password."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect."
        )
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated."}
