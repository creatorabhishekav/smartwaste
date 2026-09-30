"""SMART PRIORITY ENGINE - explainable scoring.

Priority Score = 40% Severity
                  20% Complaint Age
                  20% Nearby Reports
                  20% Location Factor

Every component returns a 0-100 sub-score plus a human-readable reason, so the
admin can always answer "why is this complaint at the top of the queue?".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Sequence

from app.models.enums import OPEN_STATUSES
from app.services.geo import haversine_km

WEIGHTS = {
    "severity": 0.40,
    "age": 0.20,
    "proximity": 0.20,
    "location": 0.20,
}

#: Locations where an unresolved dump carries public-health / legal risk.
SENSITIVE_KEYWORDS: dict[str, float] = {
    "hospital": 1.0,
    "medical": 1.0,
    "clinic": 0.95,
    "pharmacy": 0.9,
    "school": 0.95,
    "college": 0.9,
    "university": 0.9,
    "temple": 0.85,
    "mosque": 0.85,
    "market": 0.8,
    "bus stand": 0.8,
    "bus stop": 0.75,
    "railway": 0.85,
    "station": 0.8,
    "playground": 0.75,
    "water": 0.7,
    "sewer": 0.85,
    "drain": 0.8,
    "stp": 0.9,
    "main road": 0.8,
    "crossroad": 0.7,
    "bridge": 0.7,
    "gate": 0.6,
    "chowk": 0.7,
}

#: Wards with historically poor collection performance.
WARD_HISTORY_FACTOR: dict[str, float] = {
    "Barauna": 0.72,
    "Kidarpur": 0.66,
    "Azamgarh": 0.58,
    "Colelganj": 0.55,
    "Amanipur": 0.48,
    "Kalyanpur": 0.44,
    "Nausahra": 0.40,
    "Kakadeo": 0.36,
    "Ghusanganj": 0.32,
    "Cement Factory": 0.30,
}

SENSITIVITY_MULTIPLIER = 1.45


def priority_level_for(score: float) -> str:
    if score <= 25:
        return "LOW"
    if score <= 50:
        return "MEDIUM"
    if score <= 75:
        return "HIGH"
    return "CRITICAL"


@dataclass
class PriorityResult:
    score: float
    level: str
    reasons: list[str] = field(default_factory=list)
    breakdown: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "level": self.level,
            "reasons": self.reasons,
            "breakdown": self.breakdown,
        }


def _age_score(created_at: datetime, now: datetime) -> tuple[float, str]:
    hours = max(0.0, (now - created_at).total_seconds() / 3600.0)
    # 0h -> 0, 12h -> 33, 24h -> 50, 48h -> 75, 72h+ -> 100
    score = min(100.0, (hours / 72.0) * 100.0)
    if hours >= 48:
        reason = f"Complaint aging - open for {int(hours)}h"
    elif hours >= 24:
        reason = f"Complaint aging - open for {int(hours)}h"
    elif hours >= 8:
        reason = f"Complaint aging - open for {int(hours)}h"
    else:
        reason = f"Recently reported ({int(hours)}h ago)"
    return round(score, 1), reason


def _proximity_score(
    lat: float,
    lon: float,
    neighbours: Sequence[dict[str, Any]],
    now: datetime,
) -> tuple[float, int, str]:
    """Cluster pressure: how many open reports sit within 350 m of this point."""
    radius_km = 0.35
    nearby = 0
    for n in neighbours:
        if abs(n.get("latitude", 0) - lat) > radius_km or abs(n.get("longitude", 0) - lon) > radius_km:
            continue
        if n.get("id_placeholder") is not None and n.get("id_placeholder") == n.get("self"):
            continue
        dist = haversine_km(lat, lon, n.get("latitude", 0.0), n.get("longitude", 0.0))
        if dist <= radius_km:
            nearby += 1
    # 1 report -> 25, 2 -> 45, 3 -> 65, 4 -> 82, 5+ -> 100
    table = {0: 0.0, 1: 25.0, 2: 45.0, 3: 65.0, 4: 82.0}
    score = table.get(nearby, 100.0)
    if nearby == 0:
        reason = "Isolated report - no cluster pressure"
    elif nearby == 1:
        reason = "2 reports in the same 350 m zone"
    else:
        reason = f"Multiple nearby reports ({nearby} in the same 350 m zone)"
    return round(score, 1), nearby, reason


def _location_score(address: str, ward: str | None, waste_type: str | None) -> tuple[float, list[str]]:
    reasons: list[str] = []
    base = (WARD_HISTORY_FACTOR.get(ward or "", 0.35)) * 60.0
    lowered = (address or "").lower()
    hits = [kw for kw in SENSITIVE_KEYWORDS if kw in lowered]
    if hits:
        bonus = 40.0 * min(1.0, max(SENSITIVE_KEYWORDS[k] for k in hits))
        base += bonus
        reasons.append(f"Sensitive location ({', '.join(hits[:2])})")
    if (waste_type or "").lower() in {"hazardous", "biomedical", "e-waste"}:
        base += 12.0
        reasons.append("Hazardous / e-waste stream needs priority handling")
    if ward and WARD_HISTORY_FACTOR.get(ward, 0) >= 0.6:
        reasons.append(f"{ward} has a high repeat-offender collection rate")
    if not reasons:
        reasons.append("Standard residential zone")
    return round(min(100.0, base), 1), reasons


def compute_priority(
    *,
    severity: float,
    created_at: datetime,
    latitude: float,
    longitude: float,
    address: str,
    ward: str | None,
    waste_type: str | None = None,
    neighbours: Sequence[dict[str, Any]] | None = None,
    now: datetime | None = None,
) -> PriorityResult:
    now = now or datetime.utcnow()
    neighbours = [
        n
        for n in (neighbours or [])
        if n.get("status", ComplaintStatusOpen) in OPEN_STATUSES
    ]

    sev = round(max(0.0, min(100.0, float(severity))), 1)
    age, age_reason = _age_score(created_at, now)
    prox, nearby_count, prox_reason = _proximity_score(latitude, longitude, neighbours, now)
    loc, loc_reasons = _location_score(address, ward, waste_type)

    # Location factor is amplified when the waste type itself is hazardous.
    if (waste_type or "").lower() in {"hazardous", "biomedical", "e-waste"}:
        loc = round(min(100.0, loc * 1.0), 1)

    total = (
        WEIGHTS["severity"] * sev
        + WEIGHTS["age"] * age
        + WEIGHTS["proximity"] * prox
        + WEIGHTS["location"] * loc
    )
    score = round(max(0.0, min(100.0, total)), 0)
    level = priority_level_for(score)

    reasons: list[str] = []
    if sev >= 75:
        reasons.append(f"High severity detected by AI analysis ({int(sev)}%)")
    elif sev >= 50:
        reasons.append(f"Moderate severity from AI analysis ({int(sev)}%)")
    else:
        reasons.append(f"Low severity from AI analysis ({int(sev)}%)")
    if nearby_count >= 2:
        reasons.append(f"Multiple nearby reports ({nearby_count} in the same zone)")
    elif nearby_count == 1:
        reasons.append("One additional report in the same zone")
    if (now - created_at).total_seconds() / 3600.0 >= 24:
        reasons.append(age_reason)
    reasons.extend(loc_reasons)

    breakdown = {
        "severity": {"value": sev, "weight": WEIGHTS["severity"], "contribution": round(sev * WEIGHTS["severity"], 1)},
        "age": {"value": age, "weight": WEIGHTS["age"], "contribution": round(age * WEIGHTS["age"], 1), "label": age_reason},
        "proximity": {"value": prox, "weight": WEIGHTS["proximity"], "contribution": round(prox * WEIGHTS["proximity"], 1), "nearby_count": nearby_count},
        "location": {"value": loc, "weight": WEIGHTS["location"], "contribution": round(loc * WEIGHTS["location"], 1)},
    }

    return PriorityResult(score=score, level=level, reasons=reasons[:6], breakdown=breakdown)


ComplaintStatusOpen = "SUBMITTED"

__all__ = [
    "compute_priority",
    "priority_level_for",
    "PriorityResult",
    "WEIGHTS",
    "WARD_HISTORY_FACTOR",
    "SENSITIVE_KEYWORDS",
]
