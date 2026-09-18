from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.models import RulePack, User, RoleName, RulePackStatus, Category
from app.auth.dependencies import get_current_user, require_role
from app.audit.logger import audit
from datetime import datetime, timezone

router = APIRouter()


@router.get("")
async def list_rule_packs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(RulePack).where(RulePack.status == RulePackStatus.PUBLISHED).order_by(RulePack.effective_from.desc())
    )
    packs = result.scalars().all()
    return [
        {
            "id": p.id, "version": p.version, "category_id": p.category_id,
            "status": p.status.value, "effective_from": p.effective_from.isoformat(),
            "legal_source": p.legal_source, "gazette_ref": p.gazette_ref,
        }
        for p in packs
    ]


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Category).order_by(Category.name_en))
    categories = result.scalars().all()
    return [
        {
            "id": c.id,
            "code": c.code,
            "name_en": c.name_en,
            "name_hi": c.name_hi,
            "is_import_category": c.is_import_category,
        }
        for c in categories
    ]


@router.get("/{pack_id}")
async def get_rule_pack(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pack = await db.get(RulePack, pack_id)
    if not pack:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Rule pack not found."})
    return {
        "id": pack.id, "version": pack.version, "status": pack.status.value,
        "legal_source": pack.legal_source, "gazette_ref": pack.gazette_ref,
        "source_url": pack.source_url, "pack_json": pack.pack_json,
    }


@router.post("/{pack_id}/publish")
async def publish_rule_pack(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleName.ADMIN)),
):
    """Publish a draft rule pack. Irreversible."""
    pack = await db.get(RulePack, pack_id)
    if not pack:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Rule pack not found."})
    if pack.status == RulePackStatus.PUBLISHED:
        raise HTTPException(409, {"code": "ALREADY_PUBLISHED", "message": "Rule pack is already published."})

    pack.status = RulePackStatus.PUBLISHED
    pack.published_by = current_user.id
    pack.published_at = datetime.now(timezone.utc)
    await db.commit()
    await audit(db, current_user.id, "RULE_PACK_PUBLISHED", "rule_pack", pack_id, {"version": pack.version})
    return {"id": pack.id, "status": "PUBLISHED", "published_at": pack.published_at.isoformat()}
