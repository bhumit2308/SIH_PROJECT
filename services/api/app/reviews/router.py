from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.models import ReviewTask, Finding, User, RoleName, ReviewDecision
from app.auth.dependencies import get_current_user, require_role
from app.audit.logger import audit
from datetime import datetime, timezone

router = APIRouter()


class ReviewDecisionRequest(BaseModel):
    decision: ReviewDecision
    corrected_value: Optional[str] = None
    note: Optional[str] = None


@router.get("")
async def list_pending_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleName.INSPECTOR, RoleName.SUPERVISOR, RoleName.ADMIN)),
):
    """List pending review tasks ordered by priority."""
    result = await db.execute(
        select(ReviewTask)
        .options(selectinload(ReviewTask.finding))
        .where(ReviewTask.decision.is_(None))
        .order_by(ReviewTask.created_at.asc())
    )
    tasks = result.scalars().all()
    return [
        {
            "id": t.id,
            "finding_id": t.finding_id,
            "finding_status": t.finding.status.value if t.finding else None,
            "finding_severity": t.finding.severity.value if t.finding and t.finding.severity else None,
            "message": t.finding.message if t.finding else None,
            "field_code": t.finding.field_code if t.finding else None,
            "ai_raw_value": t.finding.ai_raw_value if t.finding else None,
            "created_at": t.created_at.isoformat(),
        }
        for t in tasks
    ]


@router.post("/{task_id}/decision")
async def submit_decision(
    task_id: str,
    payload: ReviewDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleName.INSPECTOR, RoleName.SUPERVISOR, RoleName.ADMIN)),
):
    """Accept, correct, or reject a finding. Original AI finding is preserved."""
    task = await db.get(ReviewTask, task_id)
    if not task:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Review task not found."})
    if task.decision is not None:
        raise HTTPException(409, {"code": "ALREADY_DECIDED", "message": "This review task has already been decided."})

    # Store decision — NEVER overwrite the original finding
    task.decision = payload.decision
    task.corrected_value = payload.corrected_value
    task.note = payload.note
    task.reviewer_id = current_user.id
    task.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    await audit(db, current_user.id, "REVIEW_DECISION", "review_task", task_id, {
        "decision": payload.decision.value,
        "finding_id": task.finding_id,
    })

    return {
        "id": task.id,
        "decision": task.decision.value,
        "reviewed_at": task.reviewed_at.isoformat(),
        "message": "Decision recorded. Original AI finding preserved in audit trail.",
    }
