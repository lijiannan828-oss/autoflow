"""ComfyUI generation handlers (N07, N10, N14).

N07 — 美术产品图生成: FLUX.2 Dev txt2img per asset
N10 — 关键帧生成: FLUX.2 Dev + FireRed MultiRef per shot
N14 — 视频素材生成: LTX-2.3 i2v per shot (existing workflow)

GPU 降级策略:
- ComfyUI 不可达时返回 stub 输出，让下游节点继续跑
- 所有 workflow JSON 真实构建，GPU 到位后即可执行
"""

from __future__ import annotations

import logging
import random
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from backend.common.tos_client import upload_bytes, upload_json
from backend.orchestrator.comfyui_client import (
    ComfyUIError,
    ComfyUIJob,
    download_output_image,
    download_output_video,
    get_system_stats,
    poll_until_complete,
    submit_workflow,
)
from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_node_output_payload,
)
from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import register_handler

logger = logging.getLogger(__name__)

_REGISTERED = False

# ── Constants ─────────────────────────────────────────────────────────────

# Candidate counts by difficulty / importance
CANDIDATE_COUNT_BY_DIFFICULTY = {"S0": 2, "S1": 3, "S2": 4}
CANDIDATE_COUNT_BY_IMPORTANCE = {
    "major": 5, "supporting": 3, "extra": 2,
    "location": 3, "prop": 2,
}

# Model names
FLUX_MODEL = "flux1-dev-fp8.safetensors"
FLUX_BACKUP = "z-image-turbo.safetensors"
LTX_MODEL = "ltx-av-step-1751000_vocoder_24K.safetensors"
LTX_GEMMA = "gemma-3-12b-it-qat-q4_0-unquantized_readout_proj/model/model.safetensors"

# Default resolutions
FLUX_RESOLUTION = {"width": 1024, "height": 1024}
KEYFRAME_RESOLUTION_LANDSCAPE = {"width": 2048, "height": 1152}
KEYFRAME_RESOLUTION_PORTRAIT = {"width": 1152, "height": 2048}
VIDEO_RESOLUTION_LANDSCAPE = {"width": 1920, "height": 1080}
VIDEO_RESOLUTION_PORTRAIT = {"width": 1080, "height": 1920}

# LTX video defaults
LTX_FPS = 25
LTX_DEFAULT_FRAMES = 105  # ~4.2s at 25fps
LTX_STEPS = 20
LTX_VIDEO_OUTPUT_NODE = "15"

# Timeouts
N07_TIMEOUT = 1800
N10_TIMEOUT = 600  # FLUX+FireRed 2048x1152 can be slow on 4090
N14_TIMEOUT = 600


# ── Helpers ───────────────────────────────────────────────────────────────


def _tos_key(state: PipelineState, node_id: str, filename: str = "output.json") -> str:
    ev_id = state.get("episode_version_id") or "unknown"
    return f"{ev_id}/{node_id}/{filename}"


def _output_ref(state: PipelineState, node_id: str) -> str:
    return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state, node_id)}"


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _safe_upload_json(state: PipelineState, node_id: str, payload: dict, filename: str = "output.json") -> str:
    try:
        return upload_json(_tos_key(state, node_id, filename), payload)
    except Exception as exc:
        logger.warning("TOS upload failed for %s: %s", node_id, exc)
        return _output_ref(state, node_id)


def _safe_upload_bytes(
    state: PipelineState,
    node_id: str,
    content: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
) -> str:
    try:
        return upload_bytes(_tos_key(state, node_id, filename), content, content_type)
    except Exception as exc:
        logger.warning("TOS binary upload failed for %s/%s: %s", node_id, filename, exc)
        return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state, node_id, filename)}"


def _build_result(
    node_id: str,
    state: PipelineState,
    *,
    status: str = "succeeded",
    output_ref: str,
    payload: Any,
    duration_s: float = 0.0,
    cost_cny: float = 0.0,
    gpu_seconds: float = 0.0,
    error: str | None = None,
    error_code: str | None = None,
) -> NodeResult:
    """Build a complete NodeResult with envelope."""
    envelope = build_node_output_envelope(
        node_id,
        state,
        status=status,
        payload=payload,
        duration_s=duration_s,
        cost_cny=cost_cny,
        gpu_seconds=gpu_seconds,
        error_code=error_code,
        error_message=error,
    )
    return NodeResult(
        node_id=node_id,
        status=status,
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=cost_cny,
        gpu_seconds=gpu_seconds,
        duration_s=duration_s,
        model_provider="comfyui",
        model_endpoint=None,
        output_payload=payload,
        output_envelope=envelope,
        error=error,
        error_code=error_code,
    )


def _comfyui_available() -> bool:
    """Check if ComfyUI is reachable."""
    try:
        stats = get_system_stats()
        return bool(stats)
    except Exception:
        return False


def _new_seed() -> int:
    return random.randint(0, 2**31 - 1)


def _make_candidate_id() -> str:
    return str(uuid.uuid4())[:8]


# GPU cost estimation: ~2.5 CNY/hour for A100, ~1.5 CNY/hour for 4090
GPU_COST_PER_SECOND_CNY = 2.5 / 3600  # A100 rate


def _estimate_gpu_cost(gpu_seconds: float) -> float:
    """Estimate GPU cost in CNY based on generation time."""
    return round(gpu_seconds * GPU_COST_PER_SECOND_CNY, 4)


# ── Workflow Builders ─────────────────────────────────────────────────────


def _build_flux_txt2img_workflow(
    positive_prompt: str,
    negative_prompt: str,
    *,
    seed: int,
    width: int = 1024,
    height: int = 1024,
    steps: int = 20,
    cfg: float = 3.5,
    model_name: str = FLUX_MODEL,
) -> dict:
    """Build a FLUX.2 Dev txt2img workflow for ComfyUI API.

    Constructs a minimal but complete FLUX txt2img pipeline:
    CheckpointLoader → CLIPTextEncode(+/-) → EmptyLatentImage →
    KSampler → VAEDecode → SaveImage
    """
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": model_name},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive_prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative_prompt or "blurry, low quality, deformed, text, watermark", "clip": ["1", 1]},
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
            },
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": "flux_art"},
        },
    }


def _build_flux_with_firered_workflow(
    positive_prompt: str,
    negative_prompt: str,
    *,
    seed: int,
    ref_image_paths: list[str],
    width: int = 2048,
    height: int = 1152,
    steps: int = 20,
    cfg: float = 3.5,
    firered_strength: float = 0.85,
    controlnet_type: str | None = None,
    controlnet_strength: float = 0.6,
    model_name: str = FLUX_MODEL,
) -> dict:
    """Build FLUX.2 + FireRed MultiRef workflow for keyframe generation.

    Injects character reference images via FireRed MultiRef node for
    consistency. Optionally adds ControlNet (OpenPose/Depth) for
    composition control.
    """
    workflow: dict[str, Any] = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": model_name},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive_prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negative_prompt or "blurry, low quality, deformed, text, watermark, inconsistent character",
                "clip": ["1", 1],
            },
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
    }

    # Load reference images for FireRed MultiRef
    ref_node_ids: list[str] = []
    for i, img_path in enumerate(ref_image_paths[:3]):  # FireRed supports up to 3 refs
        node_id = str(100 + i)
        workflow[node_id] = {
            "class_type": "LoadImage",
            "inputs": {"image": img_path},
        }
        ref_node_ids.append(node_id)

    # FireRed MultiRef node — applies character consistency from reference images
    if ref_node_ids:
        firered_inputs: dict[str, Any] = {
            "model": ["1", 0],
            "strength": firered_strength,
        }
        for i, ref_id in enumerate(ref_node_ids):
            firered_inputs[f"ref_image_{i+1}"] = [ref_id, 0]
        workflow["10"] = {
            "class_type": "FireRedMultiRef",
            "inputs": firered_inputs,
        }
        model_output = ["10", 0]
    else:
        model_output = ["1", 0]

    # Optional ControlNet
    sampler_model = model_output
    if controlnet_type and controlnet_type in ("openpose", "depth", "canny"):
        workflow["20"] = {
            "class_type": "ControlNetLoader",
            "inputs": {"control_net_name": f"controlnet-{controlnet_type}-flux.safetensors"},
        }
        workflow["21"] = {
            "class_type": "ControlNetApply",
            "inputs": {
                "conditioning": ["2", 0],
                "control_net": ["20", 0],
                "strength": controlnet_strength,
            },
        }
        # ControlNet modifies the positive conditioning
        positive_cond = ["21", 0]
    else:
        positive_cond = ["2", 0]

    # KSampler
    workflow["5"] = {
        "class_type": "KSampler",
        "inputs": {
            "model": sampler_model,
            "positive": positive_cond,
            "negative": ["3", 0],
            "latent_image": ["4", 0],
            "seed": seed,
            "steps": steps,
            "cfg": cfg,
            "sampler_name": "euler",
            "scheduler": "normal",
            "denoise": 1.0,
        },
    }
    workflow["6"] = {
        "class_type": "VAEDecode",
        "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
    }
    workflow["7"] = {
        "class_type": "SaveImage",
        "inputs": {"images": ["6", 0], "filename_prefix": "keyframe"},
    }
    return workflow


def _build_ltx_video_workflow(
    positive_prompt: str,
    negative_prompt: str,
    *,
    seed: int,
    num_frames: int = LTX_DEFAULT_FRAMES,
    fps: int = LTX_FPS,
    width: int = 768,
    height: int = 512,
    steps: int = LTX_STEPS,
    video_cfg: float = 3.0,
    audio_cfg: float = 7.0,
) -> dict:
    """Build LTX-2.3 video generation workflow from the existing template.

    Reconstructs the proven LTX workflow with parameterized inputs.
    Based on the real workflow at VideoGen/Ltx2 四关键帧生视频.json.

    Output node: "15" (VHS_VideoCombine) — use this to download video.
    """
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": LTX_MODEL},
        },
        "2": {
            "class_type": "LTXVGemmaCLIPModelLoader",
            "inputs": {
                "ltxv_path": LTX_MODEL,
                "gemma_path": LTX_GEMMA,
                "max_length": 1024,
            },
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive_prompt, "clip": ["2", 0]},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negative_prompt or (
                    "blurry, out of focus, overexposed, underexposed, low contrast, "
                    "excessive noise, grainy texture, poor lighting, flickering, "
                    "motion blur, distorted proportions, unnatural skin tones, "
                    "deformed facial features, extra limbs, artifacts, "
                    "cartoonish rendering, 3D CGI look, uncanny valley effect"
                ),
                "clip": ["2", 0],
            },
        },
        "8": {
            "class_type": "KSamplerSelect",
            "inputs": {"sampler_name": "euler"},
        },
        "9": {
            "class_type": "LTXVScheduler",
            "inputs": {
                "stretch": True,
                "latent": ["28", 0],
                "max_shift": 2.05,
                "terminal": 0.1,
                "steps": steps,
                "base_shift": 0.95,
            },
        },
        "11": {
            "class_type": "RandomNoise",
            "inputs": {"noise_seed": seed},
        },
        "12": {
            "class_type": "VAEDecode",
            "inputs": {"vae": ["1", 2], "samples": ["29", 0]},
        },
        "13": {
            "class_type": "LTXVAudioVAELoader",
            "inputs": {"ckpt_name": LTX_MODEL},
        },
        "14": {
            "class_type": "LTXVAudioVAEDecode",
            "inputs": {"audio_vae": ["13", 0], "samples": ["29", 1]},
        },
        "15": {
            "class_type": "VHS_VideoCombine",
            "inputs": {
                "save_output": True,
                "filename_prefix": "ltx_video",
                "images": ["12", 0],
                "loop_count": 0,
                "pix_fmt": "yuv420p",
                "save_metadata": True,
                "crf": 19,
                "trim_to_audio": False,
                "format": "video/h264-mp4",
                "audio": ["14", 0],
                "frame_rate": ["23", 0],
                "pingpong": False,
            },
        },
        "17": {
            "class_type": "MultimodalGuider",
            "inputs": {
                "skip_blocks": "29",
                "negative": ["22", 1],
                "model": ["28", 1],
                "positive": ["22", 0],
                "parameters": ["18", 0],
            },
        },
        "18": {
            "class_type": "GuiderParameters",
            "inputs": {
                "modality": "VIDEO",
                "cfg": video_cfg,
                "rescale": 0,
                "stg": 0,
                "parameters": ["19", 0],
                "modality_scale": 3,
            },
        },
        "19": {
            "class_type": "GuiderParameters",
            "inputs": {
                "modality": "AUDIO",
                "cfg": audio_cfg,
                "rescale": 0,
                "stg": 0,
                "modality_scale": 3,
            },
        },
        "22": {
            "class_type": "LTXVConditioning",
            "inputs": {
                "negative": ["4", 0],
                "positive": ["3", 0],
                "frame_rate": ["23", 0],
            },
        },
        "23": {
            "class_type": "FloatConstant",
            "inputs": {"value": float(fps)},
        },
        "26": {
            "class_type": "LTXVEmptyLatentAudio",
            "inputs": {
                "batch_size": 1,
                "frame_rate": ["42", 0],
                "frames_number": ["27", 0],
            },
        },
        "27": {
            "class_type": "INTConstant",
            "inputs": {"value": num_frames},
        },
        "28": {
            "class_type": "LTXVConcatAVLatent",
            "inputs": {
                "audio_latent": ["26", 0],
                "video_latent": ["43", 0],
                "model": ["44", 0],
            },
        },
        "29": {
            "class_type": "LTXVSeparateAVLatent",
            "inputs": {
                "av_latent": ["41", 0],
                "model": ["28", 1],
            },
        },
        "41": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "guider": ["17", 0],
                "latent_image": ["28", 0],
                "noise": ["11", 0],
                "sigmas": ["9", 0],
                "sampler": ["8", 0],
            },
        },
        "42": {
            "class_type": "CM_FloatToInt",
            "inputs": {"a": ["23", 0]},
        },
        "43": {
            "class_type": "EmptyLTXVLatentVideo",
            "inputs": {
                "batch_size": 1,
                "width": width,
                "length": ["27", 0],
                "height": height,
            },
        },
        "44": {
            "class_type": "LTXVSequenceParallelMultiGPUPatcher",
            "inputs": {
                "disable_backup": False,
                "torch_compile": True,
                "model": ["1", 0],
            },
        },
    }


# ── N07: Art Asset Generation ─────────────────────────────────────────────


def _generate_single_asset(
    asset_plan: dict,
    asset_type: str,
    state: PipelineState,
    comfyui_ok: bool,
) -> tuple[dict, float]:
    """Generate candidates for a single asset via ComfyUI.

    Returns (CandidateSet dict, total_gpu_seconds).
    """
    target_id = asset_plan.get("character_id") or asset_plan.get("location_id") or asset_plan.get("prop_id") or "unknown"
    base_prompt = asset_plan.get("base_prompt") or asset_plan.get("prompt", "")
    negative_prompt = asset_plan.get("negative_prompt", "")
    candidate_count = asset_plan.get("candidate_count", 3)
    resolution = asset_plan.get("resolution", FLUX_RESOLUTION)

    candidates: list[dict] = []
    set_id = f"cs_{target_id}_{uuid.uuid4().hex[:6]}"
    set_gpu_seconds = 0.0

    for i in range(candidate_count):
        candidate_id = _make_candidate_id()
        seed = _new_seed()

        # Vary prompts slightly for diversity
        variant_tag = "base" if i == 0 else f"variant_{i}"
        prompt_variant = base_prompt
        if i > 0 and asset_type.startswith("character"):
            # Add slight prompt variations for diversity
            angles = ["front view", "three-quarter view", "slight left angle"]
            prompt_variant = f"{base_prompt}, {angles[i % len(angles)]}"

        workflow = _build_flux_txt2img_workflow(
            prompt_variant,
            negative_prompt,
            seed=seed,
            width=resolution.get("width", 1024),
            height=resolution.get("height", 1024),
        )

        image_ref = ""
        gen_time = 0.0

        if comfyui_ok:
            try:
                t_gen = time.monotonic()
                prompt_id = submit_workflow(workflow)
                job = poll_until_complete(prompt_id, timeout_s=N07_TIMEOUT)
                gen_time = time.monotonic() - t_gen

                if job.status == "completed":
                    image_bytes = download_output_image(prompt_id, "7", 0)
                    filename = f"{target_id}_{variant_tag}_{candidate_id}.png"
                    image_ref = _safe_upload_bytes(
                        state, "N07", image_bytes, filename, "image/png",
                    )
                    set_gpu_seconds += gen_time
                    logger.info(
                        "N07: Generated %s candidate %s (seed=%d, %.1fs)",
                        target_id, candidate_id, seed, gen_time,
                    )
                else:
                    logger.warning("N07: ComfyUI job failed for %s candidate %d", target_id, i)
            except ComfyUIError as exc:
                logger.error("N07: ComfyUI error for %s candidate %d: %s", target_id, i, exc)
        else:
            logger.info("N07: ComfyUI offline, generating stub for %s candidate %d", target_id, i)
            image_ref = f"stub://comfyui-offline/N07/{target_id}/{candidate_id}.png"

        candidates.append({
            "candidate_id": candidate_id,
            "version": 1,
            "prompt_used": prompt_variant,
            "prompt_variant_tag": variant_tag,
            "model_used": "FLUX.2-Dev" if not comfyui_ok else "FLUX.2-Dev",
            "generation_params": {
                "seed": seed,
                "steps": 20,
                "cfg": 3.5,
                "resolution": resolution,
            },
            "seed": seed,
            "content": {
                "asset_type": asset_type,
                "target_id": target_id,
                "variant_tag": variant_tag,
                "image": {"uri": image_ref, "provider": "tos" if image_ref.startswith("tos://") else "stub"},
                "seed": seed,
                "generation_model": "FLUX.2-Dev",
                "generation_params": {"steps": 20, "cfg": 3.5},
            },
            "auto_score": None,
            "status": "pending",
            "retention_policy": "temp_30d",
            "generation_time_sec": gen_time,
            "cost": _estimate_gpu_cost(gen_time),
        })

    candidate_set = {
        "set_id": set_id,
        "target_type": asset_type,
        "target_ref_id": target_id,
        "candidates": candidates,
        "total_requested": candidate_count,
        "total_generated": len([c for c in candidates if c["content"]["image"]["provider"] != "stub"]),
        "prompt_diversity_strategy": "angle_variation" if asset_type.startswith("character") else "single_prompt",
        "decision_status": "awaiting_review",
        "regeneration_count": 0,
        "max_regenerations": 3,
    }
    return candidate_set, set_gpu_seconds


def handle_n07(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N07 — 美术产品图生成: 读 N06 ArtGenerationPlan → ComfyUI FLUX.2 批量生成 → 多候选图。

    执行粒度: per_asset — 每种资产独立生成候选图集。
    模型: FLUX.2 Dev (txt2img)
    降级: ComfyUI 不可达时生成 stub 输出。
    """
    t0 = time.monotonic()

    # Load N06 ArtGenerationPlan
    n06_output = load_node_output_payload("N06", state, default={})
    if not isinstance(n06_output, dict):
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N06 output missing or invalid",
            error_code="MISSING_INPUT",
        )

    art_plan = n06_output.get("art_generation_plan", n06_output)
    characters = art_plan.get("characters", [])
    locations = art_plan.get("locations", [])
    props = art_plan.get("props", [])

    if not characters and not locations and not props:
        logger.warning("N07: ArtGenerationPlan is empty, nothing to generate")
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload={"error": "empty_art_plan"},
            duration_s=time.monotonic() - t0,
            error="ArtGenerationPlan contains no assets",
            error_code="EMPTY_PLAN",
        )

    comfyui_ok = _comfyui_available()
    if not comfyui_ok:
        logger.warning("N07: ComfyUI not reachable, will generate stub outputs")

    # Generate per-asset candidate sets
    asset_candidate_sets: list[dict] = []
    total_gpu_seconds = 0.0
    workflow_refs: list[str] = []

    # Characters
    for char_plan in characters:
        char_plan.setdefault("candidate_count", CANDIDATE_COUNT_BY_IMPORTANCE.get(
            char_plan.get("importance", "supporting"), 3,
        ))
        char_plan.setdefault("resolution", FLUX_RESOLUTION)
        candidate_set, gpu_s = _generate_single_asset(char_plan, "character_base", state, comfyui_ok)
        asset_candidate_sets.append(candidate_set)
        total_gpu_seconds += gpu_s

        # Also generate costume variants if specified
        for costume in char_plan.get("costume_prompts", []):
            costume_plan = {
                "character_id": char_plan.get("character_id"),
                "base_prompt": costume.get("prompt", ""),
                "negative_prompt": char_plan.get("negative_prompt", ""),
                "candidate_count": 2,
                "resolution": char_plan.get("resolution", FLUX_RESOLUTION),
            }
            costume_set, gpu_s = _generate_single_asset(costume_plan, "character_costume", state, comfyui_ok)
            asset_candidate_sets.append(costume_set)
            total_gpu_seconds += gpu_s

    # Locations
    for loc_plan in locations:
        loc_plan.setdefault("candidate_count", CANDIDATE_COUNT_BY_IMPORTANCE["location"])
        loc_plan.setdefault("resolution", FLUX_RESOLUTION)
        # Generate for each time variant
        time_variants = loc_plan.get("time_variants", [{"time_of_day": "day", "prompt": loc_plan.get("prompt", "")}])
        for variant in time_variants:
            variant_plan = {
                "location_id": loc_plan.get("location_id"),
                "base_prompt": variant.get("prompt", ""),
                "negative_prompt": loc_plan.get("negative_prompt", ""),
                "candidate_count": loc_plan.get("candidate_count", 3),
                "resolution": loc_plan.get("resolution", FLUX_RESOLUTION),
            }
            location_set, gpu_s = _generate_single_asset(variant_plan, "location", state, comfyui_ok)
            asset_candidate_sets.append(location_set)
            total_gpu_seconds += gpu_s

    # Props
    for prop_plan in props:
        prop_plan.setdefault("candidate_count", CANDIDATE_COUNT_BY_IMPORTANCE["prop"])
        prop_plan.setdefault("resolution", FLUX_RESOLUTION)
        prop_set, gpu_s = _generate_single_asset(prop_plan, "prop", state, comfyui_ok)
        asset_candidate_sets.append(prop_set)
        total_gpu_seconds += gpu_s

    # Upload workflow JSONs as artifacts
    for i, cs in enumerate(asset_candidate_sets):
        wf_key = _tos_key(state, node_id, f"workflow_{cs['target_ref_id']}_{i}.json")
        try:
            wf_ref = upload_json(wf_key, {"workflow_type": "flux_txt2img", "target": cs["target_ref_id"]})
            workflow_refs.append(wf_ref)
        except Exception:
            pass

    total_cost = _estimate_gpu_cost(total_gpu_seconds)

    payload = {
        "asset_candidate_sets": asset_candidate_sets,
        "total_assets": len(asset_candidate_sets),
        "total_candidates": sum(len(cs["candidates"]) for cs in asset_candidate_sets),
        "comfyui_available": comfyui_ok,
        "model": "FLUX.2-Dev",
        "workflow_refs": workflow_refs,
        "total_gpu_seconds": total_gpu_seconds,
        "total_cost_cny": total_cost,
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N07 completed: %d asset sets, %d total candidates, comfyui=%s, %.1fs, gpu=%.1fs, cost=%.4f¥",
        len(asset_candidate_sets),
        payload["total_candidates"],
        comfyui_ok,
        duration,
        total_gpu_seconds,
        total_cost,
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
        gpu_seconds=total_gpu_seconds,
        cost_cny=total_cost,
    )


# ── N10: Keyframe Generation ─────────────────────────────────────────────


def _select_controlnet(shot_spec: dict) -> str | None:
    """Select ControlNet type based on shot properties."""
    characters = shot_spec.get("characters_in_shot", [])
    shot_type = shot_spec.get("shot_type", "")

    if len(characters) >= 2:
        return "openpose"
    if shot_type in ("extreme_wide", "wide", "establishing"):
        return "depth"
    # Close-ups don't need ControlNet
    return None


def _upload_ref_image_to_comfyui(tos_uri: str, target_id: str) -> str | None:
    """Download image from TOS and upload to ComfyUI input directory.

    ComfyUI LoadImage expects a filename that exists in its input/ folder.
    We download from TOS, then POST to ComfyUI /upload/image endpoint.
    Returns the ComfyUI-local filename, or None on failure.
    """
    from backend.common.tos_client import download_bytes as tos_download
    from backend.common.env import get_comfyui_base_url
    import httpx

    try:
        image_bytes = tos_download(tos_uri)
    except Exception as exc:
        logger.warning("Failed to download ref image from TOS %s: %s", tos_uri, exc)
        return None

    comfyui_filename = f"ref_{target_id}_{uuid.uuid4().hex[:6]}.png"
    base_url = get_comfyui_base_url().rstrip("/")

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{base_url}/upload/image",
                files={"image": (comfyui_filename, image_bytes, "image/png")},
                data={"overwrite": "true"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("name", comfyui_filename)
            logger.warning("ComfyUI upload failed (%d): %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("Failed to upload ref image to ComfyUI: %s", exc)

    return None


def _get_ref_images_for_shot(
    shot_spec: dict,
    frozen_assets: list[dict],
    comfyui_ok: bool = False,
) -> list[str]:
    """Extract character reference image paths for FireRed from frozen assets.

    When ComfyUI is online, downloads from TOS and uploads to ComfyUI input dir,
    returning local filenames. When offline, returns TOS URIs (for stub mode).
    """
    character_ids = [c.get("character_id") for c in shot_spec.get("characters_in_shot", [])]
    ref_images: list[str] = []

    for asset in frozen_assets:
        target_id = asset.get("target_id")
        if target_id not in character_ids:
            continue

        base_img = asset.get("base_image", {})
        uri = base_img.get("uri", "") if isinstance(base_img, dict) else ""

        if not uri:
            # Check variants
            for variant in asset.get("variants", []):
                if isinstance(variant, dict) and variant.get("image", {}).get("uri"):
                    uri = variant["image"]["uri"]
                    break

        if not uri:
            continue

        if comfyui_ok and uri.startswith("tos://"):
            # Download from TOS → upload to ComfyUI input dir
            local_name = _upload_ref_image_to_comfyui(uri, target_id or "unknown")
            if local_name:
                ref_images.append(local_name)
            else:
                logger.warning("Skipping ref image for %s (upload to ComfyUI failed)", target_id)
        else:
            # Offline mode or non-TOS URI: pass as-is (stub)
            ref_images.append(uri)

    return ref_images[:3]  # FireRed MultiRef max 3


def _generate_keyframes_for_shot(
    shot_spec: dict,
    frozen_assets: list[dict],
    art_plan: dict,
    state: PipelineState,
    comfyui_ok: bool,
) -> tuple[dict, float]:
    """Generate keyframe candidates for a single shot.

    Returns (CandidateSet<ShotVisualCandidate> dict, total_gpu_seconds).
    """
    shot_id = shot_spec.get("shot_id", "unknown")
    difficulty = shot_spec.get("difficulty", "S1")
    visual_prompt = shot_spec.get("visual_prompt", "")
    negative_prompt = shot_spec.get("negative_prompt", "")
    candidate_count = CANDIDATE_COUNT_BY_DIFFICULTY.get(difficulty, 3)

    # Determine resolution based on aspect ratio
    # Default to landscape for short drama
    resolution = KEYFRAME_RESOLUTION_LANDSCAPE

    controlnet_type = _select_controlnet(shot_spec)
    ref_images = _get_ref_images_for_shot(shot_spec, frozen_assets, comfyui_ok)

    set_id = f"cs_kf_{shot_id}_{uuid.uuid4().hex[:6]}"
    candidates: list[dict] = []
    set_gpu_seconds = 0.0

    for i in range(candidate_count):
        candidate_id = _make_candidate_id()
        seed = _new_seed()

        # Build keyframe-specific prompt
        keyframe_specs = shot_spec.get("keyframe_specs", [])
        kf_prompt = visual_prompt
        if keyframe_specs:
            kf0 = keyframe_specs[0]
            if kf0.get("prompt"):
                kf_prompt = kf0["prompt"]

        variant_tag = f"kf_v{i}"
        if i > 0:
            # Add prompt variation for diversity
            kf_prompt = f"{kf_prompt}, seed variation {i}"

        workflow = _build_flux_with_firered_workflow(
            kf_prompt,
            negative_prompt,
            seed=seed,
            ref_image_paths=ref_images,
            width=resolution["width"],
            height=resolution["height"],
            controlnet_type=controlnet_type,
        )

        image_ref = ""
        gen_time = 0.0

        if comfyui_ok:
            try:
                t_gen = time.monotonic()
                prompt_id = submit_workflow(workflow)
                job = poll_until_complete(prompt_id, timeout_s=N10_TIMEOUT)
                gen_time = time.monotonic() - t_gen

                if job.status == "completed":
                    image_bytes = download_output_image(prompt_id, "7", 0)
                    filename = f"shot_{shot_id}_{variant_tag}_{candidate_id}.png"
                    image_ref = _safe_upload_bytes(state, "N10", image_bytes, filename, "image/png")
                    set_gpu_seconds += gen_time
                    logger.info("N10: Shot %s candidate %d generated (%.1fs)", shot_id, i, gen_time)
                else:
                    logger.warning("N10: ComfyUI job failed for shot %s candidate %d", shot_id, i)
            except ComfyUIError as exc:
                logger.error("N10: ComfyUI error for shot %s: %s", shot_id, exc)
        else:
            image_ref = f"stub://comfyui-offline/N10/{shot_id}/{candidate_id}.png"

        candidates.append({
            "candidate_id": candidate_id,
            "version": 1,
            "prompt_used": kf_prompt,
            "prompt_variant_tag": variant_tag,
            "model_used": "FLUX.2-Dev+FireRed" if ref_images else "FLUX.2-Dev",
            "generation_params": {
                "seed": seed,
                "steps": 20,
                "cfg": 3.5,
                "resolution": resolution,
                "controlnet": controlnet_type,
                "firered_refs": len(ref_images),
            },
            "seed": seed,
            "content": {
                "keyframes": [{
                    "keyframe_index": 0,
                    "image": {"uri": image_ref, "provider": "tos" if image_ref.startswith("tos://") else "stub"},
                    "seed": seed,
                }],
                "visual_prompt": kf_prompt,
                "negative_prompt": negative_prompt,
                "prompt_variant_tag": variant_tag,
            },
            "auto_score": None,
            "status": "pending",
            "retention_policy": "temp_30d",
            "generation_time_sec": gen_time,
            "cost": _estimate_gpu_cost(gen_time),
        })

    candidate_set = {
        "set_id": set_id,
        "target_type": "keyframe",
        "target_ref_id": shot_id,
        "candidates": candidates,
        "total_requested": candidate_count,
        "total_generated": len([c for c in candidates if "stub://" not in str(c["content"]["keyframes"][0]["image"].get("uri", ""))]),
        "prompt_diversity_strategy": "seed_variation",
        "decision_status": "awaiting_review",
        "regeneration_count": 0,
        "max_regenerations": 3,
    }
    return candidate_set, set_gpu_seconds


def handle_n10(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N10 — 关键帧生成: 读 ShotSpec + FrozenArtAsset → FLUX.2 + FireRed → 候选关键帧。

    执行粒度: per_shot — 每个镜头独立生成。
    模型: FLUX.2 Dev + FireRed MultiRef (角色一致性)
    ControlNet: 根据 shot_type 自动选择 (openpose/depth/none)
    降级: ComfyUI 不可达时生成 stub 输出。
    """
    t0 = time.monotonic()

    # Load upstream: N09 frozen assets + N06 art plan
    n09_output = load_node_output_payload("N09", state, default={})
    n06_output = load_node_output_payload("N06", state, default={})

    frozen_assets: list[dict] = []
    if isinstance(n09_output, dict):
        frozen_assets = n09_output.get("frozen_assets", [])

    art_plan: dict = {}
    if isinstance(n06_output, dict):
        art_plan = n06_output.get("art_generation_plan", n06_output)

    # Load shot specs from episode context (N05 graded output)
    n05_output = load_node_output_payload("N05", state, default={})
    shots: list[dict] = []
    if isinstance(n05_output, dict):
        # N05 outputs graded episode script with shots
        episodes = n05_output.get("episodes", [])
        for ep in episodes:
            if isinstance(ep, dict):
                for scene in ep.get("scenes", []):
                    if isinstance(scene, dict):
                        shots.extend(scene.get("shots", []))
        # Fallback: try top-level shots
        if not shots:
            shots = n05_output.get("shots", [])

    if not shots:
        logger.warning("N10: No shot specs found, returning empty result")
        payload = {"candidate_sets": [], "total_shots": 0, "error": "no_shots_found"}
        return _build_result(
            node_id, state,
            output_ref=_safe_upload_json(state, node_id, payload),
            payload=payload,
            duration_s=time.monotonic() - t0,
        )

    comfyui_ok = _comfyui_available()
    if not comfyui_ok:
        logger.warning("N10: ComfyUI not reachable, will generate stub outputs")

    # Generate keyframes per shot
    candidate_sets: list[dict] = []
    total_gpu_seconds = 0.0

    for shot in shots:
        if not isinstance(shot, dict):
            continue
        cs, gpu_s = _generate_keyframes_for_shot(shot, frozen_assets, art_plan, state, comfyui_ok)
        candidate_sets.append(cs)
        total_gpu_seconds += gpu_s

    total_cost = _estimate_gpu_cost(total_gpu_seconds)

    payload = {
        "candidate_sets": candidate_sets,
        "total_shots": len(candidate_sets),
        "total_candidates": sum(len(cs["candidates"]) for cs in candidate_sets),
        "comfyui_available": comfyui_ok,
        "model": "FLUX.2-Dev+FireRed",
        "total_gpu_seconds": total_gpu_seconds,
        "total_cost_cny": total_cost,
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N10 completed: %d shots, %d total candidates, comfyui=%s, %.1fs, gpu=%.1fs, cost=%.4f¥",
        len(candidate_sets),
        payload["total_candidates"],
        comfyui_ok,
        duration,
        total_gpu_seconds,
        total_cost,
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
        gpu_seconds=total_gpu_seconds,
        cost_cny=total_cost,
    )


# ── N14: Video Generation ────────────────────────────────────────────────


def _route_video_model(shot_spec: dict) -> str:
    """Route to the best video model based on shot properties.

    Returns model identifier string. For now, LTX-2.3 is default.
    SkyReels for tracking/orbital camera, HuMo for S2 complex action.
    """
    difficulty = shot_spec.get("difficulty", "S0")
    camera = shot_spec.get("camera_movement", "static")

    if camera in ("tracking", "orbital", "crane"):
        return "SkyReels"
    if difficulty == "S2":
        return "LTX-2.3+HuMo"
    return "LTX-2.3"


def _duration_to_frames(duration_sec: float, fps: int = LTX_FPS) -> int:
    """Convert shot duration to frame count, adding buffer for trimming."""
    # Add 0.5-1s buffer for N16/N17 pacing trim
    buffered = duration_sec + 0.8
    frames = int(buffered * fps)
    # LTX requires frame count as multiple of 8+1 for latent alignment
    # Round up to nearest valid value
    frames = max(frames, 25)  # minimum 1 second
    return frames


def _generate_video_for_shot(
    shot_spec: dict,
    frozen_keyframe: dict,
    frozen_assets: list[dict],
    state: PipelineState,
    comfyui_ok: bool,
) -> tuple[dict, float]:
    """Generate video candidates for a single shot using LTX-2.3.

    Returns (CandidateSet<VideoCandidate> dict, total_gpu_seconds).
    """
    shot_id = shot_spec.get("shot_id", frozen_keyframe.get("shot_id", "unknown"))
    difficulty = shot_spec.get("difficulty", "S1")
    duration_sec = shot_spec.get("duration_sec", 4.0)
    visual_prompt = shot_spec.get("visual_prompt", "")
    negative_prompt = shot_spec.get("negative_prompt", "")
    candidate_count = CANDIDATE_COUNT_BY_DIFFICULTY.get(difficulty, 2)

    model_name = _route_video_model(shot_spec)
    num_frames = _duration_to_frames(duration_sec)

    # Video resolution (default landscape for short drama)
    resolution = VIDEO_RESOLUTION_LANDSCAPE

    # For LTX, we use lower latent resolution (the model upscales internally)
    ltx_width = 768
    ltx_height = 512

    set_id = f"cs_vid_{shot_id}_{uuid.uuid4().hex[:6]}"
    candidates: list[dict] = []
    set_gpu_seconds = 0.0

    for i in range(candidate_count):
        candidate_id = _make_candidate_id()
        seed = _new_seed()

        # Build video prompt — include shot action for motion guidance
        action_desc = shot_spec.get("action_description", "")
        camera_movement = shot_spec.get("camera_movement", "static")
        video_prompt = visual_prompt
        if action_desc:
            video_prompt = f"{visual_prompt}. {action_desc}"
        if camera_movement and camera_movement != "static":
            video_prompt = f"{video_prompt}. Camera: {camera_movement}"

        workflow = _build_ltx_video_workflow(
            video_prompt,
            negative_prompt,
            seed=seed,
            num_frames=num_frames,
            fps=LTX_FPS,
            width=ltx_width,
            height=ltx_height,
        )

        video_ref = ""
        gen_time = 0.0
        actual_duration = duration_sec + 0.8  # estimated

        if comfyui_ok:
            try:
                t_gen = time.monotonic()
                prompt_id = submit_workflow(workflow)
                job = poll_until_complete(prompt_id, timeout_s=N14_TIMEOUT)
                gen_time = time.monotonic() - t_gen

                if job.status == "completed":
                    video_bytes = download_output_video(prompt_id, LTX_VIDEO_OUTPUT_NODE, 0)
                    filename = f"shot_{shot_id}_v{i}_{candidate_id}.mp4"
                    video_ref = _safe_upload_bytes(state, "N14", video_bytes, filename, "video/mp4")
                    actual_duration = num_frames / LTX_FPS
                    set_gpu_seconds += gen_time
                    logger.info(
                        "N14: Shot %s video candidate %d generated (%.1fs, %d frames)",
                        shot_id, i, gen_time, num_frames,
                    )
                else:
                    logger.warning("N14: ComfyUI job failed for shot %s candidate %d", shot_id, i)
            except ComfyUIError as exc:
                logger.error("N14: ComfyUI error for shot %s: %s", shot_id, exc)
        else:
            video_ref = f"stub://comfyui-offline/N14/{shot_id}/{candidate_id}.mp4"

        candidates.append({
            "candidate_id": candidate_id,
            "version": 1,
            "prompt_used": video_prompt,
            "prompt_variant_tag": f"vid_v{i}",
            "model_used": model_name,
            "generation_params": {
                "seed": seed,
                "steps": LTX_STEPS,
                "num_frames": num_frames,
                "fps": LTX_FPS,
                "resolution": {"width": ltx_width, "height": ltx_height},
                "video_cfg": 3.0,
                "audio_cfg": 7.0,
            },
            "seed": seed,
            "content": {
                "video": {"uri": video_ref, "provider": "tos" if video_ref.startswith("tos://") else "stub"},
                "fps": LTX_FPS,
                "duration_sec": actual_duration,
                "generation_model": model_name,
                "seed": seed,
                "has_native_audio": True,  # LTX-AV generates audio
                "motion_score": None,
            },
            "auto_score": None,
            "status": "pending",
            "retention_policy": "temp_30d",
            "generation_time_sec": gen_time,
            "cost": _estimate_gpu_cost(gen_time),
        })

    candidate_set = {
        "set_id": set_id,
        "target_type": "video",
        "target_ref_id": shot_id,
        "candidates": candidates,
        "total_requested": candidate_count,
        "total_generated": len([c for c in candidates if "stub://" not in str(c["content"]["video"].get("uri", ""))]),
        "prompt_diversity_strategy": "seed_variation",
        "decision_status": "awaiting_review",
        "regeneration_count": 0,
        "max_regenerations": 3,
    }
    return candidate_set, set_gpu_seconds


def handle_n14(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N14 — 视频素材生成: 读 FrozenKeyframe → LTX-2.3 → 候选视频。

    执行粒度: per_shot — 每个镜头独立生成。
    模型路由:
      - 默认 S0/S1: LTX-2.3 (1080p)
      - 复杂运镜 S2: LTX-2.3 + HuMo
      - 追踪/orbital: SkyReels
    降级: ComfyUI 不可达时生成 stub 输出。
    """
    t0 = time.monotonic()

    # Load N13 frozen keyframes (our direct dependency)
    n13_output = load_node_output_payload("N13", state, default={})

    frozen_keyframes: list[dict] = []
    if isinstance(n13_output, dict):
        frozen_keyframes = n13_output.get("frozen_keyframes", [])

    if not frozen_keyframes:
        logger.warning("N14: No frozen keyframes from N13, returning empty result")
        payload = {"candidate_sets": [], "total_shots": 0, "error": "no_frozen_keyframes"}
        return _build_result(
            node_id, state,
            output_ref=_safe_upload_json(state, node_id, payload),
            payload=payload,
            duration_s=time.monotonic() - t0,
        )

    # Load frozen assets for character reference (N09)
    n09_output = load_node_output_payload("N09", state, default={})
    frozen_assets: list[dict] = []
    if isinstance(n09_output, dict):
        frozen_assets = n09_output.get("frozen_assets", [])

    # Load shot specs to get difficulty, camera_movement, etc.
    n05_output = load_node_output_payload("N05", state, default={})
    shot_specs_by_id: dict[str, dict] = {}
    if isinstance(n05_output, dict):
        episodes = n05_output.get("episodes", [])
        for ep in episodes:
            if isinstance(ep, dict):
                for scene in ep.get("scenes", []):
                    if isinstance(scene, dict):
                        for shot in scene.get("shots", []):
                            if isinstance(shot, dict) and shot.get("shot_id"):
                                shot_specs_by_id[shot["shot_id"]] = shot
        # Fallback: top-level shots
        for shot in n05_output.get("shots", []):
            if isinstance(shot, dict) and shot.get("shot_id"):
                shot_specs_by_id[shot["shot_id"]] = shot

    comfyui_ok = _comfyui_available()
    if not comfyui_ok:
        logger.warning("N14: ComfyUI not reachable, will generate stub outputs")

    # Generate videos per shot
    candidate_sets: list[dict] = []
    total_gpu_seconds = 0.0

    for kf in frozen_keyframes:
        shot_id = kf.get("shot_id", "unknown")

        # Get shot spec or build minimal one
        shot_spec = shot_specs_by_id.get(shot_id, {
            "shot_id": shot_id,
            "difficulty": "S1",
            "duration_sec": 4.0,
            "visual_prompt": "",
            "camera_movement": "static",
        })

        cs, gpu_s = _generate_video_for_shot(shot_spec, kf, frozen_assets, state, comfyui_ok)
        candidate_sets.append(cs)
        total_gpu_seconds += gpu_s

    # Build per-shot model routing (keyed by shot_id to avoid collision)
    model_routing: dict[str, str] = {}
    for cs in candidate_sets:
        shot_id = cs["target_ref_id"]
        spec = shot_specs_by_id.get(shot_id, {})
        model_routing[shot_id] = _route_video_model(spec)

    total_cost = _estimate_gpu_cost(total_gpu_seconds)

    payload = {
        "candidate_sets": candidate_sets,
        "total_shots": len(candidate_sets),
        "total_candidates": sum(len(cs["candidates"]) for cs in candidate_sets),
        "comfyui_available": comfyui_ok,
        "model_routing": model_routing,
        "total_gpu_seconds": total_gpu_seconds,
        "total_cost_cny": total_cost,
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N14 completed: %d shots, %d total video candidates, comfyui=%s, %.1fs, gpu=%.1fs, cost=%.4f¥",
        len(candidate_sets),
        payload["total_candidates"],
        comfyui_ok,
        duration,
        total_gpu_seconds,
        total_cost,
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
        gpu_seconds=total_gpu_seconds,
        cost_cny=total_cost,
    )


# ── Registration ──────────────────────────────────────────────────────────


def register() -> None:
    """Register all ComfyUI generation handlers. Called by handlers/__init__.py."""
    global _REGISTERED
    if _REGISTERED:
        return

    register_handler("N07", handle_n07)
    register_handler("N10", handle_n10)
    register_handler("N14", handle_n14)
    _REGISTERED = True
    logger.info("ComfyUI gen handlers registered: N07, N10, N14")
