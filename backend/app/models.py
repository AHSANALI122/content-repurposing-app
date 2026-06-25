"""SQLModel database tables.

Only the User table exists for Feature 1 (auth). RepurposeJob / RepurposeOutput
and the Platform / Tone enums arrive with Feature 2 — a user has many jobs
(cascade delete) at that point.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    # Stored lowercased; unique + indexed for fast case-insensitive lookup.
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=_utcnow)
