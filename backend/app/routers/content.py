"""Content routes: single-shot repurpose."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.auth import get_current_user
from app.database import get_session
from app.llm import repurpose_for_platform
from app.models import RepurposeJob, RepurposeOutput, User
from app.schemas import RepurposeJobPublic, RepurposeRequest

logger = logging.getLogger("echo")

router = APIRouter(prefix="/api", tags=["content"])


@router.post(
    "/repurpose",
    response_model=RepurposeJobPublic,
    status_code=status.HTTP_201_CREATED,
)
def repurpose(
    body: RepurposeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RepurposeJob:
    """Create a job owned by the user, generate one output per platform, save, return."""
    assert current_user.id is not None
    job = RepurposeJob(
        user_id=current_user.id,
        title=body.title,
        source_text=body.source_text,
        tone=body.tone,
    )
    try:
        session.add(job)
        session.flush()  # assign job.id without committing
        assert job.id is not None
        for platform in body.platforms:
            content = repurpose_for_platform(
                body.source_text, body.title, body.tone, platform
            )
            session.add(
                RepurposeOutput(job_id=job.id, platform=platform, content=content)
            )
        session.commit()
        session.refresh(job)
    except Exception:
        session.rollback()
        logger.exception("Repurpose failed for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate content. Please try again.",
        )
    return job
