"""OpenAI-compatible LLM client via dmxapi.cn proxy.

Provides synchronous call_llm() and call_llm_multi_vote() for all
pipeline nodes that need LLM inference.

Includes per-call cost tracking based on token usage and model pricing.
Includes retry with exponential backoff and model fallback/degradation.
"""

from __future__ import annotations

import json
import logging
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

import httpx

from backend.common.env import get_llm_api_key, get_llm_base_url

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 120.0  # seconds
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_RETRY_BASE_DELAY = 1.0  # seconds, doubled each retry + jitter

# ── Model pricing (dmxapi.cn 68折后, CNY per 1M tokens) ──────────────
# Calibrated from dmxapi /api/pricing: 1 ratio = 2.88 CNY/1M tokens
# Then × 0.68 discount applied (当前折扣)
# Verified base against GPT-4o official pricing (exact match pre-discount)
# Format: model_prefix → (input_price_per_1M, output_price_per_1M)
# Updated: 2026-03-08
_DISCOUNT = 0.68
MODEL_PRICING: dict[str, tuple[float, float]] = {
    # Gemini family
    "gemini-3.1-pro-preview":     (14.40 * _DISCOUNT, 86.40 * _DISCOUNT),   # 9.79, 58.75
    "gemini-2.5-pro":             (9.00 * _DISCOUNT, 72.00 * _DISCOUNT),    # 6.12, 48.96
    "gemini-2.5-flash":           (2.16 * _DISCOUNT, 18.00 * _DISCOUNT),    # 1.47, 12.24
    "gemini-2.0-flash":           (0.72 * _DISCOUNT, 2.88 * _DISCOUNT),     # 0.49, 1.96
    # OpenAI family
    "gpt-5.4":                    (18.00 * _DISCOUNT, 108.00 * _DISCOUNT),  # 12.24, 73.44
    "gpt-5":                      (9.00 * _DISCOUNT, 72.00 * _DISCOUNT),    # 6.12, 48.96
    "gpt-4o":                     (18.00 * _DISCOUNT, 72.00 * _DISCOUNT),   # 12.24, 48.96
    "gpt-4o-mini":                (1.08 * _DISCOUNT, 4.32 * _DISCOUNT),     # 0.73, 2.94
    "o3":                         (14.40 * _DISCOUNT, 57.60 * _DISCOUNT),   # 9.79, 39.17
    "o3-mini":                    (7.92 * _DISCOUNT, 31.68 * _DISCOUNT),    # 5.39, 21.54
    # Anthropic family
    "claude-opus-4-6":            (35.74 * _DISCOUNT, 178.70 * _DISCOUNT),  # 24.30, 121.52
    "claude-sonnet-4-20250514":   (21.60 * _DISCOUNT, 108.00 * _DISCOUNT),  # 14.69, 73.44
    "claude-sonnet-4-6":          (21.60 * _DISCOUNT, 108.00 * _DISCOUNT),  # 14.69, 73.44
}


# ── Model fallback chains (degradation) ──────────────────────────────
# If primary model fails after all retries, try fallbacks in order.
# Fallbacks trade quality for availability.
#
# 选型策略（2026-03-09 确认）：
#   脚本阶段 (N01/N02/N04/N05/N06): gemini-3.1-pro → opus-4-6 → 各自二批次
#   分镜质检 (N03/N11/N15): 三模型投票 gemini-3.1-pro + opus-4-6 + gpt-5.4
#                           每个模型独立重试→降级
MODEL_FALLBACKS: dict[str, list[str]] = {
    # 一梯队旗舰：互为首选降级，再降到二梯队
    "gemini-3.1-pro-preview": ["claude-opus-4-6", "gemini-2.5-pro", "gemini-2.5-flash"],
    "claude-opus-4-6":        ["gemini-3.1-pro-preview", "claude-sonnet-4-6"],
    "gpt-5.4":                ["gpt-5", "gpt-4o"],
    # 二梯队
    "gemini-2.5-pro":         ["gemini-2.5-flash", "gemini-2.0-flash"],
    "gemini-2.5-flash":       ["gemini-2.0-flash"],
    "gpt-5":                  ["gpt-4o", "gpt-4o-mini"],
    "gpt-4o":                 ["gpt-4o-mini"],
    "o3":                     ["o3-mini", "gpt-4o"],
    "o3-mini":                ["gpt-4o-mini"],
    "claude-sonnet-4-6":      ["claude-sonnet-4-20250514", "gpt-4o"],
}

# ── Node-level model assignment ──────────────────────────────────────
# Canonical model choices per pipeline stage. Handlers import these
# instead of hardcoding model strings.
#
# Script stage: quality-first, single model with fallback chain
SCRIPT_STAGE_MODEL = "gemini-3.1-pro-preview"
# QC voting: three-model majority vote, each with independent fallback
QC_VOTE_MODELS = ["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"]

# HTTP status codes that are worth retrying (transient errors)
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def update_model_pricing(prices: dict[str, tuple[float, float]]) -> None:
    """Batch update pricing. Called at startup or when prices change.

    Example: update_model_pricing({"gpt-5.4": (50.0, 150.0)})
    """
    MODEL_PRICING.update(prices)


def _lookup_pricing(model: str) -> tuple[float, float]:
    """Find pricing for a model, trying exact match then prefix match."""
    if model in MODEL_PRICING:
        return MODEL_PRICING[model]
    # Try prefix matching (e.g. "gpt-5-2025-08-07" → "gpt-5")
    for prefix, price in MODEL_PRICING.items():
        if model.startswith(prefix):
            return price
    return (0.0, 0.0)


def _calc_cost_cny(model: str, usage: dict) -> float:
    """Calculate cost in CNY from token usage and model pricing."""
    input_price, output_price = _lookup_pricing(model)
    if input_price == 0.0 and output_price == 0.0:
        return 0.0
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    return (prompt_tokens * input_price + completion_tokens * output_price) / 1_000_000


class LLMError(Exception):
    """LLM call failed."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


@dataclass
class LLMResponse:
    content: str
    parsed: dict | None = None
    model: str = ""
    usage: dict = field(default_factory=dict)
    cost_cny: float = 0.0       # Calculated cost based on token usage
    duration_s: float = 0.0     # Wall-clock time for the call


def _is_retryable(exc: LLMError) -> bool:
    """Check if an LLM error is worth retrying."""
    if exc.status_code is None:
        # Network errors (timeout, connection) are retryable
        return True
    return exc.status_code in _RETRYABLE_STATUS_CODES


def _single_llm_call(
    model: str,
    messages: list[dict],
    *,
    temperature: float,
    max_tokens: int,
    json_mode: bool,
    timeout: float,
) -> tuple[dict, float]:
    """Raw single HTTP call to the LLM API. Returns (response_data, elapsed_s)."""
    base_url = get_llm_base_url().rstrip("/")
    api_key = get_llm_api_key()

    body: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    t0 = time.monotonic()
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(f"{base_url}/chat/completions", json=body, headers=headers)
    except httpx.TimeoutException:
        raise LLMError(f"LLM request timed out after {timeout}s", status_code=None)
    except httpx.HTTPError as exc:
        raise LLMError(f"HTTP error: {exc}", status_code=None)

    elapsed = time.monotonic() - t0

    if resp.status_code != 200:
        raise LLMError(
            f"LLM API returned {resp.status_code}: {resp.text[:500]}",
            status_code=resp.status_code,
        )

    data = resp.json()
    choices = data.get("choices", [])
    if not choices:
        raise LLMError("No choices in LLM response")

    return data, elapsed


def _build_messages(
    system_prompt: str,
    user_prompt: str,
    images: list[str] | None = None,
) -> list[dict]:
    """Build the messages list for the API call."""
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    if images:
        content_parts: list[dict] = [{"type": "text", "text": user_prompt}]
        for img in images:
            if img.startswith("http://") or img.startswith("https://"):
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": img},
                })
            else:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{img}"},
                })
        messages.append({"role": "user", "content": content_parts})
    else:
        messages.append({"role": "user", "content": user_prompt})

    return messages


def _parse_llm_response(
    data: dict, model: str, elapsed: float, json_mode: bool,
) -> LLMResponse:
    """Parse raw API response into LLMResponse."""
    content = data["choices"][0].get("message", {}).get("content", "")
    usage = data.get("usage", {})
    actual_model = data.get("model", model)

    parsed = None
    if json_mode and content:
        # Some models (e.g. Claude via proxy) wrap JSON in ```json``` markdown
        clean = content.strip()
        if clean.startswith("```"):
            # Strip ```json ... ``` wrapper
            first_nl = clean.find("\n")
            if first_nl != -1:
                clean = clean[first_nl + 1:]
            if clean.endswith("```"):
                clean = clean[:-3].strip()
            content = clean
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("json_mode=True but response is not valid JSON, returning raw content")

    cost = _calc_cost_cny(actual_model, usage)

    logger.info(
        "LLM call model=%s tokens_in=%d tokens_out=%d cost=%.4f CNY elapsed=%.1fs",
        actual_model,
        usage.get("prompt_tokens", 0),
        usage.get("completion_tokens", 0),
        cost,
        elapsed,
    )

    return LLMResponse(
        content=content,
        parsed=parsed,
        model=actual_model,
        usage=usage,
        cost_cny=cost,
        duration_s=elapsed,
    )


def call_llm(
    model: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.3,
    max_tokens: int = 16384,
    json_mode: bool = False,
    images: list[str] | None = None,
    timeout: float = _DEFAULT_TIMEOUT,
    max_retries: int = _DEFAULT_MAX_RETRIES,
    fallback: bool = True,
) -> LLMResponse:
    """Synchronous LLM call with retry and optional fallback.

    Retry: up to max_retries attempts with exponential backoff + jitter
    for transient errors (429, 5xx, timeouts).

    Fallback: if all retries fail and fallback=True, tries models from
    MODEL_FALLBACKS chain before giving up.

    Raises LLMError if all attempts (including fallbacks) fail.
    """
    messages = _build_messages(system_prompt, user_prompt, images)

    # Build model chain: primary + fallbacks
    models_to_try = [model]
    if fallback:
        models_to_try.extend(MODEL_FALLBACKS.get(model, []))

    last_error: LLMError | None = None

    for i, current_model in enumerate(models_to_try):
        if i > 0:
            logger.warning("Falling back from %s to %s", models_to_try[i - 1], current_model)

        for attempt in range(max_retries):
            try:
                data, elapsed = _single_llm_call(
                    current_model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                    json_mode=json_mode, timeout=timeout,
                )
                resp = _parse_llm_response(data, current_model, elapsed, json_mode)
                if i > 0:
                    logger.warning(
                        "Succeeded with fallback model %s (original: %s)",
                        current_model, model,
                    )
                return resp
            except LLMError as exc:
                last_error = exc
                if not _is_retryable(exc) or attempt == max_retries - 1:
                    logger.warning(
                        "Model %s attempt %d/%d failed (non-retryable or last attempt): %s",
                        current_model, attempt + 1, max_retries, exc,
                    )
                    break  # Move to next fallback model
                delay = _DEFAULT_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
                logger.warning(
                    "Model %s attempt %d/%d failed (retryable), retrying in %.1fs: %s",
                    current_model, attempt + 1, max_retries, delay, exc,
                )
                time.sleep(delay)

    raise last_error or LLMError("All models failed")


def call_llm_multi_vote(
    models: list[str],
    system_prompt: str,
    user_prompt: str,
    *,
    fallback: bool = True,
    **kwargs,
) -> list[LLMResponse]:
    """Call multiple models in parallel, return all responses. For QC voting.

    Each model call has its own retry + fallback chain, so partial failures
    are tolerated as long as at least one model succeeds.
    """
    results: list[LLMResponse] = []
    errors: list[str] = []

    with ThreadPoolExecutor(max_workers=len(models)) as pool:
        futures = {
            pool.submit(call_llm, m, system_prompt, user_prompt, fallback=fallback, **kwargs): m
            for m in models
        }
        for fut in as_completed(futures):
            model_name = futures[fut]
            try:
                results.append(fut.result())
            except LLMError as exc:
                logger.warning("Multi-vote model %s failed: %s", model_name, exc)
                errors.append(f"{model_name}: {exc}")

    if not results:
        raise LLMError(f"All models failed in multi-vote: {errors}")

    return results


def aggregate_llm_costs(responses: list[LLMResponse]) -> dict:
    """Aggregate cost/usage across multiple LLM responses (e.g. from multi_vote).

    Returns a summary dict suitable for NodeResult.
    """
    total_cost = sum(r.cost_cny for r in responses)
    total_prompt = sum(r.usage.get("prompt_tokens", 0) for r in responses)
    total_completion = sum(r.usage.get("completion_tokens", 0) for r in responses)
    total_duration = max((r.duration_s for r in responses), default=0.0)  # parallel = max

    return {
        "cost_cny": total_cost,
        "token_in": total_prompt,
        "token_out": total_completion,
        "duration_s": total_duration,
        "model_calls": [
            {
                "model": r.model,
                "prompt_tokens": r.usage.get("prompt_tokens", 0),
                "completion_tokens": r.usage.get("completion_tokens", 0),
                "cost_cny": r.cost_cny,
                "duration_s": r.duration_s,
            }
            for r in responses
        ],
    }
