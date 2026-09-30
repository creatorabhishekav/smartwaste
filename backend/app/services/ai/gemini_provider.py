"""Gemini (Google Generative Language API) provider.

The key is only ever read from the environment (GEMINI_API_KEY). The provider is
written with httpx so no extra SDK dependency is required for the demo.
"""
from __future__ import annotations

import base64
import json
import re
from typing import Any

import httpx

from app.core.config import settings
from app.services.ai.base import AIProvider, AwarenessAnswer, WasteAnalysis
from app.services.ai.demo_provider import DemoAIProvider

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

VISION_PROMPT = """
You are the waste-analysis engine of SmartWaste 360, a municipal waste platform.
Analyse the attached citizen photo of a waste issue and reply with STRICT JSON only:
{
  "waste_type": "e.g. Mixed Waste / Wet Waste / Dry Waste / E-Waste / Hazardous",
  "issue_type": "short issue label, e.g. Overflowing Garbage Bin",
  "severity": integer 0-100 where 90+ is a public-health hazard,
  "detected_objects": ["up to 6 short object labels"],
  "recommended_action": "one operational sentence for a municipal crew",
  "environmental_risk": "LOW | MEDIUM | HIGH | CRITICAL",
  "confidence": number 0-1,
  "description_summary": "one sentence describing what the image shows"
}
No markdown, no explanation outside the JSON.
"""

AWARENESS_PROMPT = """
You are Waste AI, the responsible-disposal assistant for an Indian city.
Answer the citizen question with STRICT JSON only:
{
  "answer": "2 sentence direct answer",
  "category": "waste category",
  "bin_colour": "which bin to use",
  "recyclable": true/false,
  "steps": ["3 short steps"],
  "hazard_note": "one safety warning"
}
No markdown, no text outside the JSON.
"""


class GeminiAIProvider(AIProvider):
    """Talks to the Gemini REST API. Falls back to demo on any failure."""

    name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or settings.gemini_api_key
        self.model = model or settings.gemini_model
        self._fallback = DemoAIProvider()

    # -- transport ---------------------------------------------------------
    def _generate_json(
        self, prompt: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg"
    ) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        parts: list[dict[str, Any]] = [{"text": prompt}]
        if image_bytes:
            encoded = base64.b64encode(image_bytes).decode("ascii")
            parts.append(
                {"inline_data": {"mime_type": mime_type, "data": encoded}}
            )
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 700},
        }
        url = ENDPOINT.format(model=self.model)
        with httpx.Client(timeout=25) as client:
            response = client.post(
                url,
                params={"key": self.api_key},
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()
        text = (
            data["candidates"][0]["content"]["parts"][0].get("text", "")
            if data.get("candidates")
            else ""
        )
        return self._extract_json(text)

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        cleaned = re.sub(r"```(?:json)?", "", text).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, re.S)
            if match:
                return json.loads(match.group(0))
            raise ValueError("Model response did not contain JSON")

    # -- capabilities ------------------------------------------------------
    def analyze_waste_image(
        self,
        *,
        image_bytes: bytes | None,
        filename: str | None,
        category: str,
        description: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> WasteAnalysis:
        prompt = VISION_PROMPT
        if description:
            prompt += f"\nCitizen description: {description[:400]}"
        if category:
            prompt += f"\nCitizen selected category: {category}"
        try:
            data = self._generate_json(prompt, image_bytes)
            severity = max(0.0, min(100.0, float(data.get("severity", 60))))
            return WasteAnalysis(
                waste_type=str(data.get("waste_type", "Mixed Waste")),
                issue_type=str(data.get("issue_type", "Waste Issue")),
                severity=round(severity, 1),
                priority_hint=self._fallback.severity_to_priority(severity),
                detected_objects=[str(o) for o in (data.get("detected_objects") or [])][:6],
                recommended_action=str(
                    data.get("recommended_action", "Schedule a collection visit.")
                ),
                confidence=float(data.get("confidence", 0.8) or 0.8),
                provider=self.name,
                environmental_risk=str(data.get("environmental_risk", "MEDIUM")),
                description_summary=str(
                    data.get("description_summary", description or "")
                ),
                raw={"model": self.model, "context": context or {}},
            )
        except Exception as exc:  # network error, quota, bad JSON -> demo
            fallback = self._fallback.analyze_waste_image(
                image_bytes=image_bytes,
                filename=filename,
                category=category,
                description=description,
                context={**(context or {}), "gemini_error": str(exc)},
            )
            fallback.raw["fallback_reason"] = str(exc)
            return fallback

    def classify_waste(self, text: str, category: str | None = None) -> dict[str, Any]:
        try:
            data = self._generate_json(
                f"{AWARENESS_PROMPT}\nWaste item to classify: {text[:300]}"
            )
            return {
                "waste_type": str(data.get("category", "Mixed Waste")),
                "bin_colour": str(data.get("bin_colour", "Dry recyclable bin (blue)")),
                "recyclable": bool(data.get("recyclable", False)),
                "confidence": 0.9,
                "provider": self.name,
            }
        except Exception:
            return self._fallback.classify_waste(text, category)

    def estimate_severity(
        self,
        *,
        category: str,
        analysis: dict[str, Any] | None = None,
        address: str | None = None,
        nearby_reports: int = 0,
    ) -> dict[str, Any]:
        prompt = (
            "You triage municipal waste complaints. Reply with STRICT JSON: "
            '{"severity": int 0-100, "priority_hint": "LOW|MEDIUM|HIGH|CRITICAL", '
            '"factors": ["short reason"]}. '
            f"Category: {category}. Address: {address}. "
            f"Nearby open reports: {nearby_reports}. "
            f"Image analysis: {json.dumps(analysis or {})[:600]}"
        )
        try:
            data = self._generate_json(prompt)
            severity = max(0.0, min(100.0, float(data.get("severity", 60))))
            return {
                "severity": round(severity, 1),
                "priority_hint": str(data.get("priority_hint", "HIGH")),
                "factors": [str(f) for f in (data.get("factors") or [])][:5],
                "provider": self.name,
            }
        except Exception as exc:
            result = self._fallback.estimate_severity(
                category=category, analysis=analysis, address=address, nearby_reports=nearby_reports
            )
            result["fallback_reason"] = str(exc)
            return result

    def generate_awareness_answer(self, question: str) -> AwarenessAnswer:
        try:
            data = self._generate_json(f"{AWARENESS_PROMPT}\nCitizen question: {question[:400]}")
            return AwarenessAnswer(
                answer=str(data.get("answer", ""))[:800],
                category=str(data.get("category", "General")),
                bin_colour=str(data.get("bin_colour", "Dry non-recyclable bin")),
                recyclable=bool(data.get("recyclable", False)),
                steps=[str(s) for s in (data.get("steps") or [])][:5],
                hazard_note=str(data.get("hazard_note", "")),
                provider=self.name,
            )
        except Exception as exc:
            answer = self._fallback.generate_awareness_answer(question)
            answer.hazard_note = f"{answer.hazard_note}"
            answer.steps = answer.steps
            setattr(answer, "raw_error", str(exc))
            return answer
