"""Direct image upload endpoint (used by the report wizard and pickup form).

Validation is centralised in app.services.storage:
  * only image/jpeg, image/png, image/webp (and .jpg/.jpeg/.png/.webp)
  * size limited by MAX_UPLOAD_BYTES (default 5 MB)
  * magic-byte check so a renamed .exe cannot pass
  * files are stored under a random UUID name inside a sanitised folder
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.config import ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, UPLOAD_DIR
from app.core.deps import get_current_user
from app.models.user import User
from app.services.storage import FileValidationError, store_upload

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_FOLDERS = {"complaints", "pickups", "proof/before", "proof/after", "avatars"}


@router.get("/config")
def upload_config(_: User = Depends(get_current_user)) -> dict:
    return {
        "allowed_types": sorted(ALLOWED_IMAGE_TYPES),
        "max_bytes": MAX_UPLOAD_BYTES,
        "max_mb": round(MAX_UPLOAD_BYTES / (1024 * 1024), 1),
        "folders": sorted(ALLOWED_FOLDERS),
        "upload_dir_exists": UPLOAD_DIR.exists(),
    }


@router.post("/image")
async def upload_image(
    folder: str = Form(default="complaints"),
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
) -> dict:
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=422,
            detail=f"folder must be one of {sorted(ALLOWED_FOLDERS)}",
        )
    try:
        stored = store_upload(file, folder)
    except FileValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {
        "url": stored.url,
        "filename": stored.filename,
        "size": stored.size,
        "content_type": stored.content_type,
        "sha256": stored.sha256,
    }
