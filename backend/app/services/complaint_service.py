"""Complaint lifecycle orchestration: create, analyse, assign, evidence, resolve."""
from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Any, Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.complaint import Assignment, Complaint, ComplaintEvent, Evidence
from app.models.enums import (
    COMPLAINT_TIMELINE,
    ComplaintStatus,
    EvidenceType,
    NotificationType,
    OPEN_STATUSES,
    UserRole,
)
from app.models.pickup import PickupEvent, PickupRequest
from app.models.user import User, Worker, utcnow
from app.services import gamification
from app.services.ai_service import ai_service
from app.services.duplicates import find_duplicate_for
from app.services.geo import haversine_km, nearest_ward
from app.services.notifications import notify, notify_role
from app.services.priority_engine import compute_priority
from app.services.verification import verification_service

STATUS_LABELS: dict[str, str] = {
    ComplaintStatus.SUBMITTED.value: "Report Submitted",
    ComplaintStatus.AI_ANALYZED.value: "AI Analysis Complete",
    ComplaintStatus.REVIEWED.value: "Admin Reviewed",
    ComplaintStatus.ASSIGNED.value: "Worker Assigned",
    ComplaintStatus.ON_THE_WAY.value: "Worker On The Way",
    ComplaintStatus.ARRIVED.value: "Worker Arrived",
    ComplaintStatus.COLLECTED.value: "Waste Collected",
    ComplaintStatus.PROOF_UPLOADED.value: "Proof Uploaded",
    ComplaintStatus.VERIFIED.value: "Before/After Verified",
    ComplaintStatus.RESOLVED.value: "Complaint Resolved",
    ComplaintStatus.REJECTED.value: "Complaint Rejected",
}

#: Legal forward-only transitions (admins may also close/reject open items).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    ComplaintStatus.SUBMITTED.value: {ComplaintStatus.AI_ANALYZED.value, ComplaintStatus.REVIEWED.value},
    ComplaintStatus.AI_ANALYZED.value: {ComplaintStatus.REVIEWED.value, ComplaintStatus.REJECTED.value},
    ComplaintStatus.REVIEWED.value: {ComplaintStatus.ASSIGNED.value, ComplaintStatus.REJECTED.value},
    ComplaintStatus.ASSIGNED.value: {ComplaintStatus.ON_THE_WAY.value, ComplaintStatus.REJECTED.value},
    ComplaintStatus.ON_THE_WAY.value: {ComplaintStatus.ARRIVED.value, ComplaintStatus.REJECTED.value},
    ComplaintStatus.ARRIVED.value: {ComplaintStatus.COLLECTED.value, ComplaintStatus.REJECTED.value},
    ComplaintStatus.COLLECTED.value: {ComplaintStatus.PROOF_UPLOADED.value, ComplaintStatus.REJECTED.value},
    ComplaintStatus.PROOF_UPLOADED.value: {ComplaintStatus.VERIFIED.value, ComplaintStatus.REJECTED.value},
    ComplaintStatus.VERIFIED.value: {ComplaintStatus.RESOLVED.value},
    ComplaintStatus.RESOLVED.value: set(),
    ComplaintStatus.REJECTED.value: set(),
}

WORKER_STATUS_FORWARD = {
    ComplaintStatus.ON_THE_WAY.value: "ON_THE_WAY",
    ComplaintStatus.ARRIVED.value: "ARRIVED",
    ComplaintStatus.COLLECTED.value: "COLLECTED",
}


def _next_complaint_ref(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"SW-{year}-"
    count = db.query(Complaint).filter(Complaint.complaint_id.like(f"{prefix}%")).count()
    for offset in range(1, 10_000):
        candidate = f"{prefix}{count + offset:04d}"
        exists = (
            db.query(Complaint.id).filter(Complaint.complaint_id == candidate).first()
        )
        if not exists:
            return candidate
    raise HTTPException(status_code=500, detail="Unable to allocate a complaint reference")


def _add_event(
    db: Session, complaint: Complaint, status_value: str, *, note: str | None = None, actor_id: int | None = None
) -> ComplaintEvent:
    event = ComplaintEvent(
        complaint_id=complaint.id,
        status=status_value,
        label=STATUS_LABELS.get(status_value, status_value.replace("_", " ").title()),
        note=note,
        actor_id=actor_id,
    )
    db.add(event)
    return event


def neighbour_context(db: Session, complaint: Complaint) -> list[dict[str, Any]]:
    """Open complaints within 600 m of this report (used for cluster pressure)."""
    from app.services.geo import haversine_km

    rows = (
        db.query(Complaint)
        .filter(Complaint.id != complaint.id, Complaint.status.in_(OPEN_STATUSES))
        .limit(500)
        .all()
    )
    nearby: list[dict[str, Any]] = []
    for c in rows:
        if haversine_km(complaint.latitude, complaint.longitude, c.latitude, c.longitude) <= 0.6:
            nearby.append(
                {
                    "id": c.id,
                    "latitude": c.latitude,
                    "longitude": c.longitude,
                    "status": c.status,
                    "category": c.category,
                }
            )
    return nearby


def refresh_neighbour_priorities(db: Session, complaint: Complaint) -> int:
    """Re-score open complaints near a new report.

    A new report in a pocket increases cluster pressure, so neighbours must be
    re-scored - this is what escalates a hotspot into the CRITICAL band.
    """
    from app.services.geo import haversine_km

    context = neighbour_context(db, complaint)
    updated = 0
    for meta in context:
        neighbour = db.get(Complaint, meta["id"])
        if neighbour is None or neighbour.status not in OPEN_STATUSES:
            continue
        result = compute_priority(
            severity=neighbour.severity,
            created_at=neighbour.created_at,
            latitude=neighbour.latitude,
            longitude=neighbour.longitude,
            address=neighbour.address,
            ward=neighbour.ward,
            waste_type=neighbour.waste_type,
            neighbours=[
                n
                for n in context
                if n["id"] != neighbour.id
                and haversine_km(
                    neighbour.latitude, neighbour.longitude, n["latitude"], n["longitude"]
                )
                <= 0.35
            ],
        )
        neighbour.priority_score = result.score
        neighbour.priority_level = result.level
        neighbour.priority_reasons = result.reasons
        neighbour.priority_breakdown = result.breakdown
        updated += 1
    db.flush()
    return updated


def run_ai_analysis(
    db: Session,
    complaint: Complaint,
    *,
    image_bytes: bytes | None = None,
    image_filename: str | None = None,
    actor_id: int | None = None,
) -> Complaint:
    """Runs AI triage and re-computes the explainable priority score."""
    analysis = ai_service.analyze_waste_image(
        image_bytes=image_bytes,
        filename=image_filename,
        category=complaint.category,
        description=complaint.description,
        context={"ward": complaint.ward, "address": complaint.address},
    )
    severity_block = ai_service.estimate_severity(
        category=complaint.category,
        analysis=analysis.to_dict(),
        address=complaint.address,
        nearby_reports=len(neighbour_context(db, complaint)),
    )

    complaint.waste_type = analysis.waste_type
    complaint.issue_type = analysis.issue_type
    complaint.severity = float(severity_block["severity"])
    complaint.detected_objects = analysis.detected_objects
    complaint.recommended_action = analysis.recommended_action
    complaint.ai_provider = analysis.provider
    complaint.ai_confidence = analysis.confidence
    complaint.ai_raw = {
        **analysis.to_dict(),
        "severity_reasoning": severity_block,
        "environmental_risk": analysis.environmental_risk,
    }

    priority = compute_priority(
        severity=complaint.severity,
        created_at=complaint.created_at,
        latitude=complaint.latitude,
        longitude=complaint.longitude,
        address=complaint.address,
        ward=complaint.ward,
        waste_type=complaint.waste_type,
        neighbours=neighbour_context(db, complaint),
    )
    complaint.priority_score = priority.score
    complaint.priority_level = priority.level
    complaint.priority_reasons = priority.reasons
    complaint.priority_breakdown = priority.breakdown

    if complaint.status == ComplaintStatus.SUBMITTED.value:
        complaint.status = ComplaintStatus.AI_ANALYZED.value
        _add_event(
            db,
            complaint,
            ComplaintStatus.AI_ANALYZED.value,
            note=f"{analysis.issue_type} - severity {int(complaint.severity)}% ({analysis.provider})",
            actor_id=actor_id,
        )
    complaint.updated_at = utcnow()
    db.flush()
    return complaint


def create_complaint(
    db: Session,
    *,
    user: User,
    category: str,
    description: str | None,
    image_url: str | None,
    image_bytes: bytes | None,
    image_filename: str | None,
    latitude: float,
    longitude: float,
    address: str,
    ward: str | None = None,
    analyze: bool = True,
) -> Complaint:
    ward = ward or user.ward or nearest_ward(latitude, longitude)
    complaint = Complaint(
        complaint_id=_next_complaint_ref(db),
        user_id=user.id,
        category=category,
        description=(description or "").strip() or None,
        image_url=image_url,
        latitude=latitude,
        longitude=longitude,
        address=address,
        ward=ward,
        status=ComplaintStatus.SUBMITTED.value,
    )
    db.add(complaint)
    db.flush()

    _add_event(db, complaint, ComplaintStatus.SUBMITTED.value, note="Citizen report received", actor_id=user.id)

    if analyze:
        run_ai_analysis(db, complaint, image_bytes=image_bytes, image_filename=image_filename, actor_id=user.id)
    else:
        priority = compute_priority(
            severity=50.0,
            created_at=complaint.created_at,
            latitude=latitude,
            longitude=longitude,
            address=address,
            ward=ward,
            neighbours=neighbour_context(db, complaint),
        )
        complaint.priority_score = priority.score
        complaint.priority_level = priority.level
        complaint.priority_reasons = priority.reasons
        complaint.priority_breakdown = priority.breakdown

    duplicate = find_duplicate_for(
        [
            c
            for c in db.query(Complaint)
            .filter(Complaint.id != complaint.id, Complaint.status.in_(OPEN_STATUSES))
            .all()
        ],
        category=category,
        latitude=latitude,
        longitude=longitude,
        description=description,
    )
    if duplicate:
        complaint.is_duplicate = True
        complaint.duplicate_group = duplicate["complaint_id"]
        notify(
            db,
            user_id=user.id,
            title="Possible duplicate report",
            message=(
                f"Your report {complaint.complaint_id} is very close to existing report "
                f"{duplicate['complaint_id']} ({duplicate['distance_meters']} m away). "
                "It has been linked so the crew handles it in a single visit."
            ),
            type_=NotificationType.WARNING.value,
            complaint_id=complaint.id,
        )

    # A new report changes cluster pressure for its neighbours, so re-score them.
    refresh_neighbour_priorities(db, complaint)

    gamification.award_points(
        db,
        user_id=user.id,
        points=gamification.AWARDS["REPORT_CREATED"],
        reason=f"Submitted waste report {complaint.complaint_id}",
        complaint_id=complaint.id,
    )

    notify_role(
        db,
        UserRole.ADMIN.value,
        title=f"New {complaint.priority_level} report {complaint.complaint_id}",
        message=f"{complaint.issue_type or category} at {complaint.address}",
        type_=NotificationType.ALERT.value if complaint.priority_level == "CRITICAL" else NotificationType.INFO.value,
        complaint_id=complaint.id,
    )
    db.flush()
    return complaint


def suggest_workers(db: Session, complaint: Complaint, limit: int = 6) -> list[dict[str, Any]]:
    workers = (
        db.query(Worker)
        .join(User, Worker.user_id == User.id)
        .filter(User.is_active.is_(True))
        .all()
    )
    scored: list[dict[str, Any]] = []
    open_load = Counter_open_load(db)
    for worker in workers:
        if worker.current_latitude and worker.current_longitude:
            distance = haversine_km(
                complaint.latitude,
                complaint.longitude,
                worker.current_latitude,
                worker.current_longitude,
            )
        else:
            base = (26.4499, 80.3319)
            distance = haversine_km(complaint.latitude, complaint.longitude, *base) + 1.5
        active = open_load.get(worker.id, 0)
        score = complaint.priority_score * 0.5 + max(0, 40 - distance * 8) * 0.3 + max(0, 20 - active * 5) * 0.2
        scored.append(
            {
                "id": worker.id,
                "name": worker.user.name if worker.user else f"Worker {worker.id}",
                "employee_code": worker.employee_code,
                "ward": worker.ward,
                "vehicle_number": worker.vehicle_number,
                "status": worker.status,
                "active_tasks": active,
                "distance_km": round(distance, 2),
                "eta_minutes": int(max(8, distance * 4 + 6)),
                "match_score": round(min(100.0, score), 1),
            }
        )
    scored.sort(key=lambda w: w["match_score"], reverse=True)
    return scored[:limit]


def Counter_open_load(db: Session) -> dict[int, int]:
    rows = (
        db.query(Complaint.assigned_worker_id, Complaint.id)
        .filter(Complaint.status.in_(OPEN_STATUSES), Complaint.assigned_worker_id.isnot(None))
        .all()
    )
    load: dict[int, int] = {}
    for worker_id, _ in rows:
        load[worker_id] = load.get(worker_id, 0) + 1
    return load


def assign_worker(
    db: Session, complaint: Complaint, worker: Worker, actor_id: int
) -> Assignment:
    if complaint.status not in {
        ComplaintStatus.AI_ANALYZED.value,
        ComplaintStatus.REVIEWED.value,
        ComplaintStatus.ASSIGNED.value,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A complaint in status {complaint.status} cannot be assigned.",
        )
    if complaint.status == ComplaintStatus.SUBMITTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run AI analysis before assigning this complaint.",
        )

    assignment = complaint.assignment
    if assignment is None:
        assignment = Assignment(complaint_id=complaint.id, worker_id=worker.id)
        db.add(assignment)
    assignment.worker_id = worker.id
    assignment.assigned_by_id = actor_id
    assignment.status = ComplaintStatus.ASSIGNED.value
    assignment.assigned_at = utcnow()

    distance = None
    if worker.current_latitude and worker.current_longitude:
        distance = round(
            haversine_km(
                complaint.latitude,
                complaint.longitude,
                worker.current_latitude,
                worker.current_longitude,
            ),
            2,
        )
    assignment.distance_km = distance
    assignment.eta_minutes = int(max(8, (distance or 1.8) * 4 + 6))

    complaint.assigned_worker_id = worker.id
    complaint.assigned_at = utcnow()
    if complaint.response_minutes is None:
        complaint.response_minutes = round(
            (utcnow() - complaint.created_at).total_seconds() / 60.0, 1
        )
    if complaint.status in {ComplaintStatus.AI_ANALYZED.value, ComplaintStatus.REVIEWED.value}:
        if complaint.status == ComplaintStatus.AI_ANALYZED.value:
            _add_event(db, complaint, ComplaintStatus.REVIEWED.value, note="Reviewed by admin", actor_id=actor_id)
        complaint.status = ComplaintStatus.ASSIGNED.value
        _add_event(
            db,
            complaint,
            ComplaintStatus.ASSIGNED.value,
            note=f"Assigned to {worker.user.name if worker.user else worker.employee_code} ({assignment.eta_minutes} min ETA)",
            actor_id=actor_id,
        )
    worker.total_assigned = (worker.total_assigned or 0) + 1
    worker.status = "BUSY"

    notify(
        db,
        user_id=complaint.user_id,
        title=f"Worker assigned to {complaint.complaint_id}",
        message=f"{worker.user.name if worker.user else 'A crew'} has been assigned and will arrive in about {assignment.eta_minutes} minutes.",
        type_=NotificationType.INFO.value,
        complaint_id=complaint.id,
    )
    notify(
        db,
        user_id=worker.user_id,
        title=f"New task {complaint.complaint_id}",
        message=f"{complaint.issue_type or complaint.category} - {complaint.address} ({complaint.priority_level})",
        type_=NotificationType.ALERT.value if complaint.priority_level == "CRITICAL" else NotificationType.INFO.value,
        complaint_id=complaint.id,
    )
    db.flush()
    return assignment


def worker_transition(
    db: Session, complaint: Complaint, worker: Worker, target_status: str
) -> Complaint:
    """Worker-driven forward transition with assignment timestamps."""
    if target_status not in ALLOWED_TRANSITIONS.get(complaint.status, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot move {complaint.status} -> {target_status}.",
        )
    now = utcnow()
    assignment = complaint.assignment
    if assignment is not None:
        if target_status == ComplaintStatus.ON_THE_WAY.value:
            assignment.on_way_at = now
        elif target_status == ComplaintStatus.ARRIVED.value:
            assignment.arrived_at = now
        elif target_status == ComplaintStatus.COLLECTED.value:
            assignment.collected_at = now
        assignment.status = target_status

    complaint.status = target_status
    note = {
        ComplaintStatus.ON_THE_WAY.value: f"{worker.user.name if worker.user else 'Crew'} is on the way",
        ComplaintStatus.ARRIVED.value: "Crew arrived on site",
        ComplaintStatus.COLLECTED.value: "Waste collected",
    }.get(target_status)
    _add_event(db, complaint, target_status, note=note, actor_id=worker.user_id)

    citizen_messages = {
        ComplaintStatus.ON_THE_WAY.value: "Worker is on the way to your location.",
        ComplaintStatus.ARRIVED.value: "The collection crew has arrived on site.",
        ComplaintStatus.COLLECTED.value: "Waste collection completed. Proof is being uploaded.",
    }
    if target_status in citizen_messages:
        notify(
            db,
            user_id=complaint.user_id,
            title=f"{complaint.complaint_id}: {STATUS_LABELS[target_status]}",
            message=citizen_messages[target_status],
            type_=NotificationType.INFO.value,
            complaint_id=complaint.id,
        )
    db.flush()
    return complaint


def add_evidence(
    db: Session,
    complaint: Complaint,
    *,
    evidence_type: str,
    url: str,
    uploaded_by_id: int,
    note: str | None = None,
    cleanliness: float | None = None,
) -> Evidence:
    evidence = Evidence(
        complaint_id=complaint.id,
        evidence_type=evidence_type,
        file_url=url,
        uploaded_by_id=uploaded_by_id,
        note=note,
        cleanliness_score=cleanliness,
    )
    db.add(evidence)
    db.flush()
    return evidence


def finalize_with_evidence(
    db: Session,
    complaint: Complaint,
    *,
    before_url: str,
    after_url: str,
    before_bytes: bytes | None,
    after_bytes: bytes | None,
    before_filename: str | None,
    after_filename: str | None,
    worker: Worker,
    note: str | None = None,
) -> dict[str, Any]:
    """Uploads before/after proof, runs verification, and closes the loop."""
    result = verification_service.verify(
        before_bytes=before_bytes,
        after_bytes=after_bytes,
        before_filename=before_filename,
        after_filename=after_filename,
        complaint_category=complaint.category,
    )

    add_evidence(
        db,
        complaint,
        evidence_type=EvidenceType.BEFORE.value,
        url=before_url,
        uploaded_by_id=worker.user_id,
        note="Before collection",
        cleanliness=result.before_score,
    )
    add_evidence(
        db,
        complaint,
        evidence_type=EvidenceType.AFTER.value,
        url=after_url,
        uploaded_by_id=worker.user_id,
        note=note or "After collection",
        cleanliness=result.after_score,
    )

    if complaint.status == ComplaintStatus.COLLECTED.value:
        complaint.status = ComplaintStatus.PROOF_UPLOADED.value
        _add_event(
            db,
            complaint,
            ComplaintStatus.PROOF_UPLOADED.value,
            note=f"Before/after proof uploaded by {worker.user.name if worker.user else 'crew'}",
            actor_id=worker.user_id,
        )

    complaint.before_cleanliness = result.before_score
    complaint.after_cleanliness = result.after_score
    complaint.verification_status = result.status
    complaint.verification_notes = result.notes

    if result.status == "VERIFIED":
        complaint.status = ComplaintStatus.VERIFIED.value
        _add_event(
            db,
            complaint,
            ComplaintStatus.VERIFIED.value,
            note=f"Cleanliness improved {result.improvement} points ({result.before_score} -> {result.after_score})",
            actor_id=worker.user_id,
        )
        complaint.status = ComplaintStatus.RESOLVED.value
        complaint.resolved_at = utcnow()
        _add_event(
            db,
            complaint,
            ComplaintStatus.RESOLVED.value,
            note="Complaint closed and citizen notified",
            actor_id=worker.user_id,
        )
        gamification.award_points(
            db,
            user_id=complaint.user_id,
            points=gamification.AWARDS["REPORT_VERIFIED"],
            reason=f"Verified resolution of {complaint.complaint_id}",
            complaint_id=complaint.id,
        )
        if complaint.assignment:
            complaint.assignment.completed_at = utcnow()
            complaint.assignment.status = ComplaintStatus.RESOLVED.value
        worker.total_completed = (worker.total_completed or 0) + 1
        if worker.total_assigned:
            worker.average_resolution_minutes = round(
                (
                    (complaint.resolved_at - complaint.created_at).total_seconds() / 60.0
                    + (worker.average_resolution_minutes or 0)
                )
                / 2,
                1,
            )
        worker.status = "AVAILABLE"
        notify(
            db,
            user_id=complaint.user_id,
            title=f"Complaint {complaint.complaint_id} resolved",
            message=f"Verified clean. Eco points awarded. Thank you for keeping the city clean!",
            type_=NotificationType.SUCCESS.value,
            complaint_id=complaint.id,
        )
        notify_role(
            db,
            UserRole.ADMIN.value,
            title=f"{complaint.complaint_id} verified and resolved",
            message=f"Cleanliness {result.before_score}% -> {result.after_score}%.",
            type_=NotificationType.SUCCESS.value,
            complaint_id=complaint.id,
        )
    else:
        complaint.status = ComplaintStatus.VERIFIED.value if result.status == "NEEDS_REVIEW" else ComplaintStatus.PROOF_UPLOADED.value
        notify(
            db,
            user_id=complaint.user_id,
            title=f"{complaint.complaint_id}: proof under review",
            message=result.notes,
            type_=NotificationType.WARNING.value,
            complaint_id=complaint.id,
        )
        notify_role(
            db,
            UserRole.ADMIN.value,
            title=f"{complaint.complaint_id} needs review",
            message=result.notes,
            type_=NotificationType.WARNING.value,
            complaint_id=complaint.id,
        )
    db.flush()
    return result.to_dict()


def admin_set_status(
    db: Session, complaint: Complaint, target_status: str, actor_id: int, note: str | None = None
) -> Complaint:
    if target_status not in STATUS_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown status '{target_status}'.")
    if target_status == complaint.status:
        return complaint
    if target_status in {ComplaintStatus.RESOLVED.value, ComplaintStatus.REJECTED.value}:
        if target_status == ComplaintStatus.RESOLVED.value and not complaint.after_cleanliness:
            raise HTTPException(
                status_code=400,
                detail="Auto-resolve requires before/after evidence. Upload proof or mark as reviewed first.",
            )
    if complaint.status in {ComplaintStatus.RESOLVED.value, ComplaintStatus.REJECTED.value}:
        raise HTTPException(status_code=400, detail="Closed complaints cannot be reopened.")

    complaint.status = target_status
    _add_event(db, complaint, target_status, note=note, actor_id=actor_id)
    if target_status in {ComplaintStatus.RESOLVED.value, ComplaintStatus.REJECTED.value}:
        complaint.resolved_at = utcnow()
    if target_status == ComplaintStatus.REVIEWED.value and complaint.response_minutes is None:
        complaint.response_minutes = round(
            (utcnow() - complaint.created_at).total_seconds() / 60.0, 1
        )
    notify(
        db,
        user_id=complaint.user_id,
        title=f"{complaint.complaint_id}: {STATUS_LABELS[target_status]}",
        message=note or f"Status updated to {STATUS_LABELS[target_status]}.",
        type_=NotificationType.SUCCESS.value if target_status == ComplaintStatus.RESOLVED.value else NotificationType.INFO.value,
        complaint_id=complaint.id,
    )
    db.flush()
    return complaint


def timeline_for(complaint: Complaint) -> list[dict[str, Any]]:
    events = {e.status: e for e in complaint.events}
    timeline: list[dict[str, Any]] = []
    for stage in COMPLAINT_TIMELINE:
        event = events.get(stage)
        timeline.append(
            {
                "status": stage,
                "label": STATUS_LABELS[stage],
                "completed": event is not None,
                "timestamp": event.created_at.isoformat() if event else None,
                "note": event.note if event else None,
            }
        )
    if complaint.status == ComplaintStatus.REJECTED.value:
        event = events.get(ComplaintStatus.REJECTED.value)
        timeline.append(
            {
                "status": ComplaintStatus.REJECTED.value,
                "label": STATUS_LABELS[ComplaintStatus.REJECTED.value],
                "completed": event is not None,
                "timestamp": event.created_at.isoformat() if event else None,
                "note": event.note if event else None,
            }
        )
    return timeline


def merge_duplicate(db: Session, primary: Complaint, duplicates: Sequence[Complaint], actor_id: int) -> Complaint:
    for dup in duplicates:
        dup.is_duplicate = True
        dup.merged_into_id = primary.id
        dup.duplicate_group = primary.complaint_id
        db.add(
            ComplaintEvent(
                complaint_id=dup.id,
                status=dup.status,
                label="Merged into " + primary.complaint_id,
                note="Grouped by admin as a duplicate hotspot report",
                actor_id=actor_id,
            )
        )
        notify(
            db,
            user_id=dup.user_id,
            title=f"Report {dup.complaint_id} merged",
            message=f"An admin grouped your report with {primary.complaint_id} as the same issue. You will be notified when it is resolved.",
            type_=NotificationType.INFO.value,
            complaint_id=primary.id,
        )
    db.flush()
    return primary
