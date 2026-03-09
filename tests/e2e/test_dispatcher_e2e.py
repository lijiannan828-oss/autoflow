"""V9: Dispatcher E2E — annotation → parse → execute → write-back

端到端验证 ReviewDispatcherAgent 全链路：
  1. 构造中文审核批注
  2. parse_annotation 解析为 DispatcherTask 列表
  3. TaskExecutor 路由执行（Mock Agent）
  4. 验证结果结构正确
"""

from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock

from backend.agents.dispatch.review_dispatcher import ReviewDispatcherAgent, DispatcherTask
from backend.agents.dispatch.task_executor import TaskExecutor, TaskResult
from backend.agents.dispatch.attribution import attribute_return_reason, AttributionResult
from backend.agents.base import AgentContext, AgentResult


# ── V9: Dispatcher E2E ───────────────────────────────────────────


class TestDispatcherParseAnnotation:
    """测试 ReviewDispatcherAgent.parse_annotation 完整链路。"""

    @patch("backend.common.llm_client.call_llm")
    @patch("backend.common.db.execute_returning_one", return_value={"id": "test-1"})
    def test_parse_annotation_success(self, mock_db, mock_llm):
        """正常批注 → 解析成功 → 返回 DispatcherTask 列表。"""
        # Mock LLM 返回结构化 JSON
        mock_resp = MagicMock()
        mock_resp.content = '''[
            {
                "task_type": "regenerate",
                "target_agent": "visual_director",
                "target_node_id": "N07",
                "description": "角色形象与设定不符，需要重新生成美术图",
                "priority": 1,
                "confidence": 0.9
            }
        ]'''
        mock_resp.cost_cny = 0.01
        mock_llm.return_value = mock_resp

        result = ReviewDispatcherAgent.parse_annotation(
            annotation="角色形象跟设定差距太大了，整体画风偏暗，需要重新画",
            review_task_id="rt-001",
            gate_node_id="N08",
            stage_no=1,
            genre="都市",
            shot_ids=["shot-1", "shot-2"],
        )

        assert result.success is True
        assert result.output["task_count"] >= 1
        tasks = result.output["dispatcher_tasks"]
        assert len(tasks) >= 1
        assert tasks[0]["target_agent"] == "visual_director"

    @patch("backend.common.llm_client.call_llm")
    def test_parse_annotation_llm_failure_fallback(self, mock_llm):
        """LLM 调用失败 → 降级为 manual 任务。"""
        mock_llm.side_effect = Exception("LLM API timeout")

        result = ReviewDispatcherAgent.parse_annotation(
            annotation="有问题，需要修改",
            review_task_id="rt-002",
        )

        assert result.success is True
        tasks = result.output["dispatcher_tasks"]
        assert len(tasks) == 1
        assert tasks[0]["task_type"] == "manual"

    @patch("backend.common.llm_client.call_llm")
    def test_parse_annotation_invalid_json_fallback(self, mock_llm):
        """LLM 返回非法 JSON → 降级为 manual。"""
        mock_resp = MagicMock()
        mock_resp.content = "这不是 JSON"
        mock_resp.cost_cny = 0.005
        mock_llm.return_value = mock_resp

        result = ReviewDispatcherAgent.parse_annotation(
            annotation="画面模糊",
            review_task_id="rt-003",
        )

        assert result.success is True
        tasks = result.output["dispatcher_tasks"]
        assert tasks[0]["task_type"] == "manual"


class TestTaskExecutorE2E:
    """测试 TaskExecutor 路由执行。"""

    def test_manual_task_skip(self):
        """manual 任务直接标记为 manual_review_required。"""
        executor = TaskExecutor()
        ctx = AgentContext()
        tasks = [{"task_type": "manual", "target_agent": "visual_director", "description": "需人工确认"}]
        results = executor.execute_tasks(tasks, ctx)

        assert len(results) == 1
        assert results[0].success is True
        assert results[0].output["status"] == "manual_review_required"

    @patch.object(TaskExecutor, "_get_agent", return_value=None)
    def test_agent_not_found(self, mock_get):
        """目标 Agent 未注册 → 失败。"""
        executor = TaskExecutor()
        ctx = AgentContext()
        tasks = [{"task_type": "regenerate", "target_agent": "nonexistent_agent"}]
        results = executor.execute_tasks(tasks, ctx)

        assert len(results) == 1
        assert results[0].success is False
        assert "not found" in results[0].error

    @patch.object(TaskExecutor, "_get_agent")
    def test_regenerate_calls_agent(self, mock_get):
        """regenerate 任务 → 调用 Agent.execute()。"""
        mock_agent = MagicMock()
        mock_agent.execute.return_value = AgentResult(
            success=True, output={"regenerated": True}, cost_cny=0.05
        )
        mock_get.return_value = mock_agent

        executor = TaskExecutor()
        ctx = AgentContext(project_id="proj-1", genre="都市")
        tasks = [{
            "task_type": "regenerate",
            "target_agent": "visual_director",
            "target_node_id": "N07",
            "params": {"style": "明亮"},
        }]
        results = executor.execute_tasks(tasks, ctx)

        assert len(results) == 1
        assert results[0].success is True
        mock_agent.execute.assert_called_once()
        call_ctx = mock_agent.execute.call_args[0][0]
        assert call_ctx.extra["dispatcher_task_type"] == "regenerate"
        assert call_ctx.extra["regenerate"] is True

    def test_summarize_results(self):
        """summarize_results 正确汇总。"""
        results = [
            TaskResult(task_index=0, task_type="regenerate", target_agent="a", success=True, cost_cny=0.1, duration_ms=100),
            TaskResult(task_index=1, task_type="manual", target_agent="b", success=True, cost_cny=0.0, duration_ms=5),
            TaskResult(task_index=2, task_type="adjust", target_agent="c", success=False, cost_cny=0.05, duration_ms=200, error="timeout"),
        ]
        summary = TaskExecutor.summarize_results(results)

        assert summary["total_tasks"] == 3
        assert summary["succeeded"] == 2
        assert summary["failed"] == 1
        assert summary["total_cost_cny"] == 0.15


class TestAttributionE2E:
    """测试归因分析。"""

    def test_rule_based_image_issue(self):
        """图像质量关键词 → 归因到 visual_director。"""
        result = attribute_return_reason(
            decision_comment="角色脸部变形严重，五官不对",
            stage_no=1,
        )
        assert result.attributed_agent == "visual_director"
        assert result.confidence >= 0.8

    def test_rule_based_audio_issue(self):
        """音频关键词 → 归因到 audio_director。"""
        result = attribute_return_reason(
            decision_comment="配音的音色跟角色不匹配",
            stage_no=3,
        )
        assert result.attributed_agent == "audio_director"
        assert result.attributed_node_id == "N07b"

    def test_rule_based_subtitle_issue(self):
        """字幕关键词 → 归因到 compositor。"""
        result = attribute_return_reason(
            decision_comment="字幕位置遮挡画面，需要调整",
            stage_no=4,
        )
        assert result.attributed_agent == "compositor"
        assert result.attributed_node_id == "N25"

    def test_fallback_to_system_root_cause(self):
        """无关键词匹配 → 使用系统推断的 root cause。"""
        result = attribute_return_reason(
            decision_comment="整体不太行",
            system_root_cause_node_id="N14",
        )
        assert result.attributed_node_id == "N14"
        assert result.attributed_agent == "visual_director"
        assert result.confidence == 0.5

    def test_fallback_to_stage_hint(self):
        """无关键词 + 无系统推断 → 按 stage 默认归因。"""
        result = attribute_return_reason(
            decision_comment="不好",
            stage_no=2,
        )
        assert result.attributed_node_id is not None
        assert result.confidence == 0.3

    def test_unknown_returns_low_confidence(self):
        """完全无线索 → 低置信度。"""
        result = attribute_return_reason(
            decision_comment="",
            stage_no=0,
        )
        assert result.confidence <= 0.2
