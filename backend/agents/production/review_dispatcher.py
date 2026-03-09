"""ReviewDispatcherAgent — 审核调度 Agent

负责节点: N08, N18, N21, N24 (4 个 Gate 节点)
职能:
  1. 创建人工审核任务、分发给审核员、处理审核决策
  2. 自然语言批注 → LLM 解析 → 结构化任务拆分
  3. 打回归因分析

真实实现位于 backend/agents/dispatch/review_dispatcher.py
此文件为兼容层，确保 Registry 自动发现正常工作。
"""

# Re-export from the dispatch module (V1 real implementation)
from backend.agents.dispatch.review_dispatcher import ReviewDispatcherAgent  # noqa: F401

__all__ = ["ReviewDispatcherAgent"]
