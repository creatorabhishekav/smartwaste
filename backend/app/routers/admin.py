"""Admin command-center endpoints: KPIs, priority queue, duplicates, users."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_roles
from app.database.session import get_db
from app.models.complaint import Complaint
from app.models.enums import OPEN_STATUSES, UserRole
from app.models.user import User, Worker
from app.schemas.serializers import complaint_dict, user_dict
from app.services import analytics as analytics_service
from app.services.duplicates import cluster_complaints
from app.services.hotspots import recompute_hotspots
from app.services.storage import UPLOAD_DIR

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles(UserRole.ADMIN))])


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    data = analytics_service.overview(db)
    data["impact"] = analytics_service.impact(db)
    data["recent_complaints"] = [
        complaint_dict(c)
        for c in db.query(Complaint)
        .options(joinedload(Complaint.user), joinedload(Complaint.assigned_worker).joinedload(Worker.user))
        .order_by(Complaint.created_at.desc())
        .limit(6)
        .all()
    ]
    data["top_workers"] = analytics_service.worker_performance(db)[:5]
    data["critical_queue"] = [
        complaint_dict(c)
        for c in db.query(Complaint)
        .options(joinedload(Complaint.user), joinedload(Complaint.assigned_worker).joinedload(Worker.user))
        .filter(Complaint.status.in_(OPEN_STATUSES))
        .order_by(Complaint.priority_score.desc())
        .limit(6)
        .all()
    ]
    return data


@router.get("/priority-queue")
def priority_queue(
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = None,
    limit: int = Query(default=100, le=300),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Complaint).options(
        joinedload(Complaint.user), joinedload(Complaint.assigned_worker)
    )
    if status_filter:
        query = query.filter(Complaint.status == status_filter.upper())
    else:
        query = query.filter(Complaint.status.in_(OPEN_STATUSES))
    if priority:
        query = query.filter(Complaint.priority_level == priority.upper())
    rows = query.order_by(Complaint.priority_score.desc(), Complaint.created_at.asc()).limit(limit).all()
    return [complaint_dict(c) for c in rows]


@router.get("/duplicates")
def duplicates(
    refresh: bool = True, db: Session = Depends(get_db)
) -> dict:
    if refresh:
        recompute_hotspots(db)
        db.commit()
    clusters = cluster_complaints(
        db.query(Complaint).filter(Complaint.is_duplicate.is_(False)).all()
    )
    groups: list[dict] = []
    for cluster in clusters:
        members = (
            db.query(Complaint)
            .options(joinedload(Complaint.user), joinedload(Complaint.assigned_worker))
            .filter(Complaint.id.in_(cluster["member_refs"]))
            .all()
        )
        groups.append(
            {
                **cluster,
                "members": [complaint_dict(m) for m in members],
            }
        )
    return {"groups": groups, "count": len(groups)}


@router.get("/users")
def list_users(
    role: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(User)
    if role:
        query = query.filter(User.role == role.upper())
    if search:
        query = query.filter(User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    return [user_dict(u) for u in query.order_by(User.id).all()]


@router.post("/users/{user_id}/toggle")
def toggle_user(user_id: int, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if user is None:
        return {"error": "User not found"}
    user.is_active = not user.is_active
    db.commit()
    return {"user": user_dict(user)}


@router.post("/recompute")
def recompute(db: Session = Depends(get_db)) -> dict:
    hotspots = recompute_hotspots(db)
    db.commit()
    return {
        "hotspots": [
            {
                "code": h.code,
                "label": h.label,
                "ward": h.ward,
                "complaint_count": h.complaint_count,
                "critical_count": h.critical_count,
            }
            for h in hotspots
        ],
        "count": len(hotspots),
        "recomputed_at": datetime.utcnow().isoformat(),
    }


@router.get("/system")
def system(db: Session = Depends(get_db)) -> dict:
    from app.core.config import settings
    from app.services.ai import provider_status
    from app.services.verification import get_verification_provider

    provider = get_verification_provider()
    return {
        "app": settings.app_name,
        "environment": settings.environment,
        "database": settings.database_url.split("://")[0],
        "ai": provider_status(),
        "verification_provider": provider.name,
        "upload_dir": str(UPLOAD_DIR),
        "max_upload_mb": round(settings.max_upload_bytes / (1024 * 1024), 1),
    }
