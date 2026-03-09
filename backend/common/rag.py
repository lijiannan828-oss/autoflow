"""rag.py — RAG 检索客户端接口 + MockRagClient

Day 1: MockRagClient（内存模式，无需 Qdrant）
Day 2: 切换为 QdrantRagClient（依赖 O5 Qdrant 部署就绪）

BaseAgent._fetch_rag_cases() 调用 get_rag_client().search()。
EvolutionEngine 调用 get_rag_client().upsert() 写入高分案例。

集合（Collection）设计：
  - autoflow_chain_cases: 链路级案例（shot→episode→project 全链路）
  - autoflow_negative_cases: 负向案例（人审标记典型错误）
"""

from __future__ import annotations

import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from backend.common.env import get_env

logger = logging.getLogger(__name__)


# ── Data classes (shared with base.py) ────────────────────────────────

@dataclass
class RAGCase:
    """A RAG case record."""
    chain_id: str
    quality_score: float
    case_type: str  # "positive" | "negative" | "corrective"
    genre: str | None = None
    scene_type: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class RAGSearchResult:
    """Search result with relevance score."""
    case: RAGCase
    score: float = 0.0


# ── Abstract interface ────────────────────────────────────────────────

class RAGClient(ABC):
    """Abstract RAG client interface."""

    @abstractmethod
    def search(
        self,
        agent_name: str,
        genre: str | None = None,
        scene_type: str | None = None,
        query_text: str | None = None,
        limit: int = 3,
    ) -> list[RAGCase]:
        """Search for relevant RAG cases."""
        ...

    @abstractmethod
    def upsert(
        self,
        case: RAGCase,
        embedding: list[float] | None = None,
    ) -> str:
        """Upsert a case into the RAG store. Returns chain_id."""
        ...

    @abstractmethod
    def delete(self, chain_id: str) -> bool:
        """Delete a case by chain_id."""
        ...

    @abstractmethod
    def count(self) -> int:
        """Total number of cases in the store."""
        ...

    @abstractmethod
    def health(self) -> dict[str, Any]:
        """Health check."""
        ...


# ── MockRagClient (Day 1) ────────────────────────────────────────────

class MockRagClient(RAGClient):
    """In-memory mock for development without Qdrant.

    Supports basic CRUD and genre-filtered search.
    No vector similarity — returns cases sorted by quality_score.
    """

    def __init__(self) -> None:
        self._store: dict[str, RAGCase] = {}
        logger.info("MockRagClient initialized (in-memory mode)")

    def search(
        self,
        agent_name: str,
        genre: str | None = None,
        scene_type: str | None = None,
        query_text: str | None = None,
        limit: int = 3,
    ) -> list[RAGCase]:
        candidates = list(self._store.values())

        # Filter by genre if specified
        if genre:
            candidates = [c for c in candidates if c.genre == genre or c.genre is None]
        if scene_type:
            candidates = [c for c in candidates if c.scene_type == scene_type or c.scene_type is None]

        # Sort by quality score descending
        candidates.sort(key=lambda c: c.quality_score, reverse=True)
        return candidates[:limit]

    def upsert(
        self,
        case: RAGCase,
        embedding: list[float] | None = None,
    ) -> str:
        if not case.chain_id:
            case.chain_id = str(uuid.uuid4())
        self._store[case.chain_id] = case
        logger.debug("MockRAG upsert: %s (score=%.2f)", case.chain_id, case.quality_score)
        return case.chain_id

    def delete(self, chain_id: str) -> bool:
        if chain_id in self._store:
            del self._store[chain_id]
            return True
        return False

    def count(self) -> int:
        return len(self._store)

    def health(self) -> dict[str, Any]:
        return {"status": "ok", "backend": "mock", "count": self.count()}


# ── QdrantRagClient (Day 2, after O5) ────────────────────────────────

COLLECTION_NAME = "autoflow_rag"
VECTOR_DIM = 1536  # Match existing Qdrant collection dimension


class QdrantRagClient(RAGClient):
    """Real Qdrant client using qdrant-client SDK.

    Collection: autoflow_rag (created by 运维 Agent).
    Uses payload-based filtering for genre/scene_type + scroll for non-vector search.
    Vector search available when embeddings are provided.
    """

    def __init__(self, url: str, api_key: str | None = None) -> None:
        from qdrant_client import QdrantClient
        self._url = url
        self._client = QdrantClient(url=url, api_key=api_key, timeout=10, check_compatibility=False)
        logger.info("QdrantRagClient initialized: %s", url)
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        """Ensure the RAG collection exists."""
        try:
            collections = [c.name for c in self._client.get_collections().collections]
            if COLLECTION_NAME not in collections:
                from qdrant_client.models import Distance, VectorParams
                self._client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
                )
                logger.info("Created Qdrant collection: %s", COLLECTION_NAME)
        except Exception as exc:
            logger.warning("Failed to ensure collection: %s", exc)

    def search(
        self,
        agent_name: str,
        genre: str | None = None,
        scene_type: str | None = None,
        query_text: str | None = None,
        limit: int = 3,
    ) -> list[RAGCase]:
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        try:
            # Build filter conditions
            must_conditions = []
            if genre:
                must_conditions.append(FieldCondition(key="genre", match=MatchValue(value=genre)))
            if scene_type:
                must_conditions.append(FieldCondition(key="scene_type", match=MatchValue(value=scene_type)))

            query_filter = Filter(must=must_conditions) if must_conditions else None

            # Use scroll with filter (no vector query — payload-based retrieval)
            # Sort by quality_score via scroll + client-side sort
            results, _ = self._client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=query_filter,
                limit=limit * 3,  # over-fetch for client-side sort
                with_payload=True,
            )

            cases = []
            for point in results:
                payload = point.payload or {}
                cases.append(RAGCase(
                    chain_id=payload.get("chain_id", str(point.id)),
                    quality_score=float(payload.get("quality_score", 0)),
                    case_type=payload.get("case_type", "positive"),
                    genre=payload.get("genre"),
                    scene_type=payload.get("scene_type"),
                    payload=payload.get("case_payload", {}),
                ))

            # Sort by quality descending, return top-K
            cases.sort(key=lambda c: c.quality_score, reverse=True)
            return cases[:limit]

        except Exception as exc:
            logger.warning("Qdrant search failed: %s", exc)
            return []

    def upsert(self, case: RAGCase, embedding: list[float] | None = None) -> str:
        from qdrant_client.models import PointStruct
        import hashlib

        try:
            if not case.chain_id:
                case.chain_id = str(uuid.uuid4())

            # Generate deterministic point ID from chain_id
            point_id = hashlib.md5(case.chain_id.encode()).hexdigest()[:32]
            # Convert hex to int for Qdrant
            point_id_int = int(point_id[:16], 16)

            # Use zero vector if no embedding provided
            vector = embedding or [0.0] * VECTOR_DIM

            self._client.upsert(
                collection_name=COLLECTION_NAME,
                points=[PointStruct(
                    id=point_id_int,
                    vector=vector,
                    payload={
                        "chain_id": case.chain_id,
                        "quality_score": case.quality_score,
                        "case_type": case.case_type,
                        "genre": case.genre,
                        "scene_type": case.scene_type,
                        "case_payload": case.payload,
                    },
                )],
            )
            logger.debug("Qdrant upsert: %s (score=%.2f)", case.chain_id, case.quality_score)
            return case.chain_id

        except Exception as exc:
            logger.warning("Qdrant upsert failed: %s", exc)
            return case.chain_id

    def delete(self, chain_id: str) -> bool:
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        try:
            self._client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=Filter(
                    must=[FieldCondition(key="chain_id", match=MatchValue(value=chain_id))]
                ),
            )
            return True
        except Exception as exc:
            logger.warning("Qdrant delete failed: %s", exc)
            return False

    def count(self) -> int:
        try:
            info = self._client.get_collection(COLLECTION_NAME)
            return info.points_count or 0
        except Exception as exc:
            logger.warning("Qdrant count failed: %s", exc)
            return 0

    def health(self) -> dict[str, Any]:
        try:
            collections = [c.name for c in self._client.get_collections().collections]
            count = self.count()
            return {
                "status": "ok",
                "backend": "qdrant",
                "url": self._url,
                "collections": collections,
                "count": count,
            }
        except Exception as exc:
            return {"status": "error", "backend": "qdrant", "error": str(exc)}


# ── Factory ───────────────────────────────────────────────────────────

_client: RAGClient | None = None


def get_rag_client() -> RAGClient:
    """Get the singleton RAG client.

    Uses QdrantRagClient if QDRANT_URL is set, otherwise MockRagClient.
    """
    global _client
    if _client is not None:
        return _client

    qdrant_url = get_env("QDRANT_URL")
    if qdrant_url:
        _client = QdrantRagClient(
            url=qdrant_url,
            api_key=get_env("QDRANT_API_KEY"),
        )
    else:
        _client = MockRagClient()

    return _client


def reset_rag_client() -> None:
    """Reset the singleton (for testing)."""
    global _client
    _client = None
