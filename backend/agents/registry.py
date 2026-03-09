"""Agent Registry — 10 Agent 实例注册与查找

提供全局注册表，pipeline worker / supervisor 通过 agent_name 查找 Agent 实例。
支持懒加载：生产 Agent 仅在首次 get() 时实例化。

用法：
  from backend.agents.registry import get_agent, list_agents
  agent = get_agent("visual_director")
  result = agent.execute(context)
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.agents.base import BaseAgent

logger = logging.getLogger(__name__)

# ── Registry storage ──────────────────────────────────────────────────

_registry: dict[str, "BaseAgent"] = {}
_factories: dict[str, type["BaseAgent"]] = {}


def register_agent_class(agent_name: str, cls: type["BaseAgent"]) -> None:
    """Register an Agent class (lazy — instantiated on first get())."""
    _factories[agent_name] = cls
    logger.debug("Registered agent class: %s → %s", agent_name, cls.__name__)


def register_agent(agent: "BaseAgent") -> None:
    """Register a pre-instantiated Agent."""
    _registry[agent.agent_name] = agent
    logger.debug("Registered agent instance: %s", agent.agent_name)


def get_agent(agent_name: str) -> "BaseAgent":
    """Get an Agent by name. Instantiates from factory if not yet created.

    Raises KeyError if agent_name is not registered.
    """
    if agent_name in _registry:
        return _registry[agent_name]

    if agent_name in _factories:
        instance = _factories[agent_name]()
        _registry[agent_name] = instance
        logger.info("Instantiated agent: %s → %s", agent_name, instance.__class__.__name__)
        return instance

    raise KeyError(
        f"Agent '{agent_name}' not registered. "
        f"Available: {sorted(set(list(_registry.keys()) + list(_factories.keys())))}"
    )


def list_agents() -> list[str]:
    """List all registered agent names (both instances and factories)."""
    return sorted(set(list(_registry.keys()) + list(_factories.keys())))


def is_registered(agent_name: str) -> bool:
    """Check if an agent is registered."""
    return agent_name in _registry or agent_name in _factories


def clear_registry() -> None:
    """Clear all registrations (for testing)."""
    _registry.clear()
    _factories.clear()


# ── Auto-registration ─────────────────────────────────────────────────

def register_all_agents() -> list[str]:
    """Discover and register all available Agent classes.

    Called at startup. Uses try/except for each import so missing
    modules don't prevent other agents from loading.
    """
    registered: list[str] = []

    # 7 production agents
    _try_register = [
        ("script_analyst", "backend.agents.production.script_analyst", "ScriptAnalystAgent"),
        ("shot_designer", "backend.agents.production.shot_designer", "ShotDesignerAgent"),
        ("visual_director", "backend.agents.production.visual_director", "VisualDirectorAgent"),
        ("audio_director", "backend.agents.production.audio_director", "AudioDirectorAgent"),
        ("compositor", "backend.agents.production.compositor", "CompositorAgent"),
        ("quality_inspector", "backend.agents.production.quality_inspector", "QualityInspectorAgent"),
        ("review_dispatcher", "backend.agents.production.review_dispatcher", "ReviewDispatcherAgent"),
    ]

    # Supervisor + EvolutionEngine
    _try_register.extend([
        ("supervisor", "backend.agents.supervisor", "SupervisorAgent"),
        ("evolution_engine", "backend.agents.evolution_engine", "EvolutionEngineAgent"),
    ])

    for name, module_path, class_name in _try_register:
        try:
            import importlib
            mod = importlib.import_module(module_path)
            cls = getattr(mod, class_name)
            register_agent_class(name, cls)
            registered.append(name)
        except (ImportError, AttributeError) as exc:
            logger.debug("Skipping agent %s: %s", name, exc)

    logger.info("Registered %d/%d agents: %s", len(registered), len(_try_register), registered)
    return registered
