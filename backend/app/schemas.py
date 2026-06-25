"""Request/response contracts (kept separate from DB models in models.py)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import Platform, Tone


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    """Safe user representation — never includes hashed_password."""

    id: int
    email: EmailStr
    created_at: datetime


# --- Repurpose (single-shot) --------------------------------------------------


class RepurposeRequest(BaseModel):
    source_text: str = Field(min_length=30, max_length=20000)
    title: str = Field(default="Untitled", max_length=200)
    tone: Tone
    platforms: list[Platform] = Field(min_length=1)

    @field_validator("platforms")
    @classmethod
    def _dedupe_platforms(cls, v: list[Platform]) -> list[Platform]:
        # Preserve order, drop duplicates so each platform yields one output.
        seen: set[Platform] = set()
        unique = [p for p in v if not (p in seen or seen.add(p))]
        if not unique:
            raise ValueError("At least one platform is required")
        return unique


class RepurposeOutputPublic(BaseModel):
    id: int
    platform: Platform
    content: str
    created_at: datetime


class RepurposeJobPublic(BaseModel):
    id: int
    user_id: int
    title: str
    source_text: str
    tone: Tone
    created_at: datetime
    outputs: list[RepurposeOutputPublic]
