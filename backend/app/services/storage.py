"""Secure local file storage for citizen photos and worker proof images."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from app.core.config import ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, UPLOAD_DIR

EXTENSION_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


class FileValidationError(ValueError):
    pass


@dataclass
class StoredFile:
    url: str
    filename: str
    size: int
    content_type: str
    sha256: str


def _digest(data: bytes) -> str:
    import hashlib

    return hashlib.sha256(data).hexdigest()


def store_upload(upload: UploadFile, folder: str) -> StoredFile:
    """Validate type/size, then persist under a random, non-user-controlled name."""
    if not upload.filename:
        raise FileValidationError("No file provided.")
    content_type = (upload.content_type or "").lower().split(";")[0]
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise FileValidationError(
            f"Unsupported file type '{content_type}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}"
        )
    ext = Path(upload.filename).suffix.lower()
    if ext and ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise FileValidationError("Only JPG, PNG or WEBP images are accepted.")

    data = upload.file.read()
    if not data:
        raise FileValidationError("Uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        mb = MAX_UPLOAD_BYTES / (1024 * 1024)
        raise FileValidationError(f"Image is too large. Maximum allowed size is {mb:.1f} MB.")
    if not data.startswith((b"\xff\xd8\xff", b"\x89PNG", b"RIFF")):
        raise FileValidationError("File content is not a valid image.")

    target_dir = UPLOAD_DIR / _SAFE.sub("", folder)
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{EXTENSION_BY_TYPE.get(content_type, '.jpg')}"
    path = target_dir / name
    path.write_bytes(data)

    return StoredFile(
        url=f"/media/{_SAFE.sub('', folder)}/{name}",
        filename=name,
        size=len(data),
        content_type=content_type,
        sha256=_digest(data),
    )
