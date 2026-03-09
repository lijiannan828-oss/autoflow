"""Unit tests for pipeline handler modules — T4: handler test framework.

Covers:
- register_all_handlers() succeeds and registers expected handlers
- Each handler module has a callable register() function
- Handler functions exist and are callable
- N01 (script_stage): mock LLM, verify state changes
- N03 (qc_handlers): mock multi-vote, verify scoring logic
- N09 (freeze_handlers): mock TOS, verify freeze artifact creation
"""

from __future__ import annotations

import importlib
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import _handlers, register_handler


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_handler_registry():
    """Clear and restore the handler registry around each test."""
    saved = dict(_handlers)
    _handlers.clear()
    yield
    _handlers.clear()
    _handlers.update(saved)


@pytest.fixture
def _clear_module_registered_flags():
    """Reset the _REGISTERED flag in handler modules so register() can be called again."""
    modules_to_reset = [
        "backend.orchestrator.handlers.script_stage",
        "backend.orchestrator.handlers.qc_handlers",
        "backend.orchestrator.handlers.freeze_handlers",
        "backend.orchestrator.handlers.comfyui_gen",
        "backend.orchestrator.handlers.analysis_handlers",
        "backend.orchestrator.handlers.av_handlers",
        "backend.orchestrator.handlers.voice_handler",
        "backend.orchestrator.handlers.tone_handler",
    ]
    for mod_path in modules_to_reset:
        try:
            mod = importlib.import_module(mod_path)
            if hasattr(mod, "_REGISTERED"):
                mod._REGISTERED = False
        except ImportError:
            pass
    yield
    # Re-reset after test
    for mod_path in modules_to_reset:
        try:
            mod = importlib.import_module(mod_path)
            if hasattr(mod, "_REGISTERED"):
                mod._REGISTERED = False
        except ImportError:
            pass


# ---------------------------------------------------------------------------
# Test: register_all_handlers
# ---------------------------------------------------------------------------

class TestRegisterAllHandlers:
    """Verify register_all_handlers() loads all handler modules."""

    def test_register_all_handlers_returns_list(self, _clear_module_registered_flags):
        from backend.orchestrator.handlers import register_all_handlers
        result = register_all_handlers()
        assert isinstance(result, list)

    def test_register_all_handlers_registers_expected_modules(self, _clear_module_registered_flags):
        from backend.orchestrator.handlers import register_all_handlers
        result = register_all_handlers()
        expected_modules = {
            "script_stage",
            "qc_handlers",
            "comfyui_gen",
            "freeze_handlers",
            "analysis_handlers",
            "av_handlers",
            "voice_handler",
            "tone_handler",
        }
        assert set(result) == expected_modules, (
            f"Missing modules: {expected_modules - set(result)}, "
            f"Extra modules: {set(result) - expected_modules}"
        )

    def test_register_all_handlers_populates_registry(self, _clear_module_registered_flags):
        from backend.orchestrator.handlers import register_all_handlers
        register_all_handlers()
        # All 28 pipeline nodes minus 4 gates = 24 worker nodes should have handlers
        expected_handler_nodes = {
            # script_stage
            "N01", "N02", "N04", "N05", "N06",
            # qc_handlers
            "N03", "N11", "N15",
            # comfyui_gen
            "N07", "N10", "N14",
            # freeze_handlers
            "N09", "N13", "N17", "N19", "N22", "N25", "N26",
            # analysis_handlers
            "N12", "N16",
            # av_handlers
            "N20", "N23",
            # voice_handler
            "N07b",
            # tone_handler
            "N16b",
        }
        assert set(_handlers.keys()) == expected_handler_nodes


# ---------------------------------------------------------------------------
# Test: Individual handler module register() functions
# ---------------------------------------------------------------------------

class TestHandlerModuleRegistration:
    """Each handler module exposes a callable register() function."""

    @pytest.mark.parametrize("module_path,expected_nodes", [
        ("backend.orchestrator.handlers.script_stage", ["N01", "N02", "N04", "N05", "N06"]),
        ("backend.orchestrator.handlers.qc_handlers", ["N03", "N11", "N15"]),
        ("backend.orchestrator.handlers.comfyui_gen", ["N07", "N10", "N14"]),
        ("backend.orchestrator.handlers.freeze_handlers", ["N09", "N13", "N17", "N19", "N22", "N25", "N26"]),
        ("backend.orchestrator.handlers.analysis_handlers", ["N12", "N16"]),
        ("backend.orchestrator.handlers.av_handlers", ["N20", "N23"]),
        ("backend.orchestrator.handlers.voice_handler", ["N07b"]),
        ("backend.orchestrator.handlers.tone_handler", ["N16b"]),
    ])
    def test_module_register_is_callable(self, module_path, expected_nodes, _clear_module_registered_flags):
        mod = importlib.import_module(module_path)
        assert hasattr(mod, "register"), f"{module_path} has no register()"
        assert callable(mod.register), f"{module_path}.register is not callable"

    @pytest.mark.parametrize("module_path,expected_nodes", [
        ("backend.orchestrator.handlers.script_stage", ["N01", "N02", "N04", "N05", "N06"]),
        ("backend.orchestrator.handlers.qc_handlers", ["N03", "N11", "N15"]),
        ("backend.orchestrator.handlers.comfyui_gen", ["N07", "N10", "N14"]),
        ("backend.orchestrator.handlers.freeze_handlers", ["N09", "N13", "N17", "N19", "N22", "N25", "N26"]),
        ("backend.orchestrator.handlers.analysis_handlers", ["N12", "N16"]),
        ("backend.orchestrator.handlers.av_handlers", ["N20", "N23"]),
        ("backend.orchestrator.handlers.voice_handler", ["N07b"]),
        ("backend.orchestrator.handlers.tone_handler", ["N16b"]),
    ])
    def test_module_registers_expected_nodes(self, module_path, expected_nodes, _clear_module_registered_flags):
        mod = importlib.import_module(module_path)
        mod.register()
        for nid in expected_nodes:
            assert nid in _handlers, f"{module_path} did not register handler for {nid}"
            assert callable(_handlers[nid]), f"Handler for {nid} is not callable"


# ---------------------------------------------------------------------------
# Test: Handler function signatures and callability
# ---------------------------------------------------------------------------

class TestHandlerFunctionCallability:
    """Verify each handler function exists in its module and is callable."""

    @pytest.mark.parametrize("module_path,func_name", [
        ("backend.orchestrator.handlers.script_stage", "handle_n01"),
        ("backend.orchestrator.handlers.script_stage", "handle_n02"),
        ("backend.orchestrator.handlers.script_stage", "handle_n04"),
        ("backend.orchestrator.handlers.script_stage", "handle_n05"),
        ("backend.orchestrator.handlers.script_stage", "handle_n06"),
        ("backend.orchestrator.handlers.qc_handlers", "handle_n03"),
        ("backend.orchestrator.handlers.qc_handlers", "handle_n11"),
        ("backend.orchestrator.handlers.qc_handlers", "handle_n15"),
        ("backend.orchestrator.handlers.freeze_handlers", "handle_n09"),
        ("backend.orchestrator.handlers.freeze_handlers", "handle_n13"),
        ("backend.orchestrator.handlers.freeze_handlers", "handle_n17"),
        ("backend.orchestrator.handlers.freeze_handlers", "handle_n19"),
        ("backend.orchestrator.handlers.freeze_handlers", "handle_n22"),
        ("backend.orchestrator.handlers.freeze_handlers", "handle_n25"),
        ("backend.orchestrator.handlers.freeze_handlers", "handle_n26"),
    ])
    def test_handler_function_exists_and_callable(self, module_path, func_name):
        mod = importlib.import_module(module_path)
        assert hasattr(mod, func_name), f"{module_path} missing function {func_name}"
        func = getattr(mod, func_name)
        assert callable(func), f"{func_name} is not callable"


# ---------------------------------------------------------------------------
# Test: N01 handler with mock LLM
# ---------------------------------------------------------------------------

class TestN01Handler:
    """N01 (script_stage): mock LLM, verify expected state changes."""

    @patch("backend.orchestrator.handlers.script_stage.call_llm")
    @patch("backend.orchestrator.handlers.script_stage.upload_json")
    def test_n01_returns_succeeded_with_parsed_script(
        self, mock_upload, mock_call_llm, make_state
    ):
        from backend.orchestrator.handlers.script_stage import handle_n01

        # Set up mock LLM response
        mock_llm_response = MagicMock()
        mock_llm_response.parsed = {
            "title": "Test Drama",
            "genre": "urban",
            "character_registry": [{"character_id": "c1", "name": "Hero"}],
            "episodes": [{"episode_id": "ep1", "episode_number": 1}],
            "total_episodes": 1,
            "total_scenes": 3,
            "total_estimated_shots": 30,
        }
        mock_llm_response.model = "test-model"
        mock_llm_response.cost_cny = 0.05
        mock_llm_response.usage = {"prompt_tokens": 100, "completion_tokens": 200}
        mock_llm_response.duration_s = 1.5
        mock_call_llm.return_value = mock_llm_response

        mock_upload.return_value = "tos://test-bucket/output.json"

        state = make_state()
        config: dict[str, Any] = {"node_id": "N01"}

        result = handle_n01("N01", state, config)

        assert isinstance(result, dict)
        assert result["node_id"] == "N01"
        assert result["status"] == "succeeded"
        assert result["output_ref"] == "tos://test-bucket/output.json"
        assert result["cost_cny"] == 0.05
        # Payload should contain parsed script with enrichment
        payload = result.get("output_payload", {})
        assert payload["title"] == "Test Drama"
        assert "parsed_at" in payload
        assert payload["parser_model"] == "test-model"

    @patch("backend.orchestrator.handlers.script_stage.call_llm")
    def test_n01_returns_failed_on_llm_error(self, mock_call_llm, make_state):
        from backend.common.llm_client import LLMError
        from backend.orchestrator.handlers.script_stage import handle_n01

        mock_call_llm.side_effect = LLMError("API timeout")

        state = make_state()
        result = handle_n01("N01", state, {"node_id": "N01"})

        assert result["status"] == "failed"
        assert result["error_code"] == "LLM_CALL_FAILED"
        assert "API timeout" in result["error"]


# ---------------------------------------------------------------------------
# Test: N03 handler with mock multi-vote LLM
# ---------------------------------------------------------------------------

class TestN03Handler:
    """N03 (qc_handlers): mock multi-vote, verify scoring logic."""

    def _make_llm_response(self, model_name: str, dimensions: dict, issues: list | None = None):
        resp = MagicMock()
        resp.model = model_name
        resp.parsed = {
            "dimensions": dimensions,
            "weighted_average": sum(dimensions.values()) / len(dimensions),
            "issues": issues or [],
            "overall_comment": f"Review by {model_name}",
        }
        resp.cost_cny = 0.03
        resp.usage = {"prompt_tokens": 50, "completion_tokens": 100}
        resp.duration_s = 2.0
        return resp

    @patch("backend.orchestrator.handlers.qc_handlers.upload_json")
    @patch("backend.orchestrator.handlers.qc_handlers.call_llm_multi_vote")
    def test_n03_pass_with_high_scores(
        self, mock_multi_vote, mock_upload, make_state
    ):
        from backend.orchestrator.handlers.qc_handlers import handle_n03

        high_scores = {
            "narrative_coherence": 9.0,
            "visual_feasibility": 8.5,
            "pacing": 8.0,
            "character_consistency": 9.0,
            "technical_compliance": 8.5,
            "emotional_impact": 8.0,
        }
        mock_multi_vote.return_value = [
            self._make_llm_response("model-a", high_scores),
            self._make_llm_response("model-b", high_scores),
            self._make_llm_response("model-c", high_scores),
        ]
        mock_upload.return_value = "tos://test/n03/output.json"

        state = make_state()
        # Inject N02 output reference so handler can load it
        state["node_outputs"] = {
            "N02": {"output_ref": "tos://test/n02/output.json"},
        }
        # Cache the N02 payload so load_node_output_payload can find it
        from backend.orchestrator.graph.workers import _output_payload_cache
        _output_payload_cache["tos://test/n02/output.json"] = {
            "episode_id": "ep1",
            "scenes": [{"scene_id": "s1", "shots": []}],
        }

        result = handle_n03("N03", state, {"node_id": "N03"})

        assert result["status"] == "succeeded"
        assert result["quality_score"] is not None
        assert result["quality_score"] >= 8.0
        payload = result.get("output_payload", {})
        assert payload["decision"] == "pass"
        assert payload["is_passed"] is True

        # Cleanup
        _output_payload_cache.pop("tos://test/n02/output.json", None)

    @patch("backend.orchestrator.handlers.qc_handlers.upload_json")
    @patch("backend.orchestrator.handlers.qc_handlers.call_llm_multi_vote")
    def test_n03_reject_with_low_scores(
        self, mock_multi_vote, mock_upload, make_state
    ):
        from backend.orchestrator.handlers.qc_handlers import handle_n03

        low_scores = {
            "narrative_coherence": 5.0,
            "visual_feasibility": 6.0,
            "pacing": 5.5,
            "character_consistency": 6.0,
            "technical_compliance": 5.0,
            "emotional_impact": 5.5,
        }
        mock_multi_vote.return_value = [
            self._make_llm_response("model-a", low_scores),
            self._make_llm_response("model-b", low_scores),
            self._make_llm_response("model-c", low_scores),
        ]
        mock_upload.return_value = "tos://test/n03/output.json"

        state = make_state()
        state["node_outputs"] = {
            "N02": {"output_ref": "tos://test/n02/output-low.json"},
        }
        from backend.orchestrator.graph.workers import _output_payload_cache
        _output_payload_cache["tos://test/n02/output-low.json"] = {
            "episode_id": "ep1",
            "scenes": [],
        }

        result = handle_n03("N03", state, {"node_id": "N03"})

        assert result["status"] == "auto_rejected"
        payload = result.get("output_payload", {})
        assert payload["decision"] == "reject"
        assert payload["is_passed"] is False
        assert result["quality_score"] < 8.0

        _output_payload_cache.pop("tos://test/n02/output-low.json", None)

    @patch("backend.orchestrator.handlers.qc_handlers.upload_json")
    @patch("backend.orchestrator.handlers.qc_handlers.call_llm_multi_vote")
    def test_n03_drop_extremes_with_3_models(
        self, mock_multi_vote, mock_upload, make_state
    ):
        """With 3 models, drop extremes should take the middle value."""
        from backend.orchestrator.handlers.qc_handlers import handle_n03

        # Model A: low outlier, Model B: middle, Model C: high outlier
        mock_multi_vote.return_value = [
            self._make_llm_response("model-a", {
                "narrative_coherence": 5.0, "visual_feasibility": 5.0,
                "pacing": 5.0, "character_consistency": 5.0,
                "technical_compliance": 5.0, "emotional_impact": 5.0,
            }),
            self._make_llm_response("model-b", {
                "narrative_coherence": 8.5, "visual_feasibility": 8.5,
                "pacing": 8.5, "character_consistency": 8.5,
                "technical_compliance": 8.5, "emotional_impact": 8.5,
            }),
            self._make_llm_response("model-c", {
                "narrative_coherence": 10.0, "visual_feasibility": 10.0,
                "pacing": 10.0, "character_consistency": 10.0,
                "technical_compliance": 10.0, "emotional_impact": 10.0,
            }),
        ]
        mock_upload.return_value = "tos://test/n03/output.json"

        state = make_state()
        state["node_outputs"] = {
            "N02": {"output_ref": "tos://test/n02/output-extremes.json"},
        }
        from backend.orchestrator.graph.workers import _output_payload_cache
        _output_payload_cache["tos://test/n02/output-extremes.json"] = {"episode_id": "ep1", "scenes": []}

        result = handle_n03("N03", state, {"node_id": "N03"})

        # With drop-extremes, the middle score (8.5) should dominate
        assert result["quality_score"] == 8.5
        assert result["status"] == "succeeded"

        _output_payload_cache.pop("tos://test/n02/output-extremes.json", None)


# ---------------------------------------------------------------------------
# Test: N09 handler with mock TOS
# ---------------------------------------------------------------------------

class TestN09Handler:
    """N09 (freeze_handlers): mock TOS, verify freeze artifact creation."""

    @patch("backend.orchestrator.handlers.freeze_handlers.upload_json")
    def test_n09_freezes_selected_assets(self, mock_upload, make_state):
        from backend.orchestrator.handlers.freeze_handlers import handle_n09

        mock_upload.return_value = "tos://test/n09/output.json"

        state = make_state()
        # Inject N08 gate output with selected assets
        state["node_outputs"] = {
            "N08": {"output_ref": "tos://test/n08/output.json"},
        }
        from backend.orchestrator.graph.workers import _output_payload_cache
        _output_payload_cache["tos://test/n08/output.json"] = {
            "selected_assets": [
                {
                    "asset_id": "char-001",
                    "asset_type": "character",
                    "selected_candidate_id": "cand-a",
                    "image_ref": "tos://test/char-001.png",
                },
                {
                    "asset_id": "loc-001",
                    "asset_type": "location",
                    "selected_candidate_id": "cand-b",
                    "image_ref": "tos://test/loc-001.png",
                },
            ],
        }

        result = handle_n09("N09", state, {"node_id": "N09"})

        assert result["status"] == "succeeded"
        payload = result.get("output_payload", {})
        assert payload["total_frozen"] == 2

        frozen_assets = payload["frozen_assets"]
        assert len(frozen_assets) == 2

        # Verify character asset
        char_asset = next(a for a in frozen_assets if a["target_id"] == "char-001")
        assert char_asset["asset_type"] == "character"
        assert char_asset["frozen_at"] is not None
        assert char_asset["selected_candidate_id"] == "cand-a"
        assert char_asset["base_image"]["uri"] == "tos://test/char-001.png"
        assert len(char_asset["variants"]) >= 1

        # Verify location asset
        loc_asset = next(a for a in frozen_assets if a["target_id"] == "loc-001")
        assert loc_asset["asset_type"] == "location"

        _output_payload_cache.pop("tos://test/n08/output.json", None)

    @patch("backend.orchestrator.handlers.freeze_handlers.upload_json")
    def test_n09_handles_empty_selection(self, mock_upload, make_state):
        """N09 should handle case where no assets are selected gracefully."""
        from backend.orchestrator.handlers.freeze_handlers import handle_n09

        mock_upload.return_value = "tos://test/n09/output.json"

        state = make_state()
        # No N08 output and no N07 output → empty selection
        result = handle_n09("N09", state, {"node_id": "N09"})

        assert result["status"] == "succeeded"
        payload = result.get("output_payload", {})
        assert payload["total_frozen"] == 0
        assert payload["frozen_assets"] == []

    @patch("backend.orchestrator.handlers.freeze_handlers.upload_json")
    def test_n09_validates_asset_type(self, mock_upload, make_state):
        """N09 should default invalid asset_type to 'prop'."""
        from backend.orchestrator.handlers.freeze_handlers import handle_n09

        mock_upload.return_value = "tos://test/n09/output.json"

        state = make_state()
        state["node_outputs"] = {
            "N08": {"output_ref": "tos://test/n08/invalid-type.json"},
        }
        from backend.orchestrator.graph.workers import _output_payload_cache
        _output_payload_cache["tos://test/n08/invalid-type.json"] = {
            "selected_assets": [
                {
                    "asset_id": "bad-001",
                    "asset_type": "invalid_type",
                    "image_ref": "tos://test/bad.png",
                },
            ],
        }

        result = handle_n09("N09", state, {"node_id": "N09"})

        assert result["status"] == "succeeded"
        payload = result.get("output_payload", {})
        assert payload["frozen_assets"][0]["asset_type"] == "prop"

        _output_payload_cache.pop("tos://test/n08/invalid-type.json", None)


# ---------------------------------------------------------------------------
# Test: QC scoring helpers
# ---------------------------------------------------------------------------

class TestQCScoringHelpers:
    """Unit tests for QC score aggregation functions."""

    def test_aggregate_scores_drop_extremes_3_models(self):
        from backend.orchestrator.handlers.qc_handlers import _aggregate_scores_drop_extremes

        weights = {"dim_a": 0.5, "dim_b": 0.5}
        all_scores = [
            {"dim_a": 3.0, "dim_b": 4.0},  # low outlier
            {"dim_a": 7.0, "dim_b": 8.0},  # middle
            {"dim_a": 10.0, "dim_b": 9.0},  # high outlier
        ]
        aggregated, weighted_avg = _aggregate_scores_drop_extremes(all_scores, weights)

        # Should drop 3.0 and 10.0, keep 7.0 for dim_a
        assert aggregated["dim_a"] == 7.0
        # Should drop 4.0 and 9.0, keep 8.0 for dim_b
        assert aggregated["dim_b"] == 8.0
        assert weighted_avg == 7.5  # 7.0*0.5 + 8.0*0.5

    def test_aggregate_scores_average_2_models(self):
        from backend.orchestrator.handlers.qc_handlers import _aggregate_scores_drop_extremes

        weights = {"dim_a": 1.0}
        all_scores = [
            {"dim_a": 6.0},
            {"dim_a": 8.0},
        ]
        aggregated, weighted_avg = _aggregate_scores_drop_extremes(all_scores, weights)

        assert aggregated["dim_a"] == 7.0  # average
        assert weighted_avg == 7.0

    def test_aggregate_scores_single_model(self):
        from backend.orchestrator.handlers.qc_handlers import _aggregate_scores_drop_extremes

        weights = {"dim_a": 1.0}
        all_scores = [{"dim_a": 9.0}]
        aggregated, weighted_avg = _aggregate_scores_drop_extremes(all_scores, weights)

        assert aggregated["dim_a"] == 9.0
        assert weighted_avg == 9.0

    def test_aggregate_scores_empty(self):
        from backend.orchestrator.handlers.qc_handlers import _aggregate_scores_drop_extremes

        weights = {"dim_a": 1.0}
        aggregated, weighted_avg = _aggregate_scores_drop_extremes([], weights)

        assert aggregated["dim_a"] == 0.0
        assert weighted_avg == 0.0

    def test_select_models_by_tier(self):
        from backend.orchestrator.handlers.qc_handlers import _select_models_by_tier

        tier1 = _select_models_by_tier("tier_1_full")
        tier2 = _select_models_by_tier("tier_2_dual")
        tier3 = _select_models_by_tier("tier_3_single")

        assert len(tier1) == 3
        assert len(tier2) == 2
        assert len(tier3) == 1

    def test_n15_critical_thresholds(self):
        from backend.orchestrator.handlers.qc_handlers import _check_n15_critical_thresholds

        # All good
        ok_dims = {
            "character_consistency": 8.0,
            "motion_fluidity": 7.0,
            "physics_plausibility": 7.0,
            "action_accuracy": 7.0,
            "expression_match": 7.0,
            "composition": 7.0,
            "lighting_consistency": 7.0,
            "continuity_score": 7.0,
        }
        reject, reason = _check_n15_critical_thresholds(ok_dims)
        assert reject is False

        # character_consistency < 7.0
        bad_cc = dict(ok_dims, character_consistency=6.5)
        reject, reason = _check_n15_critical_thresholds(bad_cc)
        assert reject is True
        assert "character_consistency" in reason

        # physics_plausibility < 6.0
        bad_pp = dict(ok_dims, physics_plausibility=5.5)
        reject, reason = _check_n15_critical_thresholds(bad_pp)
        assert reject is True
        assert "physics_plausibility" in reason

        # Any dimension < 5.0 (floor)
        bad_floor = dict(ok_dims, motion_fluidity=4.5)
        reject, reason = _check_n15_critical_thresholds(bad_floor)
        assert reject is True
        assert "motion_fluidity" in reason
