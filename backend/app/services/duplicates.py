"""Duplicate / hotspot clustering.

Complaints are clustered on a 250 m grid per category within a 72 h window.
Clusters with 3+ members become named hotspot groups (HOTSPOT-01, ...).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Sequence

from app.models.complaint import Complaint
from app.services.geo import haversine_km

CLUSTER_RADIUS_KM = 0.25
CLUSTER_WINDOW_HOURS = 72
MIN_CLUSTER_SIZE = 2


def find_duplicate_for(
    db_complaints: Sequence[Complaint],
    *,
    category: str,
    latitude: float,
    longitude: float,
    description: str | None,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    """Return the best matching open complaint, or None."""
    now = now or datetime.utcnow()
    window_start = now - timedelta(hours=CLUSTER_WINDOW_HOURS)
    words = {w for w in (description or "").lower().split() if len(w) > 4}

    best: dict[str, Any] | None = None
    best_score = 0.0
    for c in db_complaints:
        if c.created_at < window_start:
            continue
        distance = haversine_km(latitude, longitude, c.latitude, c.longitude)
        if distance > CLUSTER_RADIUS_KM:
            continue
        same_category = c.category == category
        other_words = {w for w in (c.description or "").lower().split() if len(w) > 4}
        overlap = len(words & other_words) / max(1, len(words | other_words))
        score = (0.6 if same_category else 0.0) + (1 - distance / CLUSTER_RADIUS_KM) * 0.25 + overlap * 0.15
        if score > best_score:
            best_score = score
            best = {
                "complaint_id": c.complaint_id,
                "id": c.id,
                "distance_meters": round(distance * 1000),
                "score": round(score, 2),
                "same_category": same_category,
                "description_overlap": round(overlap, 2),
            }
    if best and best_score >= 0.6:
        return best
    return None


def cluster_complaints(complaints: Sequence[Complaint]) -> list[dict[str, Any]]:
    """Greedy spatial clustering; returns hotspot groups ordered by volume."""
    groups: list[dict[str, Any]] = []
    for complaint in sorted(complaints, key=lambda c: c.created_at):
        placed = False
        for group in groups:
            distance = haversine_km(
                complaint.latitude, complaint.longitude, group["latitude"], group["longitude"]
            )
            if (
                distance <= CLUSTER_RADIUS_KM
                and group["category"] == complaint.category
            ):
                group["members"].append(complaint)
                # centroid update keeps the marker visually centred
                n = len(group["members"])
                group["latitude"] = round(
                    sum(m.latitude for m in group["members"]) / n, 6
                )
                group["longitude"] = round(
                    sum(m.longitude for m in group["members"]) / n, 6
                )
                placed = True
                break
        if not placed:
            groups.append(
                {
                    "category": complaint.category,
                    "latitude": complaint.latitude,
                    "longitude": complaint.longitude,
                    "ward": complaint.ward,
                    "members": [complaint],
                }
            )

    groups = [g for g in groups if len(g["members"]) >= MIN_CLUSTER_SIZE]
    groups.sort(key=lambda g: len(g["members"]), reverse=True)

    output: list[dict[str, Any]] = []
    for index, group in enumerate(groups, start=1):
        members: list[Complaint] = group["members"]
        categories: dict[str, int] = defaultdict(int)
        for m in members:
            categories[m.category] += 1
        top_category = max(categories, key=lambda k: categories[k])
        critical = sum(1 for m in members if m.priority_level == "CRITICAL")
        open_count = sum(1 for m in members if m.status not in {"RESOLVED", "REJECTED"})
        output.append(
            {
                "code": f"HOTSPOT-{index}",
                "label": f"{group['ward'] or 'Kanpur'} - {top_category.replace('_', ' ').title()}",
                "ward": group["ward"],
                "latitude": group["latitude"],
                "longitude": group["longitude"],
                "complaint_count": len(members),
                "critical_count": critical,
                "open_count": open_count,
                "top_issue": top_category.replace("_", " ").title(),
                "recommended_action": _recommend(top_category, len(members), critical),
                "intensity": round(min(1.0, len(members) / 10.0), 2),
                "member_ids": [m.complaint_id for m in members],
                "member_refs": [m.id for m in members],
            }
        )
    return output


def _recommend(category: str, count: int, critical: int) -> str:
    if critical >= 2:
        return "Deploy a dedicated rapid-response team within 6 hours."
    if category == "ILLEGAL_DUMPING":
        return "Install CCTV at the dumping point and schedule a heavy vehicle within 24h."
    if category == "MISSED_COLLECTION":
        return "Re-route the collection schedule and audit the missed ward trip."
    if category == "IMPROPER_SEGREGATION":
        return "Run a segregation awareness drive with the RWAs in this pocket."
    if count >= 4:
        return "Add this location to the daily route as a fixed stop."
    return "Schedule a collection visit and post a closure notice."
