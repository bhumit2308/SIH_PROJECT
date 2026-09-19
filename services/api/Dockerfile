# ─────────────────────────────────────────────────────────────────────────────
# METRA API — Dockerfile
# Multi-stage build: builder installs deps, runtime image is lean.
# Render.com will use this automatically when render.yaml sets runtime=docker.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ─────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# System deps needed to compile some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Runtime-only system libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Non-root user for security
RUN adduser --disabled-password --gecos "" metra \
    && chown -R metra:metra /app
USER metra

# Health check — Render uses this
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Expose port (Render injects $PORT at runtime)
EXPOSE 8000

# Start FastAPI via gunicorn + uvicorn workers
CMD ["sh", "-c", "exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 2 \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --log-level info \
    --access-logfile - \
    --error-logfile -"]
