"""Abstract contract for every AI provider used by SmartWaste 360."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class WasteAnalysis:
    """Normalised result returned by any provider (Gemini or demo)."""

    waste_type: str
    issue_type: str
    severity: float  # 0-100
    priority_hint: str
    detected_objects: list[str] = field(default_factory=list)
    recommended_action: str = ""
    confidence: float = 0.0
    provider: str = "demo"
    environmental_risk: str = "MEDIUM"
    description_summary: str = ""
    raw: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AwarenessAnswer:
    answer: str
    category: str
    bin_colour: str
    recyclable: bool
    steps: list[str] = field(default_factory=list)
    hazard_note: str = ""
    provider: str = "demo"


class AIProvider(ABC):
    """Every provider must implement these four capabilities."""

    name: str = "base"

    @abstractmethod
    def analyze_waste_image(
        self,
        *,
        image_bytes: bytes | None,
        filename: str | None,
        category: str,
        description: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> WasteAnalysis:
        """Full image understanding: waste type, issue, severity, objects, action."""

    @abstractmethod
    def classify_waste(self, text: str, category: str | None = None) -> dict[str, Any]:
        """Text based waste classification."""

    @abstractmethod
    def estimate_severity(
        self,
        *,
        category: str,
        analysis: dict[str, Any] | None = None,
        address: str | None = None,
        nearby_reports: int = 0,
    ) -> dict[str, Any]:
        """Return severity, priority hint and the reasoning behind them."""

    @abstractmethod
    def generate_awareness_answer(self, question: str) -> AwarenessAnswer:
        """Answer citizen questions about responsible disposal."""
