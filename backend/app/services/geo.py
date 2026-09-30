"""Geo helpers (Haversine + ward inference) kept dependency-free."""
from __future__ import annotations

import math
from typing import Iterable

EARTH_RADIUS_KM = 6371.0

#: Kanpur municipal reference points (used for demo seeding + ward inference).
KANPUR_CENTER = (26.4499, 80.3319)

WARD_CENTERS: dict[str, tuple[float, float]] = {
    "Cement Factory": (26.4721, 80.3545),
    "Kakadeo": (26.4520, 80.3390),
    "Barauna": (26.4300, 80.3120),
    "Amanipur": (26.4620, 80.3060),
    "Ghusanganj": (26.4400, 80.3650),
    "Kalyanpur": (26.4180, 80.3520),
    "Nausahra": (26.4850, 80.3250),
    "Kidarpur": (26.4560, 80.2880),
    "Azamgarh": (26.4050, 80.3300),
    "Colelganj": (26.4700, 80.2950),
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def nearest_ward(lat: float, lon: float) -> str:
    best_name, best_dist = "Barauna", float("inf")
    for name, (wlat, wlon) in WARD_CENTERS.items():
        dist = haversine_km(lat, lon, wlat, wlon)
        if dist < best_dist:
            best_name, best_dist = name, dist
    return best_name


def points_in_radius(
    lat: float, lon: float, radius_km: float, points: Iterable[tuple[float, float]]
) -> int:
    return sum(1 for plat, plon in points if haversine_km(lat, lon, plat, plon) <= radius_km)


def jitter(lat: float, lon: float, scale_deg: float = 0.004, seed: int = 0) -> tuple[float, float]:
    """Deterministic small offset so seeded data spreads out realistically."""
    a = math.sin(seed * 12.9898) * 43758.5453
    b = math.sin(seed * 78.233) * 12345.6789
    da = (a - math.floor(a) - 0.5) * 2 * scale_deg
    dlon = (b - math.floor(b) - 0.5) * 2 * scale_deg
    return round(lat + da, 6), round(lon + dlon, 6)
