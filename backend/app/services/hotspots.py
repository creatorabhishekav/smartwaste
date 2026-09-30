"""Hotspot recomputation + public-facing hotspot listing."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.complaint import Complaint
from app.models.enums import OPEN_STATUSES
from app.models.misc import Hotspot
from app.services.duplicates import cluster_complaints


def recompute_hotspots(db: Session) -> list[Hotspot]:
    """Rebuild the hotspot table from live complaint data."""
    complaints = db.query(Complaint).filter(Complaint.is_duplicate.is_(False)).all()
    clusters = cluster_complaints(complaints)

    existing = {h.code: h for h in db.query(Hotspot).all()}
    seen_codes: set[str] = set()

    for cluster in clusters:
        seen_codes.add(cluster["code"])
        row = existing.get(cluster["code"])
        if row is None:
            row = Hotspot(code=cluster["code"])
            db.add(row)
        row.label = cluster["label"]
        row.ward = cluster["ward"] or "Unassigned"
        row.latitude = cluster["latitude"]
        row.longitude = cluster["longitude"]
        row.radius_meters = 250
        row.complaint_count = cluster["complaint_count"]
        row.critical_count = cluster["critical_count"]
        row.open_count = cluster["open_count"]
        row.top_issue = cluster["top_issue"]
        row.recommended_action = cluster["recommended_action"]
        row.intensity = cluster["intensity"]

    for code, row in existing.items():
        if code not in seen_codes:
            db.delete(row)

    db.flush()
    return db.query(Hotspot).order_by(Hotspot.complaint_count.desc()).all()


def list_hotspots(db: Session) -> list[Hotspot]:
    return db.query(Hotspot).order_by(Hotspot.complaint_count.desc()).all()


def nearby_open_complaints(db: Session, lat: float, lon: float) -> list[dict]:
    rows = (
        db.query(Complaint)
        .filter(Complaint.status.in_(OPEN_STATUSES))
        .limit(400)
        .all()
    )
    from app.services.geo import haversine_km

    return [
        {
            "id": c.id,
            "complaint_id": c.complaint_id,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "status": c.status,
            "category": c.category,
        }
        for c in rows
        if haversine_km(lat, lon, c.latitude, c.longitude) <= 0.6
    ]
