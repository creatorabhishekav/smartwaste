"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

try:  # pydantic-settings is optional in the hackathon environment
    from pydantic_settings import BaseSettings, SettingsConfigDict

    _HAS_PYDANTIC_SETTINGS = True
except Exception:  # pragma: no cover
    _HAS_PYDANTIC_SETTINGS = False


BASE_DIR = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


if _HAS_PYDANTIC_SETTINGS:

    class Settings(BaseSettings):
        app_name: str = "SmartWaste 360 API"
        environment: str = "development"
        api_prefix: str = ""
        # PostgreSQL in production, SQLite fallback for zero-config local demos.
        database_url: str = f"sqlite:///{(BASE_DIR / 'smartwaste.db').as_posix()}"
        # Dev-only default. Production must set JWT_SECRET (>= 32 chars).
        jwt_secret: str = "smartwaste-360-dev-secret-change-me-in-production"
        jwt_algorithm: str = "HS256"
        access_token_expire_minutes: int = 60 * 24 * 7
        cors_origins: str = "*"

        upload_dir: str = str(BASE_DIR / "media")
        max_upload_bytes: int = 5 * 1024 * 1024
        allowed_image_types: str = "image/jpeg,image/png,image/webp,image/jpg"

        gemini_api_key: str | None = None
        gemini_model: str = "gemini-2.0-flash"
        ai_provider: str = "auto"  # auto | gemini | demo
        verify_service_url: str = ""

        seed_on_startup: bool = True

        model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    @lru_cache
    def get_settings() -> Settings:
        return Settings()

else:  # pragma: no cover - fallback when pydantic-settings is unavailable
    class Settings:  # type: ignore[no-redef]
        def __init__(self) -> None:
            self.app_name = os.getenv("APP_NAME", "SmartWaste 360 API")
            self.environment = os.getenv("ENVIRONMENT", "development")
            self.api_prefix = os.getenv("API_PREFIX", "")
            self.database_url = os.getenv(
                "DATABASE_URL", f"sqlite:///{(BASE_DIR / 'smartwaste.db').as_posix()}"
            )
            self.jwt_secret = os.getenv(
                "JWT_SECRET", "smartwaste-360-dev-secret-change-me-in-production"
            )
            self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
            self.access_token_expire_minutes = int(
                os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7))
            )
            self.cors_origins = os.getenv("CORS_ORIGINS", "*")
            self.upload_dir = os.getenv("UPLOAD_DIR", str(BASE_DIR / "media"))
            self.max_upload_bytes = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
            self.allowed_image_types = os.getenv(
                "ALLOWED_IMAGE_TYPES", "image/jpeg,image/png,image/webp,image/jpg"
            )
            self.gemini_api_key = os.getenv("GEMINI_API_KEY")
            self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
            self.ai_provider = os.getenv("AI_PROVIDER", "auto")
            self.verify_service_url = os.getenv("VERIFY_SERVICE_URL", "")
            self.seed_on_startup = os.getenv("SEED_ON_STARTUP", "true").lower() in {
                "1",
                "true",
                "yes",
            }

    @lru_cache
    def get_settings() -> Settings:  # type: ignore[misc]
        return Settings()


settings = get_settings()

UPLOAD_DIR = Path(settings.upload_dir)
try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError as _upload_dir_error:  # pragma: no cover - unwritable volume
    # Uploads are a non-essential service: log and keep the API importable so
    # /health, /docs and the OpenAPI schema stay available.
    import logging

    logging.getLogger("smartwaste").warning(
        "UPLOAD_DIR %s is not writable (%s). The API will start; image upload "
        "endpoints will fail until UPLOAD_DIR points at a writable path.",
        UPLOAD_DIR,
        _upload_dir_error,
    )

ALLOWED_IMAGE_TYPES = {
    t.strip() for t in settings.allowed_image_types.split(",") if t.strip()
}
MAX_UPLOAD_BYTES = settings.max_upload_bytes
