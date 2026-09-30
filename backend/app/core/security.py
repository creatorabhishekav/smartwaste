"""Password hashing and JWT helpers."""
from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings

try:  # passlib+bcrypt is preferred, but a hardened fallback keeps the demo runnable
    from passlib.context import CryptContext

    _pwd_context: Any = CryptContext(schemes=["bcrypt"], deprecated="auto")
except Exception:  # pragma: no cover
    _pwd_context = None

_PBKDF2_ROUNDS = 260_000


def hash_password(password: str) -> str:
    if _pwd_context is not None:
        try:
            return _pwd_context.hash(password)
        except Exception:
            pass
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    if hashed.startswith("pbkdf2_sha256$"):
        try:
            _, rounds, salt_hex, digest_hex = hashed.split("$")
            digest = hashlib.pbkdf2_hmac(
                "sha256", plain.encode(), bytes.fromhex(salt_hex), int(rounds)
            )
            return hmac.compare_digest(digest.hex(), digest_hex)
        except Exception:
            return False
    if _pwd_context is not None:
        try:
            return bool(_pwd_context.verify(plain, hashed))
        except Exception:
            return False
    return False


def create_access_token(subject: str, role: str, expires_minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
