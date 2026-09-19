import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base
from app.auth.router import router as auth_router
from app.inspections.router import router as inspections_router
from app.reviews.router import router as reviews_router
from app.rules.router import router as rules_router
from app.reports.router import router as reports_router
from app.reports.library_router import router as reports_library_router

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("METRA API starting up...")
    # Tables auto-created in dev; use migrations in production
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database ready.")
    yield
    logger.info("METRA API shutting down.")
    await engine.dispose()


app = FastAPI(
    title="METRA API",
    description="AI-Assisted Legal Metrology Compliance & Inspection System",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global error handler ──────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred.",
                "request_id": request.headers.get("x-request-id", ""),
            }
        },
    )


# ── Health endpoints ──────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "metra-api", "version": settings.VERSION}


@app.get("/ready", tags=["Health"])
async def ready():
    """Checks DB connectivity."""
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "database": "disconnected", "error": str(e)},
        )


# ── Routers ───────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(inspections_router, prefix="/api/v1/inspections", tags=["Inspections"])
app.include_router(reports_router, prefix="/api/v1/inspections", tags=["Reports"])
app.include_router(reports_library_router, prefix="/api/v1/reports", tags=["Reports Library"])
app.include_router(reviews_router, prefix="/api/v1/reviews", tags=["Reviews"])
app.include_router(rules_router, prefix="/api/v1/rule-packs", tags=["Rule Packs"])
