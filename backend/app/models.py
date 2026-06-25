"""SQLModel database tables.

A user has many RepurposeJobs; a job has many RepurposeOutputs (one per platform).
Children cascade-delete with their parent (handled on the relationship and FK).

NOTE: do NOT add ``from __future__ import annotations`` here. With it, SQLModel
hands SQLAlchemy the raw annotation string (e.g. ``list['RepurposeOutput']``) for
relationships, which fails mapper configuration on SQLAlchemy 2.x. Native 3.11
``X | None`` syntax works without the import.
"""
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, Relationship, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Platform(str, Enum):
    twitter = "twitter"
    linkedin = "linkedin"
    instagram = "instagram"
    newsletter = "newsletter"


class Tone(str, Enum):
    professional = "professional"
    casual = "casual"
    witty = "witty"
    bold = "bold"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    # Stored lowercased; unique + indexed for fast case-insensitive lookup.
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=_utcnow)


class RepurposeJob(SQLModel, table=True):
    __tablename__ = "repurpose_jobs"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(default="Untitled")
    source_text: str
    tone: Tone
    created_at: datetime = Field(default_factory=_utcnow)

    outputs: list["RepurposeOutput"] = Relationship(
        back_populates="job",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class RepurposeOutput(SQLModel, table=True):
    __tablename__ = "repurpose_outputs"

    id: int | None = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="repurpose_jobs.id", index=True)
    platform: Platform
    content: str
    created_at: datetime = Field(default_factory=_utcnow)

    job: RepurposeJob | None = Relationship(back_populates="outputs")
