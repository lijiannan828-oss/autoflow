"""Celery application for async pipeline execution.

Start worker::

    celery -A backend.celery_app worker --loglevel=info --concurrency=2
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Ensure repo root on sys.path
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.common.env import get_env

logger = logging.getLogger(__name__)

# Redis URL for Celery broker + result backend
REDIS_URL = get_env("CELERY_BROKER_URL") or get_env("REDIS_URL") or "redis://127.0.0.1:6379/0"

from celery import Celery

app = Celery(
    "autoflow",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "backend.pipeline_tasks.run_pipeline": {"queue": "pipeline"},
        "backend.pipeline_tasks.resume_pipeline": {"queue": "pipeline"},
    },
)

# Auto-discover tasks
app.autodiscover_tasks(["backend"])
