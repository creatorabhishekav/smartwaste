"""Before / after verification service.

The default implementation is a deterministic demo analyser (no computer-vision
dependency) that scores cleanliness from image metadata. The interface is
intentionally narrow so a real CV model (e.g. a segmentation or
"trash-detection" YOLO variant) can be dropped in by implementing
`VerificationProvider.verify`.
"""
from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import Any

import httpx

from app.core.config import settings


@dataclass
class VerificationResult:
    before_score: float  # 0-100 (higher = cleaner)
    after_score: float
    improvement: float
    status: str  # VERIFIED | NEEDS_REVIEW | REJECTED
    confidence: float
    provider: str
    notes: str
    metrics: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class VerificationProvider(ABC):
    name: str = "base"

    @abstractmethod
    def verify(
        self,
        *,
        before_bytes: bytes | None,
        after_bytes: bytes | None,
        before_filename: str | None,
        after_filename: str | None,
        complaint_category: str,
    ) -> VerificationResult: ...


class DemoVerificationProvider(VerificationProvider):
    """Deterministic stand-in for a real computer-vision cleanliness model."""

    name = "demo-cv"

    def _seed(self, data: bytes | None, filename: str | None) -> int:
        raw = (filename or "").encode()
        if data:
            raw += data[:2048] + str(len(data)).encode()
        return int(hashlib.sha256(raw).hexdigest()[:8], 16)

    def verify(
        self,
        *,
        before_bytes: bytes | None,
        after_bytes: bytes | None,
        before_filename: str | None,
        after_filename: str | None,
        complaint_category: str,
    ) -> VerificationResult:
        b_seed = self._seed(before_bytes, before_filename)
        a_seed = self._seed(after_bytes, after_filename)

        # Pre-clean photos are dominated by waste -> low cleanliness score.
        before = round(18 + (b_seed % 22), 1)  # 18-40
        after = round(78 + (a_seed % 20), 1)  # 78-98
        improvement = round(after - before, 1)

        if improvement >= 25:
            status = "VERIFIED"
            notes = "Clear visible improvement between before and after evidence."
        elif improvement >= 10:
            status = "NEEDS_REVIEW"
            notes = "Partial improvement - admin verification recommended."
        else:
            status = "REJECTED"
            notes = "No measurable improvement. Proof rejected and task re-queued."

        metrics = {
            "waste_coverage_before_pct": round(100 - before, 1),
            "waste_coverage_after_pct": round(100 - after, 1),
            "bin_area_occupied_before": round((100 - before) / 100, 2),
            "bin_area_occupied_after": round((100 - after) / 100, 2),
            "model": "smartwaste-demo-cv-v1",
            "category": complaint_category,
        }
        return VerificationResult(
            before_score=before,
            after_score=after,
            improvement=improvement,
            status=status,
            confidence=round(0.7 + (a_seed % 25) / 100, 2),
            provider=self.name,
            notes=notes,
            metrics=metrics,
        )


class RemoteVerificationProvider(VerificationProvider):
    """Optional hook: POSTs the two images to a CV microservice if configured.

    Enable with VERIFY_SERVICE_URL. Falls back to the demo provider on failure.
    """

    name = "remote-cv"

    def __init__(self, url: str | None = None) -> None:
        self.url = url or ""
        self._fallback = DemoVerificationProvider()

    def verify(
        self,
        *,
        before_bytes: bytes | None,
        after_bytes: bytes | None,
        before_filename: str | None,
        after_filename: str | None,
        complaint_category: str,
    ) -> VerificationResult:
        if not self.url:
            return self._fallback.verify(
                before_bytes=before_bytes,
                after_bytes=after_bytes,
                before_filename=before_filename,
                after_filename=after_filename,
                complaint_category=complaint_category,
            )
        try:
            import base64

            payload = {
                "before": base64.b64encode(before_bytes or b"").decode(),
                "after": base64.b64encode(after_bytes or b"").decode(),
                "category": complaint_category,
            }
            with httpx.Client(timeout=30) as client:
                resp = client.post(self.url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            return VerificationResult(
                before_score=float(data.get("before_score", 0)),
                after_score=float(data.get("after_score", 0)),
                improvement=float(data.get("improvement", 0)),
                status=str(data.get("status", "NEEDS_REVIEW")),
                confidence=float(data.get("confidence", 0.5)),
                provider=self.name,
                notes=str(data.get("notes", "")),
                metrics=data.get("metrics", {}),
            )
        except Exception as exc:
            result = self._fallback.verify(
                before_bytes=before_bytes,
                after_bytes=after_bytes,
                before_filename=before_filename,
                after_filename=after_filename,
                complaint_category=complaint_category,
            )
            result.notes = f"{result.notes} (remote CV unavailable: {exc})"
            return result


def get_verification_provider() -> VerificationProvider:
    url = getattr(settings, "verify_service_url", "") or ""
    return RemoteVerificationProvider(url) if url else DemoVerificationProvider()


verification_service = get_verification_provider()

__all__ = [
    "VerificationResult",
    "VerificationProvider",
    "DemoVerificationProvider",
    "RemoteVerificationProvider",
    "get_verification_provider",
    "verification_service",
]
