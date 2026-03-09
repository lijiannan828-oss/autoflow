"""Unified handler registration for all real pipeline node handlers.

Called at pipeline startup to replace stub handlers with real implementations.
Each handler module provides a register() function that calls register_handler().
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def register_all_handlers() -> list[str]:
    """Import and register all handler modules. Returns list of registered module names.

    Uses try/except per module so partially-ready codebase still works.
    """
    registered: list[str] = []

    modules = [
        ("script_stage", "backend.orchestrator.handlers.script_stage"),
        ("qc_handlers", "backend.orchestrator.handlers.qc_handlers"),
        ("comfyui_gen", "backend.orchestrator.handlers.comfyui_gen"),
        ("freeze_handlers", "backend.orchestrator.handlers.freeze_handlers"),
        ("analysis_handlers", "backend.orchestrator.handlers.analysis_handlers"),
        ("av_handlers", "backend.orchestrator.handlers.av_handlers"),
        ("voice_handler", "backend.orchestrator.handlers.voice_handler"),
        ("tone_handler", "backend.orchestrator.handlers.tone_handler"),
    ]

    for name, module_path in modules:
        try:
            import importlib
            mod = importlib.import_module(module_path)
            if hasattr(mod, "register"):
                mod.register()
                registered.append(name)
                logger.info("Registered handler module: %s", name)
            else:
                logger.warning("Module %s has no register() function", name)
        except ImportError as exc:
            logger.debug("Handler module %s not yet available: %s", name, exc)
        except Exception as exc:
            logger.warning("Failed to register handler module %s: %s", name, exc)

    logger.info("Handler registration complete: %d/%d modules loaded", len(registered), len(modules))
    return registered
