"""FastAPI application — wraps existing orchestrator read/write operations as REST endpoints.

Start with::

    uvicorn backend.api.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# Ensure repo root is on sys.path for backend.* imports
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes.health import router as health_router
from backend.api.routes.reviews import router as reviews_router
from backend.api.routes.runs import router as runs_router
from backend.api.routes.callbacks import router as callbacks_router
from backend.api.routes.seed import router as seed_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(
    title="Autoflow Orchestrator API",
    version="0.1.0",
    description="AIGC pipeline orchestrator — MVP-0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, tags=["health"])
app.include_router(runs_router, prefix="/api/v1", tags=["runs"])
app.include_router(reviews_router, prefix="/api/v1", tags=["reviews"])
app.include_router(callbacks_router, prefix="/api/v1", tags=["callbacks"])
app.include_router(seed_router, prefix="/api/v1", tags=["seed"])
