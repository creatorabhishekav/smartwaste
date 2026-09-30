"""Hotspot map data (privacy-rounded coordinates) and recomputation."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_roles
from app.database.session import get_db
from app.models.complaint import Complaint
from app.models.enums import UserRole
from app.models.misc import Hotspot
from app.schemas.ops import HotspotOut
from app.schemas.serializers import complaint_dict
from app.services.hotspots import recompute_hotspots

router = APIRouter(prefix="/hotspots", tags=["hotspots"])


@router.get("", response_model=list[HotspotOut])
def list_hotspots(
    refresh: bool = Query(default=False, description="Recompute clusters from live complaints"),
    db: Session = Depends(get_db),
) -> list[HotspotOut]:
    if refresh or db.query(Hotspot).count() == 0:
        recompute_hotspots(db)
        db.commit()
    return db.query(Hotspot).order_by(Hotspot.complaint_count.desc()).all()


@router.get("/complaints")
def map_complaints(
    limit: int = Query(default=250, le=500),
    include_resolved: bool = False,
    _: object = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    """Map markers. Coordinates are rounded to protect precise citizen locations."""
    query = db.query(Complaint).options(
        joinedload(Complaint.user), joinedload(Complaint.assigned_worker)
    )
    if not include_resolved:
        query = query.filter(Complaint.status != "REJECTED")
    rows = query.order_by(Complaint.created_at.desc()).limit(limit).all()
    items = [complaint_dict(c, include_location_precision=False) for c in rows]
    return {
        "items": items,
        "total": len(items),
        "note": "Coordinates rounded to ~1 km to protect resident privacy.",
    }
