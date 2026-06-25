"""Auth primitives: password hashing, JWT issue/decode, current-user dependency.

Guardrails honored here:
- bcrypt has a 72-byte password limit; we truncate defensively before hashing.
- Emails are normalized to lowercase on both store and lookup.
- Token failures raise a generic 401 — no exception detail is leaked to clients.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models import User

# tokenUrl is relative to the server root; matches the login route below.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

_BCRYPT_MAX_BYTES = 72

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _truncate(password: str) -> bytes:
    """Encode and truncate to bcrypt's 72-byte limit."""
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_truncate(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_truncate(password), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Decode the JWT and load the user, or raise 401 on any failure."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        subject = payload.get("sub")
        if subject is None:
            raise _CREDENTIALS_EXCEPTION
        user_id = int(subject)
    except (jwt.InvalidTokenError, ValueError):
        raise _CREDENTIALS_EXCEPTION

    user = session.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_EXCEPTION
    return user


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.exec(
        select(User).where(User.email == normalize_email(email))
    ).first()
