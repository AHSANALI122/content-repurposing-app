"""Agent routes: autonomous (tool-calling) repurpose."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.agent import run_agent
from app.auth import get_current_user
from app.database import get_session
from app.models import RepurposeJob, RepurposeOutput, User
from app.schemas import AgentRepurposeRequest, AgentRepurposeResponse

logger = logging.getLogger("echo")

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post(
    "/repurpose",
    response_model=AgentRepurposeResponse,
    status_code=status.HTTP_201_CREATED,
)
def agent_repurpose(
    body: AgentRepurposeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Run the agent, then persist the result as a user-owned job."""
    assert current_user.id is not None

    if not body.url and not body.source_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a URL or source text.",
        )

    # Run the agent loop outside the DB transaction so a fetch/LLM failure never
    # leaves a half-written job behind.
    try:
        outputs, trace = run_agent(
            body.url, body.source_text, body.title, body.tone, body.platforms
        )
    except Exception:
        logger.exception("Agent run failed for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The agent failed to generate content. Please try again.",
        )

    if not outputs:
        logger.warning("Agent produced no outputs for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The agent did not produce any content. Please try again.",
        )

    # For URL input, record a marker as the source so History stays readable.
    stored_source = f"(from URL) {body.url}" if body.url else (body.source_text or "")

    job = RepurposeJob(
        user_id=current_user.id,
        title=body.title,
        source_text=stored_source,
        tone=body.tone,
    )
    try:
        session.add(job)
        session.flush()  # assign job.id without committing
        assert job.id is not None
        for platform, content in outputs:
            session.add(
                RepurposeOutput(job_id=job.id, platform=platform, content=content)
            )
        session.commit()
        session.refresh(job)
    except Exception:
        session.rollback()
        logger.exception("Saving agent job failed for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to save the generated content. Please try again.",
        )

    # response_model=AgentRepurposeResponse converts the ORM job (from_attributes).
    return {"job": job, "trace": trace}
