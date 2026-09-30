"""Analytics computed from live application data (never hard-coded in the UI)."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.complaint import Complaint, Evidence
from app.models.enums import OPEN_STATUSES, PickupStatus
from app.models.misc import Hotspot
from app.models.pickup import PickupRequest
from app.models.user import User, Worker


def _pct(numerator: float, denominator: float) -> float:
    return round((numerator / denominator) * 100, 1) if denominator else 0.0


def overview(db: Session) -> dict:
    complaints = db.query(Complaint).all()
    workers = db.query(Worker).all()
    pickups = db.query(PickupRequest).all()

    total = len(complaints)
    resolved = [c for c in complaints if c.status in {"RESOLVED", "VERIFIED"}]
    pending = [c for c in complaints if c.status in OPEN_STATUSES]
    critical = [c for c in complaints if c.priority_level == "CRITICAL"]
    by_level = Counter(c.priority_level for c in complaints)
    by_status = Counter(c.status for c in complaints)
    by_category = Counter(c.category for c in complaints)

    response_times = [
        c.response_minutes for c in complaints if c.response_minutes is not None
    ]
    resolution_times = [
        (c.resolved_at - c.created_at).total_seconds() / 60.0
        for c in complaints
        if c.resolved_at and c.created_at
    ]
    active_workers = [w for w in workers if w.status in {"AVAILABLE", "BUSY"}]

    return {
        "total_complaints": total,
        "pending_complaints": len(pending),
        "critical_complaints": len(critical),
        "high_complaints": by_level.get("HIGH", 0),
        "medium_complaints": by_level.get("MEDIUM", 0),
        "low_complaints": by_level.get("LOW", 0),
        "resolved_complaints": len(resolved),
        "resolution_rate": _pct(len(resolved), total),
        "in_progress_complaints": sum(
            1 for c in complaints if c.status in {"ASSIGNED", "ON_THE_WAY", "ARRIVED", "COLLECTED", "PROOF_UPLOADED"}
        ),
        "avg_response_minutes": round(sum(response_times) / len(response_times), 1)
        if response_times
        else 0.0,
        "avg_resolution_hours": round(sum(resolution_times) / len(resolution_times) / 60, 1)
        if resolution_times
        else 0.0,
        "active_workers": len(active_workers),
        "total_workers": len(workers),
        "citizens": db.query(func.count(User.id)).filter(User.role == "CITIZEN").scalar() or 0,
        "total_pickups": len(pickups),
        "pending_pickups": sum(1 for p in pickups if p.status != PickupStatus.COMPLETED.value),
        "total_evidence": db.query(func.count(Evidence.id)).scalar() or 0,
        "open_hotspots": db.query(func.count(Hotspot.id)).scalar() or 0,
        "by_priority": dict(by_level),
        "by_status": dict(by_status),
        "by_category": dict(by_category),
    }


def complaint_trend(db: Session, days: int = 14) -> list[dict]:
    now = datetime.utcnow()
    buckets: dict[str, dict] = {}
    for offset in range(days - 1, -1, -1):
        day = (now - timedelta(days=offset)).date()
        buckets[day.isoformat()] = {"date": day.isoformat(), "reported": 0, "resolved": 0}

    for c in db.query(Complaint).all():
        key = c.created_at.date().isoformat()
        if key in buckets:
            buckets[key]["reported"] += 1
        if c.resolved_at:
            rkey = c.resolved_at.date().isoformat()
            if rkey in buckets:
                buckets[rkey]["resolved"] += 1
    return list(buckets.values())


def category_distribution(db: Session) -> list[dict]:
    counter = Counter(c.category for c in db.query(Complaint).all())
    total = sum(counter.values()) or 1
    return [
        {
            "category": name,
            "label": name.replace("_", " ").title(),
            "count": count,
            "share": _pct(count, total),
        }
        for name, count in counter.most_common()
    ]


def status_distribution(db: Session) -> list[dict]:
    counter = Counter(c.status for c in db.query(Complaint).all())
    return [{"status": s, "count": n} for s, n in counter.most_common()]


def priority_distribution(db: Session) -> list[dict]:
    counter = Counter(c.priority_level for c in db.query(Complaint).all())
    order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    return [{"level": level, "count": counter.get(level, 0)} for level in order]


def ward_comparison(db: Session) -> list[dict]:
    agg: dict[str, dict] = defaultdict(
        lambda: {"ward": "", "total": 0, "resolved": 0, "critical": 0, "pending": 0, "response": 0.0}
    )
    for c in db.query(Complaint).all():
        ward = c.ward or "Unassigned"
        row = agg[ward]
        row["ward"] = ward
        row["total"] += 1
        if c.status in {"RESOLVED", "VERIFIED"}:
            row["resolved"] += 1
        else:
            row["pending"] += 1
        if c.priority_level == "CRITICAL":
            row["critical"] += 1
        if c.response_minutes:
            row["response"] += c.response_minutes
    output = []
    for row in agg.values():
        resolved = row.pop("resolved")
        response = row.pop("response")
        total = row["total"]
        row["resolution_rate"] = _pct(resolved, total)
        row["avg_response_minutes"] = round(response / total, 1) if total else 0.0
        output.append(row)
    return sorted(output, key=lambda r: r["total"], reverse=True)


def response_times(db: Session) -> list[dict]:
    """Daily average first-response time (minutes) for the trend chart."""
    by_day: dict[str, list[float]] = defaultdict(list)
    for c in db.query(Complaint).all():
        if c.response_minutes is not None:
            by_day[c.created_at.date().isoformat()].append(c.response_minutes)
    return [
        {"date": day, "avg_response_minutes": round(sum(values) / len(values), 1), "reports": len(values)}
        for day, values in sorted(by_day.items())[-14:]
    ]


def hotspot_distribution(db: Session) -> list[dict]:
    return [
        {
            "code": h.code,
            "label": h.label,
            "ward": h.ward,
            "latitude": h.latitude,
            "longitude": h.longitude,
            "complaint_count": h.complaint_count,
            "critical_count": h.critical_count,
            "open_count": h.open_count,
            "top_issue": h.top_issue,
            "recommended_action": h.recommended_action,
            "intensity": h.intensity,
        }
        for h in db.query(Hotspot).order_by(Hotspot.complaint_count.desc()).all()
    ]


def worker_performance(db: Session) -> list[dict]:
    output = []
    for worker in db.query(Worker).all():
        assigned = db.query(Complaint).filter(Complaint.assigned_worker_id == worker.id).all()
        completed = [c for c in assigned if c.status in {"RESOLVED", "VERIFIED"}]
        proofed = (
            db.query(func.count(Evidence.id))
            .filter(Evidence.complaint_id.in_([c.id for c in assigned] or [-1]))
            .scalar()
            or 0
        )
        minutes = [c.response_minutes for c in completed if c.response_minutes]
        output.append(
            {
                "worker_id": worker.id,
                "name": worker.user.name if worker.user else f"Worker {worker.id}",
                "employee_code": worker.employee_code,
                "ward": worker.ward,
                "status": worker.status,
                "assigned": len(assigned),
                "completed": len(completed),
                "completion_rate": _pct(len(completed), len(assigned)),
                "proof_images": proofed,
                "avg_resolution_minutes": round(sum(minutes) / len(minutes), 1)
                if minutes
                else worker.average_resolution_minutes,
                "rating": worker.rating,
            }
        )
    return sorted(output, key=lambda w: w["completed"], reverse=True)


def pickup_analytics(db: Session) -> dict:
    pickups = db.query(PickupRequest).all()
    by_status = Counter(p.status for p in pickups)
    by_type = Counter(p.waste_type for p in pickups)
    total_qty = sum(p.quantity for p in pickups)
    completed = [p for p in pickups if p.status == PickupStatus.COMPLETED.value]
    hours = [
        (p.completed_at - p.created_at).total_seconds() / 3600.0
        for p in completed
        if p.completed_at
    ]
    return {
        "total": len(pickups),
        "completed": len(completed),
        "pending": sum(1 for p in pickups if p.status != PickupStatus.COMPLETED.value),
        "by_status": [{"status": s, "count": c} for s, c in by_status.most_common()],
        "by_waste_type": [
            {"waste_type": t, "count": c, "quantity": round(sum(p.quantity for p in pickups if p.waste_type == t), 1)}
            for t, c in by_type.most_common()
        ],
        "total_quantity": round(total_qty, 1),
        "avg_completion_hours": round(sum(hours) / len(hours), 1) if hours else 0.0,
    }


def impact(db: Session) -> dict:
    """Landing-page / community impact figures derived from real data."""
    overview_data = overview(db)
    citizens = overview_data["citizens"]
    resolved = overview_data["resolved_complaints"]
    evidence = db.query(func.count(Evidence.id)).scalar() or 0
    workers = overview_data["active_workers"]
    return {
        "citizens_registered": citizens,
        "reports_resolved": resolved,
        "resolution_rate": overview_data["resolution_rate"],
        "avg_response_minutes": overview_data["avg_response_minutes"],
        "active_crews": workers,
        "evidence_photos": evidence,
        "wards_covered": len({c.ward for c in db.query(Complaint).all() if c.ward}),
        "hotspots_mapped": db.query(func.count(Hotspot.id)).scalar() or 0,
    }
