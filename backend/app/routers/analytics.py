"""Analytics endpoints - all values computed from live data."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.database.session import get_db
from app.models.complaint import Complaint
from app.models.enums import OPEN_STATUSES, UserRole
from app.models.misc import Hotspot
from app.models.user import User, Worker
from app.schemas.serializers import complaint_dict
from app.services import analytics as svc
from app.services.geo import haversine_km

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("")
def all_analytics(
    days: int = Query(default=14, ge=7, le=60),
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "overview": svc.overview(db),
        "impact": svc.impact(db),
        "trend": svc.complaint_trend(db, days=days),
        "category_distribution": svc.category_distribution(db),
        "status_distribution": svc.status_distribution(db),
        "priority_distribution": svc.priority_distribution(db),
        "ward_comparison": svc.ward_comparison(db),
        "response_times": svc.response_times(db),
        "hotspots": svc.hotspot_distribution(db),
        "worker_performance": svc.worker_performance(db),
        "pickups": svc.pickup_analytics(db),
    }


@router.get("/impact")
def impact(db: Session = Depends(get_db)) -> dict:
    """Public facing community impact figures for the landing page."""
    return svc.impact(db)


@router.get("/dashboard")
def citizen_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Personal dashboard payload (role aware) - one call, no waterfall requests."""
    base_query = db.query(Complaint).filter(Complaint.user_id == user.id)
    mine = base_query.all()

    nearby: list[dict] = []
    if user.latitude and user.longitude:
        candidates = (
            db.query(Complaint)
            .filter(Complaint.status.in_(OPEN_STATUSES), Complaint.user_id != user.id)
            .limit(300)
            .all()
        )
        scored = sorted(
            (
                {
                    "complaint_id": c.complaint_id,
                    "category": c.category,
                    "address": c.address,
                    "ward": c.ward,
                    "priority_level": c.priority_level,
                    "latitude": round(c.latitude, 4),
                    "longitude": round(c.longitude, 4),
                    "distance_km": round(
                        haversine_km(user.latitude, user.longitude, c.latitude, c.longitude), 2
                    ),
                }
                for c in candidates
            ),
            key=lambda row: row["distance_km"],
        )
        nearby = scored[:6]

    if user.role == UserRole.ADMIN.value:
        summary = svc.overview(db)
    else:
        resolved = [c for c in mine if c.status in {"RESOLVED", "VERIFIED"}]
        summary = {
            "total_complaints": len(mine),
            "resolved_complaints": len(resolved),
            "pending_complaints": sum(1 for c in mine if c.status in OPEN_STATUSES),
            "critical_complaints": sum(1 for c in mine if c.priority_level == "CRITICAL"),
            "resolution_rate": round(len(resolved) / len(mine) * 100, 1) if mine else 0.0,
            "total_evidence": sum(len(c.evidence) for c in mine),
        }

    return {
        "summary": summary,
        "eco_points": user.eco_points,
        "recent_complaints": [complaint_dict(c) for c in sorted(mine, key=lambda c: c.created_at, reverse=True)[:6]],
        "nearby_hotspots": nearby,
        "active_hotspots": [
            {
                "code": h.code,
                "label": h.label,
                "ward": h.ward,
                "latitude": h.latitude,
                "longitude": h.longitude,
                "complaint_count": h.complaint_count,
                "critical_count": h.critical_count,
                "top_issue": h.top_issue,
                "recommended_action": h.recommended_action,
                "intensity": h.intensity,
            }
            for h in db.query(Hotspot).order_by(Hotspot.complaint_count.desc()).limit(6).all()
        ],
    }
