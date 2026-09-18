import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.models import AuditLog
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def audit(
    db: AsyncSession,
    actor_id: str | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
):
    """Write an immutable audit event. Never raises — audit failure must not break the main flow."""
    try:
        log = AuditLog(
            id=str(uuid.uuid4()),
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata or {},
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc),
        )
        db.add(log)
        await db.flush()
        logger.debug(f"AUDIT | {action} | {entity_type}:{entity_id} | actor:{actor_id}")
    except Exception as e:
        logger.error(f"Failed to write audit log [{action}]: {e}")
