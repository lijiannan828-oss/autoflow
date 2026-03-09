from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = REPO_ROOT / ".env.local"


@lru_cache(maxsize=1)
def load_workspace_env() -> dict[str, str]:
    env: dict[str, str] = {}

    if ENV_FILE.exists():
        for raw_line in ENV_FILE.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")

    # System environment variables win over file values.
    for key, value in os.environ.items():
        if value:
            env[key] = value

    return env


def get_env(name: str, default: str | None = None) -> str | None:
    return load_workspace_env().get(name, default)


def get_llm_base_url() -> str:
    return get_env("LLM_BASE_URL") or "https://www.dmxapi.cn/v1"


def get_llm_api_key() -> str:
    key = get_env("LLM_API_KEY")
    if not key:
        raise RuntimeError("LLM_API_KEY not set in .env.local or environment")
    return key


def get_comfyui_base_url() -> str:
    return get_env("COMFYUI_BASE_URL") or "http://localhost:8188"


def get_audio_api_base_url() -> str:
    return get_env("AUDIO_API_BASE_URL") or "https://api.kie.ai"


def get_audio_api_key() -> str:
    key = get_env("AUDIO_API_KEY")
    if not key:
        raise RuntimeError("AUDIO_API_KEY not set in .env.local or environment")
    return key
