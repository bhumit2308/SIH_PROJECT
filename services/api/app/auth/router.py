from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.models import User, RoleName, UserRole
from app.auth.dependencies import create_access_token, get_current_user, get_user_roles
from supabase import create_client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate via Supabase, return METRA JWT."""
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        auth_response = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })
        supabase_user = auth_response.user
        if not supabase_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."},
            )
    except Exception as e:
        logger.warning(f"Login failed for {payload.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."},
        )

    # Find or create user in METRA DB
    result = await db.execute(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.email == payload.email)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "USER_NOT_PROVISIONED", "message": "User exists in auth but not provisioned in METRA. Contact admin."},
        )

    token = create_access_token({"sub": user.id, "email": user.email})
    roles = get_user_roles(user)

    return LoginResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "roles": list(roles),
            "organisation": user.organisation,
        },
    )


@router.post("/logout")
async def logout():
    """Client-side token discard. Server is stateless."""
    return {"message": "Logged out successfully."}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Return current authenticated user with roles."""
    roles = get_user_roles(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "roles": list(roles),
        "organisation": current_user.organisation,
        "status": current_user.status.value,
    }
