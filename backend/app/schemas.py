"""Request/response contracts (kept separate from DB models in models.py)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


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
