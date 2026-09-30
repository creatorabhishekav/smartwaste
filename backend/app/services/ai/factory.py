"""Provider selection: Gemini when configured, deterministic demo otherwise."""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.ai.base import AIProvider, AwarenessAnswer, WasteAnalysis
from app.services.ai.demo_provider import DemoAIProvider
from app.services.ai.gemini_provider import GeminiAIProvider


@lru_cache(maxsize=1)
def get_provider() -> AIProvider:
    pref = (settings.ai_provider or "auto").lower()
    if pref == "demo":
        return DemoAIProvider()
    if settings.gemini_api_key:
        return GeminiAIProvider()
    return DemoAIProvider()


def provider_status() -> dict[str, str | bool]:
    provider = get_provider()
    return {
        "provider": provider.name,
        "model": getattr(provider, "model", "deterministic-v1"),
        "live_ai": bool(settings.gemini_api_key),
        "api_key_configured": bool(settings.gemini_api_key),
    }


__all__ = [
    "AIProvider",
    "AwarenessAnswer",
    "WasteAnalysis",
    "get_provider",
    "provider_status",
    "DemoAIProvider",
    "GeminiAIProvider",
]
