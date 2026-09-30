"""Object -> dict serializers shared by the routers."""
from __future__ import annotations

from typing import Any

from app.models.complaint import Complaint
from app.models.misc import EcoTransaction
from app.models.pickup import PickupRequest
from app.models.user import User, Worker
from app.services.complaint_service import timeline_for
from app.services.gamification import badges_for, level_for, next_level
from app.services.pickup_service import timeline_for as pickup_timeline
from app.services.geo import haversine_km

WORKER_LATEST_LAT = 26.4499
WORKER_LATEST_LON = 80.3319


def worker_dict(worker: Worker, db=None) -> dict[str, Any]:
    return {
        "id": worker.id,
        "user_id": worker.user_id,
        "name": worker.user.name if worker.user else f"Worker {worker.id}",
        "email": worker.user.email if worker.user else None,
        "employee_code": worker.employee_code,
        "ward": worker.ward,
        "zone": worker.zone,
        "vehicle_number": worker.vehicle_number,
        "status": worker.status,
        "total_assigned": worker.total_assigned,
        "total_completed": worker.total_completed,
        "average_resolution_minutes": worker.average_resolution_minutes,
        "rating": worker.rating,
        "latitude": worker.current_latitude,
        "longitude": worker.current_longitude,
    }


def complaint_dict(
    complaint: Complaint,
    *,
    db=None,
    include_location_precision: bool = True,
) -> dict[str, Any]:
    worker = complaint.assigned_worker
    data: dict[str, Any] = {
        "id": complaint.id,
        "complaint_id": complaint.complaint_id,
        "user_id": complaint.user_id,
        "citizen_name": complaint.user.name if complaint.user else None,
        "category": complaint.category,
        "description": complaint.description,
        "image_url": complaint.image_url,
        "address": complaint.address,
        "ward": complaint.ward,
        "waste_type": complaint.waste_type,
        "issue_type": complaint.issue_type,
        "severity": complaint.severity,
        "detected_objects": complaint.detected_objects or [],
        "recommended_action": complaint.recommended_action,
        "ai_provider": complaint.ai_provider,
        "ai_confidence": complaint.ai_confidence,
        "priority_score": complaint.priority_score,
        "priority_level": complaint.priority_level,
        "priority_reasons": complaint.priority_reasons or [],
        "priority_breakdown": complaint.priority_breakdown or {},
        "status": complaint.status,
        "assigned_worker_id": complaint.assigned_worker_id,
        "duplicate_group": complaint.duplicate_group,
        "is_duplicate": complaint.is_duplicate,
        "merged_into_id": complaint.merged_into_id,
        "before_cleanliness": complaint.before_cleanliness,
        "after_cleanliness": complaint.after_cleanliness,
        "verification_status": complaint.verification_status,
        "verification_notes": complaint.verification_notes,
        "response_minutes": complaint.response_minutes,
        "admin_note": complaint.admin_note,
        "created_at": complaint.created_at,
        "updated_at": complaint.updated_at,
        "assigned_at": complaint.assigned_at,
        "resolved_at": complaint.resolved_at,
        "worker": worker_dict(worker) if worker else None,
        "evidence": [
            {
                "id": e.id,
                "evidence_type": e.evidence_type,
                "file_url": e.file_url,
                "note": e.note,
                "cleanliness_score": e.cleanliness_score,
                "created_at": e.created_at,
            }
            for e in sorted(complaint.evidence, key=lambda e: e.id)
        ],
        "timeline": timeline_for(complaint),
    }
    if include_location_precision:
        data["latitude"] = complaint.latitude
        data["longitude"] = complaint.longitude
    else:
        # Privacy: public/hotspot views only get a ~100 m rounded coordinate.
        data["latitude"] = round(complaint.latitude, 2)
        data["longitude"] = round(complaint.longitude, 2)
    if worker is not None:
        wlat = worker.current_latitude or WORKER_LATEST_LAT
        wlon = worker.current_longitude or WORKER_LATEST_LON
        data["distance_km"] = round(
            haversine_km(complaint.latitude, complaint.longitude, wlat, wlon), 2
        )
    else:
        data["distance_km"] = None
    return data


def pickup_dict(pickup: PickupRequest) -> dict[str, Any]:
    return {
        "id": pickup.id,
        "pickup_id": pickup.pickup_id,
        "user_id": pickup.user_id,
        "citizen_name": pickup.user.name if pickup.user else None,
        "waste_type": pickup.waste_type,
        "quantity": pickup.quantity,
        "unit": pickup.unit,
        "address": pickup.address,
        "latitude": pickup.latitude,
        "longitude": pickup.longitude,
        "ward": pickup.ward,
        "preferred_date": pickup.preferred_date,
        "preferred_time": pickup.preferred_time,
        "notes": pickup.notes,
        "photo_url": pickup.photo_url,
        "status": pickup.status,
        "assigned_worker_id": pickup.assigned_worker_id,
        "worker_name": pickup.assigned_worker.user.name if pickup.assigned_worker else None,
        "eco_points_awarded": pickup.eco_points_awarded,
        "created_at": pickup.created_at,
        "completed_at": pickup.completed_at,
        "timeline": pickup_timeline(pickup),
    }


def user_dict(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "ward": user.ward,
        "address": user.address,
        "eco_points": user.eco_points,
        "created_at": user.created_at,
    }


def eco_dict(user: User, transactions: list[EcoTransaction]) -> dict[str, Any]:
    level_name, level_number, icon, into = level_for(user.eco_points or 0)
    return {
        "eco_points": user.eco_points or 0,
        "level": level_name,
        "level_number": level_number,
        "level_icon": icon,
        "xp_into_level": into,
        "next_level": next_level(user.eco_points or 0),
        "badges": badges_for(user.eco_points or 0),
        "history": [
            {
                "id": t.id,
                "points": t.points,
                "reason": t.reason,
                "created_at": t.created_at,
            }
            for t in transactions
        ],
    }
