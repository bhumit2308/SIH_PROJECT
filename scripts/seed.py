"""
METRA Database Seed Script
==========================
Creates:
  - 4 roles (INSPECTOR, SUPERVISOR, MANUFACTURER, ADMIN)
  - 4 product categories
  - 4 rule packs (loaded from JSON files in packages/rules/packs/)
  - 4 demo users (one per role)

Run: python scripts/seed.py
"""
import asyncio
import json
import uuid
import os
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Add services/api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "api"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.models import (
    Role, RoleName, Category, RulePack, Rule, User, UserRole,
    RulePackStatus, UserStatus
)
from datetime import datetime, timezone


CATEGORIES = [
    {"code": "packaged_food", "name_en": "Packaged Food", "name_hi": "पैकेज्ड खाद्य पदार्थ", "is_import_category": False},
    {"code": "personal_care", "name_en": "Personal Care / Cosmetics", "name_hi": "व्यक्तिगत देखभाल", "is_import_category": False},
    {"code": "household", "name_en": "Household Products", "name_hi": "घरेलू उत्पाद", "is_import_category": False},
    {"code": "imported_consumer", "name_en": "Imported Consumer Products", "name_hi": "आयातित उत्पाद", "is_import_category": True},
]

DEMO_USERS = [
    {"email": "inspector@metra.demo", "full_name": "Rajesh Kumar (Inspector)", "role": RoleName.INSPECTOR},
    {"email": "supervisor@metra.demo", "full_name": "Priya Sharma (Supervisor)", "role": RoleName.SUPERVISOR},
    {"email": "manufacturer@metra.demo", "full_name": "Arjun Patel (Manufacturer)", "role": RoleName.MANUFACTURER},
    {"email": "admin@metra.demo", "full_name": "System Admin", "role": RoleName.ADMIN},
]

PACKS_DIR = Path(__file__).parent.parent / "packages" / "rules" / "packs"


async def seed():
    print("🌱 METRA Seed Script Starting...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created/verified")

    async with AsyncSessionLocal() as db:
        # ── Roles ─────────────────────────────────────────
        role_map = {}
        for role_name in RoleName:
            from sqlalchemy import select
            existing = await db.execute(select(Role).where(Role.name == role_name))
            role = existing.scalar_one_or_none()
            if not role:
                role = Role(id=str(uuid.uuid4()), name=role_name)
                db.add(role)
                print(f"  ➕ Role: {role_name.value}")
            role_map[role_name] = role
        await db.flush()
        print("✅ Roles seeded")

        # ── Categories ────────────────────────────────────
        cat_map = {}
        for cat_data in CATEGORIES:
            from sqlalchemy import select
            existing = await db.execute(select(Category).where(Category.code == cat_data["code"]))
            cat = existing.scalar_one_or_none()
            if not cat:
                cat = Category(id=str(uuid.uuid4()), **cat_data)
                db.add(cat)
                print(f"  ➕ Category: {cat_data['name_en']}")
            cat_map[cat_data["code"]] = cat
        await db.flush()
        print("✅ Categories seeded")

        # ── Rule Packs ────────────────────────────────────
        for pack_file in sorted(PACKS_DIR.glob("*.json")):
            with open(pack_file, encoding="utf-8") as f:
                pack_data = json.load(f)

            cat_code = pack_data.get("category_code")
            cat = cat_map.get(cat_code)
            if not cat:
                print(f"  ⚠️ Skipping {pack_file.name} — category '{cat_code}' not found")
                continue

            from sqlalchemy import select
            existing = await db.execute(
                select(RulePack).where(
                    RulePack.category_id == cat.id,
                    RulePack.version == pack_data["version"]
                )
            )
            if existing.scalar_one_or_none():
                print(f"  ⏭️  Rule pack {pack_file.name} v{pack_data['version']} already exists")
                continue

            rp = RulePack(
                id=str(uuid.uuid4()),
                category_id=cat.id,
                version=pack_data["version"],
                status=RulePackStatus.PUBLISHED,
                effective_from=datetime.fromisoformat(pack_data["effective_from"]).replace(tzinfo=timezone.utc),
                legal_source=pack_data.get("legal_source"),
                source_url=pack_data.get("source_url"),
                gazette_ref=pack_data.get("gazette_ref"),
                pack_json=pack_data,
                published_at=datetime.now(timezone.utc),
            )
            db.add(rp)
            await db.flush()

            # Seed individual rules
            for rule_data in pack_data.get("rules", []):
                rule = Rule(
                    id=str(uuid.uuid4()),
                    rule_pack_id=rp.id,
                    code=rule_data["id"],
                    name=rule_data["name"],
                    legal_ref=rule_data.get("legal_ref"),
                    severity=Severity(rule_data.get("severity", "HIGH")),
                    check_type=rule_data["check_type"],
                    field_code=rule_data.get("field_code"),
                    config_json=rule_data,
                    applies_when=rule_data.get("applies_when", "always"),
                    cannot_check=rule_data.get("cannot_check"),
                )
                db.add(rule)

            print(f"  ➕ Rule pack: {pack_file.name} v{pack_data['version']} ({len(pack_data.get('rules', []))} rules)")

        await db.flush()
        print("✅ Rule packs seeded")

        # ── Demo Users (no Supabase — local auth only for demo) ──
        for user_data in DEMO_USERS:
            from sqlalchemy import select
            existing = await db.execute(select(User).where(User.email == user_data["email"]))
            user = existing.scalar_one_or_none()
            if not user:
                user = User(
                    id=str(uuid.uuid4()),
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    status=UserStatus.ACTIVE,
                )
                db.add(user)
                await db.flush()

                ur = UserRole(user_id=user.id, role_id=role_map[user_data["role"]].id)
                db.add(ur)
                print(f"  ➕ User: {user_data['email']} [{user_data['role'].value}]")

        await db.commit()
        print("✅ Demo users seeded")

    print("\n🎉 METRA seed complete!")
    print("\nDemo accounts:")
    for u in DEMO_USERS:
        print(f"  {u['role'].value:15} → {u['email']}")
    print("\nNote: Set passwords for these users in Supabase Auth dashboard.")


if __name__ == "__main__":
    asyncio.run(seed())
