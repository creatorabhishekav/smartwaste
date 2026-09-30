"""SQLAlchemy engine/session wiring.

PostgreSQL is used when DATABASE_URL points at it; otherwise a local SQLite file
keeps the hackathon demo zero-configuration.

Schema creation is *lazy and retryable*: `ensure_schema()` is safe to call on every
request, does nothing once the schema exists, and reports failure instead of raising
during application startup. That keeps the API process alive even when the database
is unreachable.
"""
from __future__ import annotations

import logging
import threading
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger("smartwaste.db")

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    pass


_schema_lock = threading.Lock()
_schema_ready: bool = False
last_error: str | None = None


def ensure_schema(force: bool = False) -> tuple[bool, str | None]:
    """Create tables if needed. Returns (ready, error). Never raises.

    Called once at startup (best effort) and lazily on the first DB request, so a
    database that comes back online later is picked up without a restart.
    """
    global _schema_ready, last_error
    if _schema_ready and not force:
        return True, None
    with _schema_lock:
        if _schema_ready and not force:
            return True, None
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as exc:  # noqa: BLE001 - reported, never fatal
            last_error = f"{exc.__class__.__name__}: {exc}"
            _schema_ready = False
            return False, last_error
        _schema_ready = True
        last_error = None
        return True, None


def database_status() -> tuple[str, str | None]:
    """(status, error) without raising. 'ok' or 'unavailable: ...'."""
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        return f"unavailable: {exc.__class__.__name__}", str(exc)
    return "ok", None


def get_db() -> Iterator[Session]:
    ready, error = ensure_schema()
    if not ready:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=503,
            detail=(
                "Database is not reachable, so this endpoint cannot run yet. "
                f"({error}) The API process is healthy - /health and /docs still work. "
                "Start the database or unset DATABASE_URL to use the SQLite fallback, "
                "then retry: the schema is created automatically on the next request."
            ),
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
