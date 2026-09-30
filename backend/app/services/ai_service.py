"""Public `aiService` facade used by the routers.

Exposes the four capabilities required by the product spec:
    analyzeWasteImage / classifyWaste / estimateSeverity / generateAwarenessAnswer
(snake_case Python names plus camelCase aliases for parity with the frontend API).
"""
from __future__ import annotations

from typing import Any

from app.services.ai.base import AwarenessAnswer, WasteAnalysis
from app.services.ai.factory import get_provider, provider_status


class AIService:
    def __init__(self, provider: Any | None = None) -> None:
        self._provider = provider

    @property
    def provider(self) -> Any:
        return self._provider or get_provider()

    # -- capabilities ------------------------------------------------------
    def analyze_waste_image(
        self,
        *,
        image_bytes: bytes | None = None,
        filename: str | None = None,
        category: str = "OTHER",
        description: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> WasteAnalysis:
        return self.provider.analyze_waste_image(
            image_bytes=image_bytes,
            filename=filename,
            category=category,
            description=description,
            context=context,
        )

    def classify_waste(self, text: str, category: str | None = None) -> dict[str, Any]:
        return self.provider.classify_waste(text, category)

    def estimate_severity(
        self,
        *,
        category: str,
        analysis: dict[str, Any] | None = None,
        address: str | None = None,
        nearby_reports: int = 0,
    ) -> dict[str, Any]:
        return self.provider.estimate_severity(
            category=category, analysis=analysis, address=address, nearby_reports=nearby_reports
        )

    def generate_awareness_answer(self, question: str) -> AwarenessAnswer:
        return self.provider.generate_awareness_answer(question)

    def status(self) -> dict[str, str | bool]:
        return provider_status()

    # -- camelCase aliases (API parity with the documented service contract) --
    analyzeWasteImage = analyze_waste_image
    classifyWaste = classify_waste
    estimateSeverity = estimate_severity
    generateAwarenessAnswer = generate_awareness_answer


ai_service = AIService()

__all__ = ["AIService", "ai_service", "AwarenessAnswer", "WasteAnalysis"]
