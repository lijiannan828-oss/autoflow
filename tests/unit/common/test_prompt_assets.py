"""Unit tests for backend.common.prompt_assets."""

from __future__ import annotations

from unittest.mock import patch

import pytest

_DB_MODULE = "backend.common.prompt_assets"


class TestComposePrompt:
    def test_master_only(self):
        from backend.common.prompt_assets import compose_prompt

        result = compose_prompt("You are a script writer.")
        assert result == "You are a script writer."

    def test_with_genre_adapter(self):
        from backend.common.prompt_assets import compose_prompt

        result = compose_prompt(
            "You are a script writer.",
            genre_adapter="注重宫廷礼仪用语",
        )
        assert "You are a script writer." in result
        assert "题材适配" in result
        assert "注重宫廷礼仪用语" in result

    def test_variable_substitution(self):
        from backend.common.prompt_assets import compose_prompt

        master = "Write a {{genre}} story about {{topic}}."
        result = compose_prompt(master, instance_vars={"genre": "武侠", "topic": "复仇"})
        assert result == "Write a 武侠 story about 复仇."

    def test_variable_substitution_with_adapter(self):
        from backend.common.prompt_assets import compose_prompt

        master = "Main: {{var1}}"
        adapter = "Adapter: {{var2}}"
        result = compose_prompt(master, genre_adapter=adapter, instance_vars={"var1": "A", "var2": "B"})
        assert "Main: A" in result
        assert "Adapter: B" in result

    def test_none_adapter_no_section(self):
        from backend.common.prompt_assets import compose_prompt

        result = compose_prompt("Base prompt", genre_adapter=None)
        assert "题材适配" not in result

    def test_empty_instance_vars(self):
        from backend.common.prompt_assets import compose_prompt

        result = compose_prompt("Hello {{name}}", instance_vars={})
        assert result == "Hello {{name}}"

    def test_missing_variable_left_as_is(self):
        from backend.common.prompt_assets import compose_prompt

        result = compose_prompt("Hello {{name}}", instance_vars={"other": "val"})
        assert "{{name}}" in result


class TestGetActivePrompt:
    @patch(f"{_DB_MODULE}.fetch_one")
    def test_returns_prompt(self, mock_fetch):
        from backend.common.prompt_assets import get_active_prompt

        mock_fetch.return_value = {
            "id": "p-1",
            "agent_name": "visual_director",
            "prompt_stage": "keyframe_gen",
            "master_system_prompt": "You generate keyframes.",
            "is_active": True,
        }
        result = get_active_prompt("visual_director", "keyframe_gen")
        assert result["id"] == "p-1"

    @patch(f"{_DB_MODULE}.fetch_one")
    def test_returns_none_when_missing(self, mock_fetch):
        from backend.common.prompt_assets import get_active_prompt

        mock_fetch.return_value = None
        assert get_active_prompt("unknown", "stage") is None


class TestCreatePrompt:
    @patch(f"{_DB_MODULE}.execute_returning_one")
    @patch(f"{_DB_MODULE}.execute")
    def test_deactivates_old_and_creates(self, mock_exec, mock_exec_ret):
        from backend.common.prompt_assets import create_prompt

        mock_exec_ret.return_value = {
            "id": "p-new",
            "agent_name": "script_writer",
            "master_version": "v1.0",
        }
        result = create_prompt("script_writer", "draft", "You write scripts.")
        assert result["id"] == "p-new"
        # Verify deactivation query was called
        mock_exec.assert_called_once()
        deactivate_query = mock_exec.call_args[0][0]
        assert "is_active = false" in deactivate_query


class TestBumpVersion:
    def test_simple_bump(self):
        from backend.common.prompt_assets import _bump_version

        assert _bump_version("v1.0") == "v1.1"
        assert _bump_version("v2.3") == "v2.4"
        assert _bump_version("v1.9") == "v1.10"

    def test_no_v_prefix(self):
        from backend.common.prompt_assets import _bump_version

        assert _bump_version("1.0") == "v1.0"

    def test_single_part(self):
        from backend.common.prompt_assets import _bump_version

        assert _bump_version("v3") == "v3.1"


class TestListPrompts:
    @patch(f"{_DB_MODULE}.fetch_all")
    def test_list_active(self, mock_fetch):
        from backend.common.prompt_assets import list_prompts

        mock_fetch.return_value = [{"id": "p1"}, {"id": "p2"}]
        result = list_prompts(agent_name="visual_director")
        assert len(result) == 2
        query = mock_fetch.call_args[0][0]
        assert "is_active = true" in query
        assert "agent_name = %s" in query

    @patch(f"{_DB_MODULE}.fetch_all")
    def test_list_all(self, mock_fetch):
        from backend.common.prompt_assets import list_prompts

        mock_fetch.return_value = []
        list_prompts(active_only=False)
        query = mock_fetch.call_args[0][0]
        assert "is_active" not in query
