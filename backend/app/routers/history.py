"""History routes: per-user list of past jobs, detail view, and delete."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import RepurposeJob, User
from app.schemas import RepurposeJobPublic, RepurposeJobSummary

logger = logging.getLogger("echo")

router = APIRouter(prefix="/api/history", tags=["history"])


def _owned_job_or_404(job_id: int, user: User, session: Session) -> RepurposeJob:
    """Load a job and ensure the caller owns it; same 404 for missing or foreign
    so ownership is never leaked."""
    job = session.get(RepurposeJob, job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
        )
    return job


@router.get("", response_model=list[RepurposeJobSummary])
def list_history(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[RepurposeJobSummary]:
    """Return the user's jobs as lightweight summaries, newest first."""
    jobs = session.exec(
        select(RepurposeJob)
        .where(RepurposeJob.user_id == current_user.id)
        .order_by(RepurposeJob.created_at.desc())
    ).all()
    return [
        RepurposeJobSummary(
            id=job.id,
            title=job.title,
            tone=job.tone,
            created_at=job.created_at,
            platform_count=len(job.outputs),
        )
        for job in jobs
    ]


@router.get("/{job_id}", response_model=RepurposeJobPublic)
def get_history_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RepurposeJob:
    """Return one full job with its outputs; 404 if missing or not owned."""
    return _owned_job_or_404(job_id, current_user, session)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Delete a job (outputs cascade); 404 if missing or not owned."""
    job = _owned_job_or_404(job_id, current_user, session)
    session.delete(job)
    session.commit()
