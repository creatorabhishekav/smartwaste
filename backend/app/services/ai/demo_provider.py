"""Deterministic offline AI provider.

Used whenever GEMINI_API_KEY is missing, invalid, or the remote call fails, so the
full demo workflow (report -> analyse -> prioritise -> resolve) never breaks.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

from app.services.ai.base import AIProvider, AwarenessAnswer, WasteAnalysis

CATEGORY_PROFILES: dict[str, dict[str, Any]] = {
    "OVERFLOWING_BIN": {
        "waste_type": "Mixed Waste",
        "issue_type": "Overflowing Garbage Bin",
        "objects": ["Garbage Bags", "Plastic", "Paper", "Organic Waste"],
        "action": "Immediate waste collection and bin sanitisation.",
        "risk": "HIGH",
    },
    "GARBAGE_ON_ROAD": {
        "waste_type": "Mixed Waste",
        "issue_type": "Garbage Piled On Road",
        "objects": ["Plastic Bottles", "Paper Waste", "Food Leftovers"],
        "action": "Deploy a collection vehicle and clear the road corridor.",
        "risk": "HIGH",
    },
    "ILLEGAL_DUMPING": {
        "waste_type": "Mixed / Debris",
        "issue_type": "Illegal Dumping",
        "objects": ["Construction Debris", "Plastic Sheets", "Mixed Waste"],
        "action": "Inspect, fine the dumper and schedule a heavy vehicle within 24h.",
        "risk": "CRITICAL",
    },
    "MISSED_COLLECTION": {
        "waste_type": "Household Waste",
        "issue_type": "Missed Collection",
        "objects": ["Household Bins", "Uncollected Bags"],
        "action": "Re-route the missed collection vehicle to this ward today.",
        "risk": "MEDIUM",
    },
    "IMPROPER_SEGREGATION": {
        "waste_type": "Contaminated Mixed Waste",
        "issue_type": "Improper Segregation",
        "objects": ["Wet + Dry Mixed", "Recyclables", "Sanitary Waste"],
        "action": "Awareness visit plus re-segregation before processing.",
        "risk": "MEDIUM",
    },
    "OTHER": {
        "waste_type": "Unclassified Waste",
        "issue_type": "Other Waste Issue",
        "objects": ["Unidentified Objects"],
        "action": "Manual inspection by a supervisor and disposal routing.",
        "risk": "MEDIUM",
    },
}

SENSITIVE_KEYWORDS = (
    "hospital",
    "medical",
    "school",
    "college",
    "temple",
    "mosque",
    "market",
    "railway",
    "bus stop",
    "bus stand",
    "water",
    "sewer",
    "stp",
    "pharmacy",
    "playground",
    "gate",
    "main road",
    "crossroad",
    "bridge",
    "chowk",
)

WASTE_KEYWORD_MAP: list[tuple[tuple[str, ...], str, str, bool]] = [
    (("battery", "batteries", "cell", "lithium"), "E-Waste", "E-Waste bin (red)", False),
    (("laptop", "mobile", "phone", "charger", "television", "tv", "monitor"), "E-Waste", "E-Waste bin (red)", False),
    (("glass", "bottle glass"), "Glass", "Glass / Dry recyclable bin", True),
    (("paper", "newspaper", "carton", "cardboard", "notes"), "Paper", "Dry recyclable bin (blue)", True),
    (("plastic", "bottle", "wrapper", "packet", "polythene"), "Plastic", "Dry recyclable bin (blue)", True),
    (("food", "vegetable", "fruit", "leftover", "kitchen", "wet"), "Wet Waste", "Wet waste bin (green)", True),
    (("medical", "syringe", "bandage", "blood", "mask", "sanitary"), "Biomedical / Hazardous", "Hazardous waste (yellow) - authorised centre", False),
    (("paint", "chemical", "oil", "industrial", "solvent"), "Hazardous Waste", "Hazardous waste (yellow) - authorised centre", False),
]

DISPOSAL_LIBRARY: dict[str, dict[str, Any]] = {
    "e-waste": {
        "category": "E-Waste",
        "bin": "E-Waste / Red hazardous bin",
        "recyclable": False,
        "steps": [
            "Remove personal data from devices before handing them over.",
            "Drop the item at a certified collection centre or authorised vendor.",
            "Never burn or bury e-waste - heavy metals contaminate soil and water.",
        ],
        "hazard": "Contains lead, mercury and lithium - never place in household wet waste.",
    },
    "wet waste": {
        "category": "Wet / Organic",
        "bin": "Wet waste bin (green)",
        "recyclable": True,
        "steps": [
            "Drain excess water and remove plastic wrappers.",
            "Compost at home or hand it to the wet-waste collector in a sealed bag.",
            "Avoid mixing with sanitary waste which contaminates compost.",
        ],
        "hazard": "Wet waste left open for more than 24 hours starts fermenting and breeds flies.",
    },
    "plastic": {
        "category": "Dry Recyclable",
        "bin": "Dry recyclable bin (blue)",
        "recyclable": True,
        "steps": [
            "Rinse and dry the plastic so it is not rejected at the recycling unit.",
            "Flatten containers to save collection space.",
            "Carry reusable bottles and bags to reduce single-use plastic.",
        ],
        "hazard": "Single-use plastic bags block drains and are a common cause of road-side dumping.",
    },
    "paper": {
        "category": "Dry Recyclable",
        "bin": "Dry recyclable bin (blue)",
        "recyclable": True,
        "steps": [
            "Remove food/oil stains - soiled paper goes to wet waste.",
            "Bundle newspapers and cartons flat to keep them dry.",
            "Tear confidential documents before disposal.",
        ],
        "hazard": "Wet paper in dry waste can ruin an entire recyclable batch.",
    },
    "glass": {
        "category": "Dry Recyclable",
        "bin": "Glass drop-off / Dry recyclable bin",
        "recyclable": True,
        "steps": [
            "Drain liquids and remove caps and labels.",
            "Deliver to a glass recycler or authorised kiosk - never to a mixed bin.",
            "Wrap broken glass in paper and mark it before disposal.",
        ],
        "hazard": "Broken glass is an injury hazard on collection roads.",
    },
    "hazardous": {
        "category": "Hazardous",
        "bin": "Hazardous / Yellow bin - authorised centre only",
        "recyclable": False,
        "steps": [
            "Do not mix with household waste or drain liquids into the sewer.",
            "Store sealed in a cool, shaded place and hand over within 48 hours.",
            "Contact the municipal hazardous waste helpline for a scheduled pickup.",
        ],
        "hazard": "Direct skin contact with hazardous material can cause burns or infections.",
    },
    "biomedical": {
        "category": "Biomedical / Hazardous",
        "bin": "Yellow biomedical waste bin",
        "recyclable": False,
        "steps": [
            "Place used sharps only in a puncture-proof container.",
            "Never mix biomedical waste with general or wet waste.",
            "Handover to an authorised biomedical waste handler for incineration.",
        ],
        "hazard": "Improperly discarded medical waste spreads blood-borne infections.",
    },
    "general": {
        "category": "General (Non-recyclable)",
        "bin": "Dry non-recyclable bin (grey)",
        "recyclable": False,
        "steps": [
            "Segregate anything recyclable before using the general bin.",
            "Tie the bag before it reaches the bin to avoid street scattering.",
            "Report overflowing bins through SmartWaste 360 if collection is missed.",
        ],
        "hazard": "Inert waste still occupies landfill volume and generates methane.",
    },
}


class DemoAIProvider(AIProvider):
    """Offline, fully deterministic provider - no network, no API key."""

    name = "demo"

    def _signature(self, image_bytes: bytes | None, filename: str | None) -> int:
        raw = (filename or "").encode("utf-8")
        if image_bytes:
            raw += image_bytes[:4096] + str(len(image_bytes)).encode("utf-8")
        return int(hashlib.sha256(raw).hexdigest()[:8], 16)

    def analyze_waste_image(
        self,
        *,
        image_bytes: bytes | None,
        filename: str | None,
        category: str,
        description: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> WasteAnalysis:
        profile = CATEGORY_PROFILES.get(category, CATEGORY_PROFILES["OTHER"])
        sig = self._signature(image_bytes, filename)
        # Deterministic spread in the 45-88 band so severity stays believable.
        severity = 45 + (sig % 44)
        if category == "ILLEGAL_DUMPING":
            severity = min(97, severity + 7)
        if category == "MISSED_COLLECTION":
            severity = max(32, severity - 15)
        if category == "IMPROPER_SEGREGATION":
            severity = max(40, severity - 7)
        if category == "OTHER":
            severity = max(35, severity - 5)
        # Text hints nudging the deterministic base.
        text = (description or "").lower()
        if any(word in text for word in ("smell", "flies", "stink", "spread", "flood", "monsoon")):
            severity = min(99, severity + 5)
        if any(word in text for word in ("slight", "minor", "small amount", "little")):
            severity = max(28, severity - 12)

        priority = self.severity_to_priority(severity)
        risk = profile["risk"]
        objects = list(profile["objects"])
        if "plastic" in text and "Plastic" not in objects:
            objects.append("Plastic")
        if "medical" in text or "hospital" in text:
            objects.append("Medical Waste")

        return WasteAnalysis(
            waste_type=self._refine_waste_type(profile["waste_type"], text),
            issue_type=profile["issue_type"],
            severity=float(severity),
            priority_hint=priority,
            detected_objects=objects,
            recommended_action=profile["action"],
            confidence=round(0.72 + (sig % 21) / 100, 2),
            provider=self.name,
            environmental_risk=risk,
            description_summary=(
                (description or "").strip()[:180] or profile["issue_type"]
            ),
            raw={
                "engine": "smartwaste-demo-v1",
                "signature": f"{sig:08x}",
                "method": "deterministic-offline",
                "context": context or {},
            },
        )

    def classify_waste(self, text: str, category: str | None = None) -> dict[str, Any]:
        lowered = (text or "").lower()
        for keywords, waste_type, bin_colour, recyclable in WASTE_KEYWORD_MAP:
            if any(k in lowered for k in keywords):
                return {
                    "waste_type": waste_type,
                    "bin_colour": bin_colour,
                    "recyclable": recyclable,
                    "confidence": 0.86,
                    "provider": self.name,
                }
        fallback = CATEGORY_PROFILES.get(category or "OTHER", CATEGORY_PROFILES["OTHER"])
        return {
            "waste_type": fallback["waste_type"],
            "bin_colour": "Dry recyclable bin (blue) if clean, else wet waste bin (green)",
            "recyclable": False,
            "confidence": 0.55,
            "provider": self.name,
        }

    def estimate_severity(
        self,
        *,
        category: str,
        analysis: dict[str, Any] | None = None,
        address: str | None = None,
        nearby_reports: int = 0,
    ) -> dict[str, Any]:
        base = float((analysis or {}).get("severity") or 0.0)
        if base <= 0:
            profile = CATEGORY_PROFILES.get(category, CATEGORY_PROFILES["OTHER"])
            base = {"ILLEGAL_DUMPING": 82, "OVERFLOWING_BIN": 74}.get(category, 58)
        factors: list[str] = []
        score = base
        if nearby_reports >= 3:
            score += min(10, nearby_reports * 2)
            factors.append(f"{nearby_reports} reports already logged nearby")
        sensitive = [k for k in SENSITIVE_KEYWORDS if address and k in address.lower()]
        if sensitive:
            score += 8
            factors.append(f"sensitive location ({', '.join(sensitive[:2])})")
        score = max(5, min(100, score))
        return {
            "severity": round(score, 1),
            "priority_hint": self.severity_to_priority(score),
            "factors": factors or ["baseline severity from image analysis"],
            "provider": self.name,
        }

    def generate_awareness_answer(self, question: str) -> AwarenessAnswer:
        lowered = (question or "").lower()
        if not lowered.strip():
            key = "general"
        else:
            key = "general"
            best = 0
            for candidate, library_key in (
                ("battery", "e-waste"),
                ("laptop", "e-waste"),
                ("phone", "e-waste"),
                ("electronic", "e-waste"),
                ("food", "wet waste"),
                ("kitchen", "wet waste"),
                ("vegetable", "wet waste"),
                ("plastic", "plastic"),
                ("bottle", "plastic"),
                ("newspaper", "paper"),
                ("paper", "paper"),
                ("carton", "paper"),
                ("glass", "glass"),
                ("syringe", "biomedical"),
                ("medicine", "biomedical"),
                ("medical", "biomedical"),
                ("paint", "hazardous"),
                ("chemical", "hazardous"),
                ("oil", "hazardous"),
            ):
                if candidate in lowered and len(candidate) > best:
                    key = library_key
                    best = len(candidate)
        entry = DISPOSAL_LIBRARY[key]
        answer = (
            f"{entry['category']} waste should go into the {entry['bin'].lower()}. "
            f"{entry['steps'][0]} {entry['hazard']}"
        )
        return AwarenessAnswer(
            answer=answer,
            category=entry["category"],
            bin_colour=entry["bin"],
            recyclable=bool(entry["recyclable"]),
            steps=list(entry["steps"]),
            hazard_note=entry["hazard"],
            provider=self.name,
        )

    # -- helpers -----------------------------------------------------------
    @staticmethod
    def severity_to_priority(severity: float) -> str:
        if severity <= 25:
            return "LOW"
        if severity <= 50:
            return "MEDIUM"
        if severity <= 75:
            return "HIGH"
        return "CRITICAL"

    @staticmethod
    def _refine_waste_type(base: str, text: str) -> str:
        for keywords, waste_type, _bin, _rec in WASTE_KEYWORD_MAP:
            if any(k in text for k in keywords):
                return waste_type
        return base
