"""SmartWaste 360 - FastAPI application entry point."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOAD_DIR, settings
from app.database.session import database_status, ensure_schema
from app.routers import (
    admin,
    analytics,
    auth,
    awareness,
    complaints,
    hotspots,
    notifications,
    pickups,
    uploads,
    workers,
)
from app.services.ai import provider_status
from app.services.verification import get_verification_provider

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("smartwaste")

DESCRIPTION = """
**SmartWaste 360** - AI-assisted waste management for cities, campuses and societies.

`Report -> AI analysis -> explainable priority -> admin queue -> worker assignment ->
collection -> before/after verification -> resolved -> analytics`
"""

app = FastAPI(
    title=settings.app_name,
    description=DESCRIPTION,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")] or ["*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(complaints.router)
app.include_router(pickups.router)
app.include_router(workers.router)
app.include_router(admin.router)
app.include_router(analytics.router)
app.include_router(hotspots.router)
app.include_router(notifications.router)
app.include_router(awareness.router)
app.include_router(uploads.router)

if UPLOAD_DIR.is_dir():
    app.mount("/media", StaticFiles(directory=str(UPLOAD_DIR)), name="media")
else:  # pragma: no cover - unwritable/absent upload volume must not break startup
    logger.warning(
        "Upload directory %s is unavailable - /media is not mounted. "
        "Image endpoints will return an error, the rest of the API is unaffected.",
        UPLOAD_DIR,
    )


@app.on_event("startup")
def on_startup() -> None:
    """Startup is deliberately lightweight and never fatal.

    Schema creation is best-effort: a database outage degrades the data endpoints
    to HTTP 503, but the process stays alive so /, /health, /docs and /openapi.json
    keep answering. Seeding and hot-path AI calls are explicit/on-demand.
    """
    # 1. Schema - best effort, retried lazily on the first DB request.
    ready, error = ensure_schema()
    if ready:
        logger.info("Database ready: %s", settings.database_url.split("://")[0])
    else:
        logger.error(
            "DATABASE NOT READY (%s) - the API will still start and serve "
            "/, /health and /docs. Data endpoints return HTTP 503 until the "
            "database is reachable. Fix by either (a) creating the database and "
            "setting DATABASE_URL (e.g. postgresql+psycopg2://user:pass@"
            "localhost:5432/smartwaste), or (b) unsetting DATABASE_URL to use the "
            "local SQLite fallback. Details: %s",
            settings.database_url.split("://")[0],
            error,
        )

    # 2. Optional demo seed. Explicit, non-fatal, and skipped entirely when the
    #    database is unavailable so startup never blocks on it.
    if settings.seed_on_startup and ready:
        from app.database.seed_data import seed_demo_data
        from app.database.session import SessionLocal

        try:
            with SessionLocal() as db:
                result = seed_demo_data(db)
            if result.get("skipped"):
                logger.info("Demo data already present - skipping seed.")
            else:
                logger.info("Seeded demo data: %s", result)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "SEED FAILED (app still running): %s\n"
                "The database is reachable but demo rows could not be written. "
                "Run `python -m app.seed --force` from the backend folder once the "
                "issue is fixed. Auth and the API will keep working without demo data.",
                exc,
            )
    elif settings.seed_on_startup and not ready:
        logger.warning("Skipping demo seed because the database is not reachable.")

    logger.info("AI provider: %s", provider_status())
    if settings.environment != "production" and "dev-secret" in settings.jwt_secret:
        logger.warning(
            "JWT_SECRET is using the built-in development default. "
            "Set a unique JWT_SECRET in .env before deploying."
        )
    if not settings.gemini_api_key:
        logger.info(
            "GEMINI_API_KEY not set - using the deterministic DEMO AI provider. "
            "The full workflow still runs; add a key to enable live Gemini vision."
        )


@app.get("/health", tags=["system"])
def health() -> dict:
    """Liveness probe.

    Always answers HTTP 200 with status 'ok' when the process is alive, even if the
    database, Gemini or the upload service are unavailable - which is exactly the
    state a browser reports as 'Cannot connect to API: other side closed'.
    """
    database, database_error = database_status()
    return {
        "status": "ok",
        "service": "SmartWaste 360 API",
        "message": "SmartWaste 360 API",
        "database": database,
        "database_error": database_error,
        "ai": provider_status(),
        "verification": get_verification_provider().name,
    }


@app.get("/", tags=["system"])
def root() -> dict:
    return {
        "message": "SmartWaste 360 API",
        "service": "SmartWaste 360 API",
        "status": "running",
        "tagline": "Report. Prioritize. Resolve. Keep Your City Clean.",
        "docs": "/docs",
        "endpoints": [
            "POST /auth/register",
            "POST /auth/login",
            "POST /auth/demo-login",
            "GET  /auth/me",
            "POST /complaints",
            "POST /complaints/preview-analysis",
            "GET  /complaints",
            "GET  /complaints/{id}",
            "PATCH /complaints/{id}",
            "POST /complaints/{id}/analyze",
            "POST /complaints/{id}/assign",
            "POST /complaints/{id}/status",
            "POST /complaints/{id}/evidence",
            "POST /complaints/{id}/proof",
            "POST /complaints/merge",
            "POST /pickup-requests",
            "GET  /pickup-requests",
            "GET  /workers",
            "GET  /workers/me/dashboard",
            "PATCH /workers/{id}",
            "GET  /admin/overview",
            "GET  /admin/priority-queue",
            "GET  /admin/duplicates",
            "GET  /analytics",
            "GET  /analytics/impact",
            "GET  /hotspots",
            "GET  /notifications",
            "GET  /awareness",
            "POST /awareness/ask",
        ],
    }
