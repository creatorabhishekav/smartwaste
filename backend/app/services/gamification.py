"""Eco points, levels and badges.

Points are only granted for *verified* outcomes, which is what stops the system
from rewarding complaint spam.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.misc import EcoTransaction
from app.models.user import User

LEVELS: list[tuple[str, int, str]] = [
    ("Seedling", 0, "🌱"),
    ("Sapphire", 120, "💧"),
    ("Bronze Guardian", 300, "🥉"),
    ("Silver Steward", 600, "🥈"),
    ("Gold Guardian", 1000, "🥇"),
    ("Green Citizen", 1500, "🌳"),
    ("Eco Champion", 2200, "🏆"),
]

AWARDS: dict[str, int] = {
    "REPORT_CREATED": 10,
    "REPORT_VERIFIED": 40,
    "PICKUP_COMPLETED": 25,
    "PICKUP_COMPLETED_LARGE": 40,
    "AWARENESS_ASKED": 5,
    "EARLY_REPORT_BONUS": 15,
    "DUPLICATE_CORRECTED": 5,
}

BADGES: list[dict[str, object]] = [
    {"name": "First Responder", "requirement": "Earn 50 XP", "icon": "🚩", "xp": 50},
    {"name": "Waste Watcher", "requirement": "Earn 200 XP", "icon": "👁️", "xp": 200},
    {"name": "Segregation Champ", "requirement": "Earn 400 XP", "icon": "♻️", "xp": 400},
    {"name": "Green Citizen", "requirement": "Earn 700 XP", "icon": "🌳", "xp": 700},
    {"name": "Ward Champion", "requirement": "Earn 1200 XP", "icon": "🏅", "xp": 1200},
    {"name": "Eco Champion", "requirement": "Earn 2000 XP", "icon": "🏆", "xp": 2000},
]


def level_for(xp: int) -> tuple[str, int, str, int]:
    """Return (level_name, level_number, icon, xp_into_level)."""
    current = LEVELS[0]
    for index, entry in enumerate(LEVELS, start=1):
        if xp >= entry[1]:
            current = entry
    return current[0], LEVELS.index(current) + 1, current[2], xp - current[1]


def next_level(xp: int) -> dict[str, object] | None:
    for entry in LEVELS:
        if xp < entry[1]:
            return {"name": entry[0], "threshold": entry[1], "icon": entry[2]}
    return None


def badges_for(xp: int) -> list[dict[str, object]]:
    unlocked = [b for b in BADGES if xp >= int(b["xp"])]
    locked = [b for b in BADGES if xp < int(b["xp"])]
    return [
        {**b, "unlocked": True} for b in unlocked
    ] + [{**b, "unlocked": False, "progress": round(xp / int(b["xp"]) * 100)} for b in locked]


def award_points(
    db: Session,
    *,
    user_id: int,
    points: int,
    reason: str,
    complaint_id: int | None = None,
) -> int:
    """Adds points (can be negative) and records the transaction. Returns new total."""
    user = db.get(User, user_id)
    if user is None:
        return 0
    user.eco_points = max(0, (user.eco_points or 0) + points)
    db.add(
        EcoTransaction(
            user_id=user_id, points=points, reason=reason, complaint_id=complaint_id
        )
    )
    return user.eco_points
