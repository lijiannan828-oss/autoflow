"""Root conftest.py — shared fixtures for all AutoFlow tests.

Fixture hierarchy:
  conftest.py (root)          ← this file: env setup, DB/mock factories
  tests/conftest.py           ← test-tree level: common helpers
  tests/unit/conftest.py      ← unit-specific: auto-apply unit marker
  tests/integration/conftest.py ← integration-specific: real service checks
"""

from __future__ import annotations

import os
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest


# ---------------------------------------------------------------------------
# Environment: ensure we load .env.local but never hit production services
# in unit tests accidentally.
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True, scope="session")
def _load_env():
    """Load .env.local for test runs (mirrors backend.common.env behavior)."""
    env_file = os.path.join(os.path.dirname(__file__), ".env.local")
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())


# ---------------------------------------------------------------------------
# Pipeline state fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def make_state():
    """Factory fixture to create a PipelineState with sensible defaults."""
    from backend.orchestrator.graph.state import make_initial_state

    def _factory(
        run_id: str | None = None,
        episode_id: str | None = None,
        episode_version_id: str | None = None,
        **overrides: Any,
    ) -> dict:
        return make_initial_state(
            run_id=run_id or f"run-test-{uuid.uuid4().hex[:8]}",
            episode_id=episode_id or f"ep-test-{uuid.uuid4().hex[:8]}",
            episode_version_id=episode_version_id or f"ev-test-{uuid.uuid4().hex[:8]}",
            **overrides,
        )

    return _factory


# ---------------------------------------------------------------------------
# Mock LLM client
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_llm_client():
    """A mock LLM client that returns canned JSON responses.

    Usage:
        def test_something(mock_llm_client):
            mock_llm_client.set_response({"decision": "pass", "score": 8.5})
            result = my_function_that_calls_llm(client=mock_llm_client.client)
    """

    class _MockLLMClient:
        def __init__(self):
            self.client = MagicMock()
            self.async_client = AsyncMock()
            self._response: Any = {"status": "ok"}
            self.call_history: list[dict] = []

        def set_response(self, response: Any):
            self._response = response
            self.client.chat.return_value = response
            self.async_client.chat.return_value = response

        def get_call_count(self) -> int:
            return self.client.chat.call_count + self.async_client.chat.call_count

    mock = _MockLLMClient()
    mock.set_response({"status": "ok"})
    return mock


# ---------------------------------------------------------------------------
# Mock TOS (object storage) client
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_tos_client():
    """A mock TOS client that stores files in a local dict."""

    class _MockTOSClient:
        def __init__(self):
            self.store: dict[str, bytes] = {}

        def upload(self, key: str, data: bytes) -> str:
            self.store[key] = data
            return f"tos://test-bucket/{key}"

        def download(self, key: str) -> bytes:
            return self.store.get(key, b"")

        def exists(self, key: str) -> bool:
            return key in self.store

        def list_keys(self, prefix: str = "") -> list[str]:
            return [k for k in self.store if k.startswith(prefix)]

    return _MockTOSClient()


# ---------------------------------------------------------------------------
# Mock agent memory
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_agent_memory():
    """In-memory agent_memory store for unit tests."""

    class _MockAgentMemory:
        def __init__(self):
            self._store: dict[str, Any] = {}

        async def save(self, agent_name: str, key: str, value: Any,
                       scope: str = "project", scope_id: str | None = None,
                       confidence: float = 0.5) -> str:
            memory_id = uuid.uuid4().hex
            self._store[memory_id] = {
                "agent_name": agent_name,
                "content_key": key,
                "content_value": value,
                "scope": scope,
                "scope_id": scope_id,
                "confidence": confidence,
            }
            return memory_id

        async def read(self, agent_name: str, key_prefix: str = "",
                       scope: str | None = None, scope_id: str | None = None) -> list[dict]:
            results = []
            for mid, entry in self._store.items():
                if entry["agent_name"] != agent_name:
                    continue
                if key_prefix and not entry["content_key"].startswith(key_prefix):
                    continue
                if scope and entry["scope"] != scope:
                    continue
                if scope_id and entry["scope_id"] != scope_id:
                    continue
                results.append({"memory_id": mid, **entry})
            return results

        def count(self) -> int:
            return len(self._store)

    return _MockAgentMemory()


# ---------------------------------------------------------------------------
# Mock RAG client
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_rag_client():
    """In-memory RAG client for unit tests (no Qdrant dependency)."""

    class _MockRagClient:
        def __init__(self):
            self._cases: list[dict] = []

        async def upsert(self, chain_case: dict) -> str:
            point_id = uuid.uuid4().hex
            chain_case["qdrant_point_id"] = point_id
            self._cases.append(chain_case)
            return point_id

        async def search(self, tags: dict | None = None, query_text: str = "",
                         top_k: int = 3) -> list[dict]:
            results = self._cases.copy()
            if tags:
                for key, val in tags.items():
                    results = [c for c in results if c.get(key) == val]
            return results[:top_k]

        def count(self) -> int:
            return len(self._cases)

    return _MockRagClient()


# ---------------------------------------------------------------------------
# Mock MQ client
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_mq_client():
    """In-memory message queue client for unit tests."""

    class _MockMQClient:
        def __init__(self):
            self.queues: dict[str, list[dict]] = {}

        def send(self, topic: str, message: dict) -> str:
            if topic not in self.queues:
                self.queues[topic] = []
            msg_id = uuid.uuid4().hex
            self.queues[topic].append({"msg_id": msg_id, **message})
            return msg_id

        def consume(self, topic: str, max_msgs: int = 1) -> list[dict]:
            msgs = self.queues.get(topic, [])[:max_msgs]
            if topic in self.queues:
                self.queues[topic] = self.queues[topic][max_msgs:]
            return msgs

        def pending_count(self, topic: str) -> int:
            return len(self.queues.get(topic, []))

    return _MockMQClient()


# ---------------------------------------------------------------------------
# DB session fixture (for integration tests that need real PG)
# ---------------------------------------------------------------------------

@pytest.fixture
def db_session():
    """Provide a database connection for integration tests.

    Skips if PG_HOST is not configured.
    """
    pg_host = os.environ.get("PG_HOST")
    if not pg_host:
        pytest.skip("PG_HOST not set — skipping DB test")

    import psycopg

    conn_str = (
        f"host={pg_host} "
        f"port={os.environ.get('PG_PORT', '5432')} "
        f"dbname={os.environ.get('PG_DATABASE', 'autoflow')} "
        f"user={os.environ.get('PG_USER', 'postgres')} "
        f"password={os.environ.get('PG_PASSWORD', '')}"
    )
    conn = psycopg.connect(conn_str)
    yield conn
    conn.rollback()
    conn.close()
