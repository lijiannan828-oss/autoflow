"""T5: Integration tests for Agent system — cross-module interactions.

Tests cover:
  - BaseAgent subclass instantiation
  - Decision loop (recall → reason → act → reflect) with mocked DB/LLM
  - Trace recording
  - Memory read/write
  - SupervisorAgent cost/compliance checks
  - Agent registry operations
"""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from backend.agents.base import (
    AGENT_NAMES,
    AgentContext,
    AgentResult,
    BaseAgent,
    MemoryItem,
    RAGCase,
)


# ── Concrete test agent ─────────────────────────────────────────────

class StubAgent(BaseAgent):
    """Minimal concrete subclass for testing the decision loop."""

    def __init__(self, name: str = "script_analyst"):
        self._name = name

    @property
    def agent_name(self) -> str:
        return self._name

    def reason(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        return {
            "action": "test_action",
            "_reasoning_text": "test reasoning",
            "_cost_cny": 0.01,
        }

    def act(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        return {
            "result": "test_output",
            "_cost_cny": 0.02,
        }


# ── Helpers ──────────────────────────────────────────────────────────

def _make_context(**overrides) -> AgentContext:
    defaults = {
        "run_id": f"run-{uuid.uuid4().hex[:8]}",
        "episode_version_id": f"ev-{uuid.uuid4().hex[:8]}",
        "node_id": "N01",
        "project_id": f"proj-{uuid.uuid4().hex[:8]}",
        "genre": "romance",
    }
    defaults.update(overrides)
    return AgentContext(**defaults)


# ── T5-1: BaseAgent subclass can be instantiated ─────────────────────

class TestBaseAgentInstantiation:

    def test_stub_agent_instantiates(self):
        agent = StubAgent()
        assert agent.agent_name == "script_analyst"
        assert repr(agent).startswith("<StubAgent")

    def test_stub_agent_custom_name(self):
        agent = StubAgent(name="visual_director")
        assert agent.agent_name == "visual_director"

    def test_base_agent_is_abstract(self):
        with pytest.raises(TypeError):
            BaseAgent()  # type: ignore[abstract]


# ── T5-2: execute() runs decision loop with mocked deps ─────────────

class TestDecisionLoop:

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_execute_returns_successful_result(
        self, mock_mem, mock_rag, mock_persist
    ):
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        assert isinstance(result, AgentResult)
        assert result.success is True
        assert result.error is None

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_execute_accumulates_cost(self, mock_mem, mock_rag, mock_persist):
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        # reason returns 0.01, act returns 0.02
        assert abs(result.cost_cny - 0.03) < 1e-6

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_execute_records_duration(self, mock_mem, mock_rag, mock_persist):
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        assert result.duration_ms >= 0

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_execute_output_contains_act_result(self, mock_mem, mock_rag, mock_persist):
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        assert result.output.get("result") == "test_output"


# ── T5-3: Trace recording ────────────────────────────────────────────

class TestTraceRecording:

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_traces_contain_all_four_steps(self, mock_mem, mock_rag, mock_persist):
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        trace_types = [t["trace_type"] for t in result.traces]
        assert "recall" in trace_types
        assert "reason" in trace_types
        assert "act" in trace_types
        assert "reflect" in trace_types

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_traces_carry_agent_name_and_node_id(self, mock_mem, mock_rag, mock_persist):
        agent = StubAgent()
        ctx = _make_context(node_id="N05")
        result = agent.execute(ctx)

        for trace in result.traces:
            assert trace["agent_name"] == "script_analyst"
            assert trace["node_id"] == "N05"

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_persist_traces_called(self, mock_mem, mock_rag, mock_persist):
        agent = StubAgent()
        ctx = _make_context()
        agent.execute(ctx)
        mock_persist.assert_called_once()

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_reason_trace_includes_cost(self, mock_mem, mock_rag, mock_persist):
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        reason_traces = [t for t in result.traces if t["trace_type"] == "reason"]
        assert len(reason_traces) == 1
        assert reason_traces[0]["cost_cny"] == 0.01


# ── T5-4: Memory read/write during execution ────────────────────────

class TestMemoryInteraction:

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories")
    def test_recall_uses_fetched_memories(self, mock_mem, mock_rag, mock_persist):
        mock_mem.return_value = [
            MemoryItem(
                id="mem-1", content_key="test_key",
                content_value={"hint": "use style A"},
                memory_type="lesson_learned",
                confidence=0.9, access_count=3,
            )
        ]
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        assert result.success
        # recall trace should show 1 memory loaded
        recall_trace = [t for t in result.traces if t["trace_type"] == "recall"][0]
        assert recall_trace["output_summary"]["memory_count"] == 1

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases")
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_recall_uses_fetched_rag_cases(self, mock_mem, mock_rag, mock_persist):
        mock_rag.return_value = [
            RAGCase(
                chain_id="rag-1", quality_score=9.5,
                case_type="positive", genre="romance",
                scene_type="dialogue", payload={"sample": True},
            )
        ]
        agent = StubAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        recall_trace = [t for t in result.traces if t["trace_type"] == "recall"][0]
        assert recall_trace["output_summary"]["rag_count"] == 1

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_cost_budget_check_passes_when_within_budget(self, *mocks):
        agent = StubAgent()
        ctx = _make_context(cost_budget_remaining=10.0)
        assert agent.check_cost_budget(ctx, 5.0) is True

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_cost_budget_check_fails_when_exceeded(self, *mocks):
        agent = StubAgent()
        ctx = _make_context(cost_budget_remaining=1.0)
        assert agent.check_cost_budget(ctx, 5.0) is False

    def test_cost_budget_unlimited_when_none(self):
        agent = StubAgent()
        ctx = _make_context(cost_budget_remaining=None)
        assert agent.check_cost_budget(ctx, 999.0) is True


# ── T5-5: Error handling in execute ──────────────────────────────────

class TestExecuteErrorHandling:

    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_rag_cases", return_value=[])
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_execute_catches_exception_and_returns_failure(
        self, mock_mem, mock_rag, mock_persist
    ):
        class FailingAgent(StubAgent):
            def reason(self, context, recalled):
                raise ValueError("LLM exploded")

        agent = FailingAgent()
        ctx = _make_context()
        result = agent.execute(ctx)

        assert result.success is False
        assert "LLM exploded" in (result.error or "")
        # error trace should be present
        error_traces = [t for t in result.traces if t["trace_type"] == "error"]
        assert len(error_traces) == 1


# ── T5-6: SupervisorAgent ────────────────────────────────────────────

class TestSupervisorAgent:

    @patch("backend.agents.supervisor.SupervisorAgent._broadcast_alert")
    @patch("backend.agents.supervisor.check_budget")
    @patch("backend.agents.supervisor.SupervisorAgent._check_compliance")
    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_supervisor_ok_health(
        self, mock_mem, mock_persist, mock_compliance, mock_budget, mock_alert
    ):
        from backend.agents.supervisor import SupervisorAgent

        mock_budget.return_value = {
            "status": "ok",
            "utilization_pct": 30.0,
            "total_cny": 9.0,
            "remaining_cny": 21.0,
        }
        mock_compliance.return_value = {"status": "ok"}

        agent = SupervisorAgent()
        ctx = _make_context(node_id="N02")
        result = agent.execute(ctx)

        assert result.success
        assert result.output["health"] == "ok"
        mock_alert.assert_not_called()

    @patch("backend.agents.supervisor.record_cost_event")
    @patch("backend.agents.supervisor.SupervisorAgent._broadcast_alert")
    @patch("backend.agents.supervisor.check_budget")
    @patch("backend.agents.supervisor.SupervisorAgent._check_compliance")
    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_supervisor_critical_health_sends_alert(
        self, mock_mem, mock_persist, mock_compliance, mock_budget,
        mock_alert, mock_cost_event
    ):
        from backend.agents.supervisor import SupervisorAgent

        mock_budget.return_value = {
            "status": "critical",
            "utilization_pct": 95.0,
            "total_cny": 28.5,
            "remaining_cny": 1.5,
        }
        mock_compliance.return_value = {"status": "ok"}

        agent = SupervisorAgent()
        ctx = _make_context(node_id="N14")
        result = agent.execute(ctx)

        assert result.success
        assert result.output["health"] == "critical"
        assert result.output.get("alert_sent") is True
        assert result.output.get("requires_human_review") is True
        mock_alert.assert_called_once()

    @patch("backend.agents.supervisor.record_cost_event")
    @patch("backend.agents.supervisor.SupervisorAgent._broadcast_alert")
    @patch("backend.agents.supervisor.check_budget")
    @patch("backend.agents.supervisor.SupervisorAgent._check_compliance")
    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_supervisor_compliance_fail_triggers_critical(
        self, mock_mem, mock_persist, mock_compliance, mock_budget,
        mock_alert, mock_cost_event
    ):
        from backend.agents.supervisor import SupervisorAgent

        mock_budget.return_value = {
            "status": "ok",
            "utilization_pct": 20.0,
            "total_cny": 6.0,
            "remaining_cny": 24.0,
        }
        mock_compliance.return_value = {
            "status": "fail",
            "violations": ["Content policy violation"],
        }

        agent = SupervisorAgent()
        ctx = _make_context(node_id="N05")
        result = agent.execute(ctx)

        assert result.output["health"] == "critical"
        assert result.output["compliance_status"] == "fail"

    @patch("backend.agents.supervisor.SupervisorAgent._broadcast_alert")
    @patch("backend.agents.supervisor.check_budget")
    @patch("backend.agents.supervisor.SupervisorAgent._check_compliance")
    @patch("backend.agents.base.BaseAgent._persist_traces")
    @patch("backend.agents.base.BaseAgent._fetch_memories", return_value=[])
    def test_supervisor_reflect_returns_memory_on_warning(
        self, mock_mem, mock_persist, mock_compliance, mock_budget, mock_alert
    ):
        from backend.agents.supervisor import SupervisorAgent

        mock_budget.return_value = {
            "status": "warning",
            "utilization_pct": 75.0,
            "total_cny": 22.5,
            "remaining_cny": 7.5,
        }
        mock_compliance.return_value = {"status": "ok"}

        agent = SupervisorAgent()
        ctx = _make_context(node_id="N09")
        result = agent.execute(ctx)

        assert result.output["health"] == "warning"
        # reflect should produce memory writes for non-ok health
        assert len(result.memory_writes) > 0
        assert result.memory_writes[0]["memory_type"] == "statistics"


# ── T5-7: Agent registry ────────────────────────────────────────────

class TestAgentRegistry:

    def test_register_and_get_agent(self):
        from backend.agents.registry import (
            clear_registry,
            get_agent,
            register_agent,
        )

        clear_registry()
        agent = StubAgent(name="script_analyst")
        register_agent(agent)

        retrieved = get_agent("script_analyst")
        assert retrieved is agent
        clear_registry()

    def test_register_class_lazy_instantiation(self):
        from backend.agents.registry import (
            clear_registry,
            get_agent,
            register_agent_class,
        )

        clear_registry()
        register_agent_class("script_analyst", StubAgent)

        retrieved = get_agent("script_analyst")
        assert isinstance(retrieved, StubAgent)
        clear_registry()

    def test_get_unknown_agent_raises_key_error(self):
        from backend.agents.registry import clear_registry, get_agent

        clear_registry()
        with pytest.raises(KeyError, match="not registered"):
            get_agent("nonexistent_agent")
        clear_registry()

    def test_list_agents_returns_all_registered(self):
        from backend.agents.registry import (
            clear_registry,
            list_agents,
            register_agent,
            register_agent_class,
        )

        clear_registry()
        register_agent(StubAgent(name="supervisor"))
        register_agent_class("script_analyst", StubAgent)

        agents = list_agents()
        assert "supervisor" in agents
        assert "script_analyst" in agents
        clear_registry()

    def test_is_registered(self):
        from backend.agents.registry import (
            clear_registry,
            is_registered,
            register_agent,
        )

        clear_registry()
        assert is_registered("script_analyst") is False
        register_agent(StubAgent(name="script_analyst"))
        assert is_registered("script_analyst") is True
        clear_registry()

    def test_agent_names_constant_has_expected_entries(self):
        assert "supervisor" in AGENT_NAMES
        assert "script_analyst" in AGENT_NAMES
        assert "evolution_engine" in AGENT_NAMES
        assert len(AGENT_NAMES) == 10
