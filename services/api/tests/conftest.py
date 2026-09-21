import os
import sys
import dotenv
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

# Ensure services/api is on sys.path and .env is loaded
SERVICES_API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
dotenv.load_dotenv(os.path.join(SERVICES_API_DIR, ".env"))
if SERVICES_API_DIR not in sys.path:
    sys.path.insert(0, SERVICES_API_DIR)

from app.main import app
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.models import User, Role, UserRole, RoleName
from app.auth.dependencies import create_access_token


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Ensure all tables exist before running test suite."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db_session():
    """Yields a database session for test verification."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def officer_user(db_session):
    """Retrieves or creates an inspector officer user for authenticated requests."""
    res = await db_session.execute(
        select(User).where(User.email == "inspector@metra.demo")
    )
    user = res.scalar_one_or_none()
    if not user:
        any_user_res = await db_session.execute(select(User).limit(1))
        user = any_user_res.scalar_one_or_none()
    return user


@pytest_asyncio.fixture
def auth_headers(officer_user):
    """Provides a valid Bearer token header for the test officer."""
    user_id = officer_user.id if officer_user else "00000000-0000-0000-0000-000000000001"
    email = officer_user.email if officer_user else "officer@metra.gov.in"
    token = create_access_token({"sub": user_id, "email": email})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def async_client():
    """HTTPX AsyncClient configured against the METRA FastAPI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
