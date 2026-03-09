"""Unit tests for backend.common.llm_client."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from backend.common.llm_client import (
    LLMError,
    LLMResponse,
    MODEL_PRICING,
    _calc_cost_cny,
    _lookup_pricing,
    _parse_llm_response,
    aggregate_llm_costs,
    call_llm,
    call_llm_multi_vote,
)


# ── Helpers ──────────────────────────────────────────────────────────

def _make_api_response(content="hello", model="gpt-4o", prompt_tokens=100, completion_tokens=50):
    """Build a fake OpenAI-compatible API response dict."""
    return {
        "choices": [{"message": {"content": content}}],
        "model": model,
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
        },
    }


def _mock_httpx_success(response_data, status_code=200):
    """Return a mock httpx response object."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = response_data
    resp.text = json.dumps(response_data)
    return resp


# ── LLMResponse dataclass ───────────────────────────────────────────

class TestLLMResponseDataclass:
    def test_defaults(self):
        r = LLMResponse(content="hi")
        assert r.content == "hi"
        assert r.parsed is None
        assert r.model == ""
        assert r.usage == {}
        assert r.cost_cny == 0.0
        assert r.duration_s == 0.0

    def test_all_fields(self):
        r = LLMResponse(
            content="ok",
            parsed={"k": "v"},
            model="gpt-4o",
            usage={"prompt_tokens": 10},
            cost_cny=0.5,
            duration_s=1.2,
        )
        assert r.parsed == {"k": "v"}
        assert r.cost_cny == 0.5


# ── Pricing helpers ─────────────────────────────────────────────────

class TestPricing:
    def test_lookup_exact_match(self):
        ip, op = _lookup_pricing("gpt-4o")
        assert ip > 0 and op > 0

    def test_lookup_prefix_match(self):
        """A versioned model name should match its base prefix."""
        ip, op = _lookup_pricing("gpt-4o-2025-08-07")
        assert ip > 0 and op > 0

    def test_lookup_unknown_model(self):
        ip, op = _lookup_pricing("unknown-model-xyz")
        assert ip == 0.0 and op == 0.0

    def test_calc_cost_cny(self):
        usage = {"prompt_tokens": 1_000_000, "completion_tokens": 0}
        cost = _calc_cost_cny("gpt-4o", usage)
        expected_input_price = MODEL_PRICING["gpt-4o"][0]
        assert abs(cost - expected_input_price) < 0.01

    def test_calc_cost_zero_for_unknown(self):
        usage = {"prompt_tokens": 500, "completion_tokens": 500}
        assert _calc_cost_cny("no-such-model", usage) == 0.0


# ── _parse_llm_response ─────────────────────────────────────────────

class TestParseLLMResponse:
    def test_plain_text(self):
        data = _make_api_response(content="plain text")
        resp = _parse_llm_response(data, "gpt-4o", 1.5, json_mode=False)
        assert resp.content == "plain text"
        assert resp.parsed is None
        assert resp.duration_s == 1.5

    def test_json_mode_valid(self):
        payload = {"decision": "pass", "score": 8}
        data = _make_api_response(content=json.dumps(payload))
        resp = _parse_llm_response(data, "gpt-4o", 1.0, json_mode=True)
        assert resp.parsed == payload

    def test_json_mode_markdown_wrapper(self):
        """Some models wrap JSON in ```json ... ``` blocks."""
        inner = {"result": "ok"}
        wrapped = f"```json\n{json.dumps(inner)}\n```"
        data = _make_api_response(content=wrapped)
        resp = _parse_llm_response(data, "gpt-4o", 1.0, json_mode=True)
        assert resp.parsed == inner

    def test_json_mode_invalid_returns_none(self):
        data = _make_api_response(content="not json at all")
        resp = _parse_llm_response(data, "gpt-4o", 1.0, json_mode=True)
        assert resp.parsed is None
        assert resp.content == "not json at all"


# ── call_llm with mocked httpx ──────────────────────────────────────

class TestCallLLM:
    @patch("backend.common.llm_client.get_llm_api_key", return_value="test-key")
    @patch("backend.common.llm_client.get_llm_base_url", return_value="https://fake.api/v1")
    @patch("backend.common.llm_client.httpx.Client")
    def test_successful_call(self, mock_client_cls, _url, _key):
        api_data = _make_api_response(content="hello world", model="gpt-4o")
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = _mock_httpx_success(api_data)
        mock_client_cls.return_value = mock_client

        resp = call_llm("gpt-4o", "sys", "user", max_retries=1, fallback=False)
        assert resp.content == "hello world"
        assert resp.model == "gpt-4o"
        mock_client.post.assert_called_once()

    @patch("backend.common.llm_client.get_llm_api_key", return_value="test-key")
    @patch("backend.common.llm_client.get_llm_base_url", return_value="https://fake.api/v1")
    @patch("backend.common.llm_client.httpx.Client")
    @patch("backend.common.llm_client.time.sleep")  # skip actual sleep
    def test_retry_on_500(self, mock_sleep, mock_client_cls, _url, _key):
        api_data = _make_api_response(content="recovered")
        fail_resp = MagicMock()
        fail_resp.status_code = 500
        fail_resp.text = "internal error"
        success_resp = _mock_httpx_success(api_data)

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.side_effect = [fail_resp, success_resp]
        mock_client_cls.return_value = mock_client

        resp = call_llm("gpt-4o", "sys", "user", max_retries=3, fallback=False)
        assert resp.content == "recovered"
        assert mock_client.post.call_count == 2

    @patch("backend.common.llm_client.get_llm_api_key", return_value="test-key")
    @patch("backend.common.llm_client.get_llm_base_url", return_value="https://fake.api/v1")
    @patch("backend.common.llm_client.httpx.Client")
    @patch("backend.common.llm_client.time.sleep")
    def test_fallback_to_alternate_model(self, mock_sleep, mock_client_cls, _url, _key):
        """When primary model fails all retries, falls back to next model."""
        api_data = _make_api_response(content="from fallback", model="gpt-4o")
        fail_resp = MagicMock()
        fail_resp.status_code = 400  # non-retryable
        fail_resp.text = "bad request"
        success_resp = _mock_httpx_success(api_data)

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        # First call (primary) fails, second call (fallback) succeeds
        mock_client.post.side_effect = [fail_resp, success_resp]
        mock_client_cls.return_value = mock_client

        resp = call_llm("gpt-5", "sys", "user", max_retries=1, fallback=True)
        assert resp.content == "from fallback"
        assert mock_client.post.call_count == 2

    @patch("backend.common.llm_client.get_llm_api_key", return_value="test-key")
    @patch("backend.common.llm_client.get_llm_base_url", return_value="https://fake.api/v1")
    @patch("backend.common.llm_client.httpx.Client")
    def test_raises_on_all_failures(self, mock_client_cls, _url, _key):
        fail_resp = MagicMock()
        fail_resp.status_code = 400
        fail_resp.text = "bad"

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = fail_resp
        mock_client_cls.return_value = mock_client

        with pytest.raises(LLMError):
            call_llm("unknown-model-no-fallbacks", "sys", "user", max_retries=1, fallback=False)


# ── call_llm_multi_vote ─────────────────────────────────────────────

class TestCallLLMMultiVote:
    @patch("backend.common.llm_client.call_llm")
    def test_collects_results(self, mock_call):
        r1 = LLMResponse(content="a", model="m1", cost_cny=0.1, duration_s=1.0,
                          usage={"prompt_tokens": 10, "completion_tokens": 5})
        r2 = LLMResponse(content="b", model="m2", cost_cny=0.2, duration_s=1.5,
                          usage={"prompt_tokens": 20, "completion_tokens": 10})
        mock_call.side_effect = [r1, r2]

        results = call_llm_multi_vote(["m1", "m2"], "sys", "user", fallback=False)
        assert len(results) == 2

    @patch("backend.common.llm_client.call_llm")
    def test_partial_failure(self, mock_call):
        """At least one success is enough."""
        r1 = LLMResponse(content="ok", model="m1", cost_cny=0.1, duration_s=1.0)
        mock_call.side_effect = [r1, LLMError("fail")]

        results = call_llm_multi_vote(["m1", "m2"], "sys", "user", fallback=False)
        assert len(results) == 1

    @patch("backend.common.llm_client.call_llm")
    def test_all_failures_raises(self, mock_call):
        mock_call.side_effect = LLMError("all dead")
        with pytest.raises(LLMError, match="All models failed"):
            call_llm_multi_vote(["m1", "m2"], "sys", "user", fallback=False)


# ── aggregate_llm_costs ─────────────────────────────────────────────

class TestAggregateLLMCosts:
    def test_sum_costs(self):
        responses = [
            LLMResponse(content="a", cost_cny=0.5, duration_s=1.0,
                        model="m1", usage={"prompt_tokens": 100, "completion_tokens": 50}),
            LLMResponse(content="b", cost_cny=1.5, duration_s=2.0,
                        model="m2", usage={"prompt_tokens": 200, "completion_tokens": 100}),
        ]
        agg = aggregate_llm_costs(responses)
        assert agg["cost_cny"] == 2.0
        assert agg["token_in"] == 300
        assert agg["token_out"] == 150
        # duration is max (parallel)
        assert agg["duration_s"] == 2.0
        assert len(agg["model_calls"]) == 2

    def test_empty_list(self):
        agg = aggregate_llm_costs([])
        assert agg["cost_cny"] == 0
        assert agg["duration_s"] == 0.0
