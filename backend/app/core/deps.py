"""Shared FastAPI dependencies: DB session, current user, role guards."""
from __future__ import annotations

from collections.abc import Iterator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise CREDENTIALS_ERROR
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc
    user_id = payload.get("sub")
    if user_id is None:
        raise CREDENTIALS_ERROR
    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise CREDENTIALS_ERROR
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Resolves a valid token when present, otherwise returns None.

    Used for endpoints that are public but render richer data for a signed-in
    user (e.g. published awareness content).
    """
    if credentials is None or not credentials.credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    user = db.get(User, int(user_id))
    return user if user is not None and user.is_active else None


def require_roles(*roles: UserRole):
    allowed = {r.value if isinstance(r, UserRole) else str(r) for r in roles}

    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(sorted(allowed))}",
            )
        return user

    return _guard


def get_db_session() -> Iterator[Session]:
    yield from get_db()
