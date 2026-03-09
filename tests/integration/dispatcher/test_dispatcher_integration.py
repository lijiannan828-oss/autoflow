"""T6: Integration tests for Dispatcher system — annotation parsing, task routing, attribution.

Tests cover:
  - ReviewDispatcherAgent.parse_annotation() with mocked LLM
  - ReviewDispatcherAgent._normalize_task() validation logic
  - TaskExecutor routes tasks to correct agents
  - TaskExecutor handles manual tasks without agent lookup
  - Attribution maps issues to source nodes via rule engine
  - Attribution falls back gracefully when no keywords match
  - End-to-end: annotation text -> parsed tasks -> routed to agents
"""

from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from backend.agents.base import AgentContext, AgentResult
from backend.agents.dispatch.attribution import (
    AGENT_NODE_MAP,
    NODE_TO_AGENT,
    AttributionResult,
    attribute_return_reason,
)
from backend.agents.dispatch.review_dispatcher import (
    DispatcherTask,
    ReviewDispatcherAgent,
)
from backend.agents.dispatch.task_executor import TaskExecutor, TaskResult


# ── Helpers ──────────────────────────────────────────────────────────

def _make_context(**overrides) -> AgentContext:
    defaults = {
        "run_id": f"run-{uuid.uuid4().hex[:8]}",
        "node_id": "N08",
        "project_id": f"proj-{uuid.uuid4().hex[:8]}",
        "genre": "romance",
        "extra": {"annotation": "", "stage_no": 1},
    }
    defaults.update(overrides)
    return AgentContext(**defaults)


def _mock_llm_response(tasks: list[dict]) -> MagicMock:
    """Create a mock LLM response with the given tasks JSON."""
    resp = MagicMock()
    resp.content = json.dumps(tasks)
    resp.cost_cny = 0.005
    return resp


# ── T6-1: parse_annotation via reason() with mocked LLM ─────────────

class TestReviewDispatcherReason:

    @patch("backend.common.llm_client.call_llm")
    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_reason_parses_single_task(
        self, mock_mem, mock_rag, mock_persist, mock_llm
    ):
        mock_llm.return_value = _mock_llm_response([{
            "task_type": "adjust",
            "target_agent": "visual_director",
            "target_node_id": "N07",
            "description": "make face thinner",
            "params": {"face_shape": "thin"},
            "priority": 1,
            "confidence": 0.9,
        }])

        agent = ReviewDispatcherAgent()
        ctx = _make_context(extra={"annotation": "脸太圆了，瘦一点", "stage_no": 1})
        result = agent.execute(ctx)

        assert result.success
        tasks = result.output.get("dispatcher_tasks", [])
        assert len(tasks) == 1
        assert tasks[0]["target_agent"] == "visual_director"
        assert tasks[0]["task_type"] == "adjust"

    @patch("backend.common.llm_client.call_llm")
    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_reason_parses_multiple_tasks(
        self, mock_mem, mock_rag, mock_persist, mock_llm
    ):
        mock_llm.return_value = _mock_llm_response([
            {
                "task_type": "adjust",
                "target_agent": "visual_director",
                "description": "face too round",
                "confidence": 0.85,
            },
            {
                "task_type": "regenerate",
                "target_agent": "audio_director",
                "description": "voice too robotic",
                "confidence": 0.9,
            },
        ])

        agent = ReviewDispatcherAgent()
        ctx = _make_context(extra={"annotation": "脸太圆+声音太机器人", "stage_no": 2})
        result = agent.execute(ctx)

        tasks = result.output.get("dispatcher_tasks", [])
        assert len(tasks) == 2
        agents = {t["target_agent"] for t in tasks}
        assert "visual_director" in agents
        assert "audio_director" in agents

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_reason_empty_annotation_returns_no_tasks(
        self, mock_mem, mock_rag, mock_persist
    ):
        agent = ReviewDispatcherAgent()
        ctx = _make_context(extra={"annotation": "", "stage_no": 1})
        result = agent.execute(ctx)

        assert result.success
        tasks = result.output.get("dispatcher_tasks", [])
        assert len(tasks) == 0


# ── T6-2: _normalize_task validation ─────────────────────────────────

class TestNormalizeTask:

    def test_invalid_task_type_defaults_to_manual(self):
        task = ReviewDispatcherAgent._normalize_task({
            "task_type": "explode",
            "target_agent": "visual_director",
        })
        assert task.task_type == "manual"

    def test_invalid_agent_defaults_to_review_dispatcher(self):
        task = ReviewDispatcherAgent._normalize_task({
            "task_type": "adjust",
            "target_agent": "nonexistent_agent",
        })
        assert task.target_agent == "review_dispatcher"

    def test_invalid_node_for_agent_is_cleared(self):
        task = ReviewDispatcherAgent._normalize_task({
            "task_type": "adjust",
            "target_agent": "visual_director",
            "target_node_id": "N01",  # N01 belongs to script_analyst
        })
        assert task.target_node_id is None

    def test_valid_node_for_agent_is_kept(self):
        task = ReviewDispatcherAgent._normalize_task({
            "task_type": "regenerate",
            "target_agent": "visual_director",
            "target_node_id": "N14",
        })
        assert task.target_node_id == "N14"


# ── T6-3: TaskExecutor routing ───────────────────────────────────────

class TestTaskExecutor:

    def test_manual_task_returns_success_without_agent_lookup(self):
        executor = TaskExecutor()
        tasks = [{"task_type": "manual", "target_agent": "review_dispatcher",
                  "description": "needs human help"}]
        ctx = _make_context()

        results = executor.execute_tasks(tasks, ctx)
        assert len(results) == 1
        assert results[0].success is True
        assert results[0].output["status"] == "manual_review_required"

    @patch.object(TaskExecutor, "_get_agent", return_value=None)
    def test_missing_agent_returns_failure(self, mock_get):
        executor = TaskExecutor()
        tasks = [{"task_type": "regenerate", "target_agent": "nonexistent"}]
        ctx = _make_context()

        results = executor.execute_tasks(tasks, ctx)
        assert len(results) == 1
        assert results[0].success is False
        assert "not found" in (results[0].error or "")

    @patch.object(TaskExecutor, "_get_agent")
    def test_regenerate_task_calls_agent_execute(self, mock_get):
        mock_agent = MagicMock()
        mock_agent.execute.return_value = AgentResult(
            success=True, output={"regenerated": True}, cost_cny=0.1
        )
        mock_get.return_value = mock_agent

        executor = TaskExecutor()
        tasks = [{
            "task_type": "regenerate",
            "target_agent": "visual_director",
            "target_node_id": "N14",
            "params": {"quality": "high"},
        }]
        ctx = _make_context()

        results = executor.execute_tasks(tasks, ctx)
        assert len(results) == 1
        assert results[0].success is True
        assert results[0].output.get("regenerated") is True
        mock_agent.execute.assert_called_once()

    @patch.object(TaskExecutor, "_get_agent")
    def test_adjust_task_passes_adjustment_params(self, mock_get):
        mock_agent = MagicMock()
        mock_agent.execute.return_value = AgentResult(success=True, output={"adjusted": True})
        mock_get.return_value = mock_agent

        executor = TaskExecutor()
        tasks = [{
            "task_type": "adjust",
            "target_agent": "audio_director",
            "params": {"pitch": "+2"},
            "description": "raise pitch",
        }]
        ctx = _make_context()

        results = executor.execute_tasks(tasks, ctx)
        assert results[0].success is True
        # Check the context passed to agent had adjust params
        call_ctx = mock_agent.execute.call_args[0][0]
        assert call_ctx.extra.get("adjust") is True
        assert call_ctx.extra.get("adjustment_params") == {"pitch": "+2"}

    def test_summarize_results(self):
        results = [
            TaskResult(task_index=0, task_type="adjust", target_agent="visual_director",
                      success=True, cost_cny=0.05, duration_ms=100),
            TaskResult(task_index=1, task_type="manual", target_agent="review_dispatcher",
                      success=True, cost_cny=0.0, duration_ms=10),
            TaskResult(task_index=2, task_type="regenerate", target_agent="audio_director",
                      success=False, error="timeout", cost_cny=0.0, duration_ms=5000),
        ]
        summary = TaskExecutor.summarize_results(results)

        assert summary["total_tasks"] == 3
        assert summary["succeeded"] == 2
        assert summary["failed"] == 1
        assert summary["total_cost_cny"] == 0.05


# ── T6-4: Attribution ────────────────────────────────────────────────

class TestAttribution:

    def test_face_related_comment_attributes_to_visual_director(self):
        result = attribute_return_reason(
            decision_comment="角色脸部比例不对，需要调整",
            stage_no=1,
        )
        assert result.attributed_agent == "visual_director"
        assert result.confidence >= 0.8

    def test_audio_comment_attributes_to_audio_director(self):
        result = attribute_return_reason(
            decision_comment="配音声音太机械了，需要更自然",
            stage_no=3,
        )
        assert result.attributed_agent == "audio_director"
        assert result.attributed_node_id == "N07b"

    def test_subtitle_comment_attributes_to_compositor(self):
        result = attribute_return_reason(
            decision_comment="字幕位置偏了，文字太小",
            stage_no=4,
        )
        assert result.attributed_agent == "compositor"
        assert result.attributed_node_id == "N25"

    def test_unknown_comment_falls_back_to_stage_hint(self):
        result = attribute_return_reason(
            decision_comment="总体感觉不太好",  # vague, no keyword match
            stage_no=2,
        )
        # Should fall back to stage 2 hint (first node)
        assert result.attributed_node_id is not None
        assert result.confidence < 0.8

    def test_system_root_cause_used_as_fallback(self):
        result = attribute_return_reason(
            decision_comment="不太行",
            system_root_cause_node_id="N23",
        )
        assert result.attributed_node_id == "N23"
        assert result.attributed_agent == "compositor"

    def test_node_to_agent_mapping_is_complete(self):
        """Every node in AGENT_NODE_MAP should appear in NODE_TO_AGENT."""
        for agent, nodes in AGENT_NODE_MAP.items():
            for node in nodes:
                assert node in NODE_TO_AGENT
                assert NODE_TO_AGENT[node] == agent


# ── T6-5: End-to-end parse → route ──────────────────────────────────

class TestEndToEnd:

    @patch.object(TaskExecutor, "_get_agent")
    @patch("backend.common.llm_client.call_llm")
    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_annotation_to_parse_to_route(
        self, mock_mem, mock_rag, mock_persist, mock_llm, mock_get_agent
    ):
        """Full pipeline: annotation → LLM parse → TaskExecutor routes to agent."""
        # 1. Set up LLM to parse annotation into tasks
        mock_llm.return_value = _mock_llm_response([{
            "task_type": "adjust",
            "target_agent": "visual_director",
            "target_node_id": "N07",
            "description": "make background darker",
            "params": {"brightness": -0.3},
            "confidence": 0.92,
        }])

        # 2. Parse annotation
        agent = ReviewDispatcherAgent()
        ctx = _make_context(extra={"annotation": "背景太亮了", "stage_no": 1})
        parse_result = agent.execute(ctx)

        assert parse_result.success
        tasks = parse_result.output["dispatcher_tasks"]
        assert len(tasks) == 1

        # 3. Route to executor
        mock_target_agent = MagicMock()
        mock_target_agent.execute.return_value = AgentResult(
            success=True, output={"brightness_adjusted": True}
        )
        mock_get_agent.return_value = mock_target_agent

        executor = TaskExecutor()
        exec_results = executor.execute_tasks(tasks, ctx)

        assert len(exec_results) == 1
        assert exec_results[0].success is True
        mock_target_agent.execute.assert_called_once()
