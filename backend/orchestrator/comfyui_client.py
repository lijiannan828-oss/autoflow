"""ComfyUI HTTP API client.

Submits workflow JSON to a ComfyUI server, polls for completion,
and downloads output images/videos.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import httpx

from backend.common.env import get_comfyui_base_url

logger = logging.getLogger(__name__)


class ComfyUIError(Exception):
    """ComfyUI operation failed."""
    pass


@dataclass
class ComfyUIJob:
    prompt_id: str
    status: str = "queued"  # queued | running | completed | failed
    outputs: dict | None = None


def submit_workflow(
    workflow_json: dict,
    *,
    base_url: str | None = None,
) -> str:
    """Submit a workflow to ComfyUI. Returns prompt_id."""
    url = (base_url or get_comfyui_base_url()).rstrip("/")

    body = {"prompt": workflow_json}

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(f"{url}/prompt", json=body)

    if resp.status_code != 200:
        raise ComfyUIError(f"Submit failed ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    prompt_id = data.get("prompt_id")
    if not prompt_id:
        raise ComfyUIError(f"No prompt_id in response: {data}")

    logger.info("Submitted workflow, prompt_id=%s", prompt_id)
    return prompt_id


def poll_until_complete(
    prompt_id: str,
    *,
    base_url: str | None = None,
    timeout_s: int = 600,
    poll_interval_s: int = 5,
) -> ComfyUIJob:
    """Poll ComfyUI until the job completes or times out."""
    url = (base_url or get_comfyui_base_url()).rstrip("/")
    deadline = time.monotonic() + timeout_s

    with httpx.Client(timeout=15.0) as client:
        while time.monotonic() < deadline:
            resp = client.get(f"{url}/history/{prompt_id}")

            if resp.status_code == 200:
                data = resp.json()
                if prompt_id in data:
                    entry = data[prompt_id]
                    status = entry.get("status", {})
                    if status.get("completed", False):
                        outputs = entry.get("outputs", {})
                        logger.info("Job %s completed", prompt_id)
                        return ComfyUIJob(
                            prompt_id=prompt_id,
                            status="completed",
                            outputs=outputs,
                        )
                    if status.get("status_str") == "error":
                        logger.error("Job %s failed", prompt_id)
                        return ComfyUIJob(
                            prompt_id=prompt_id,
                            status="failed",
                            outputs=None,
                        )

            time.sleep(poll_interval_s)

    raise ComfyUIError(f"Job {prompt_id} timed out after {timeout_s}s")


def download_output_image(
    prompt_id: str,
    node_id: str,
    index: int = 0,
    *,
    base_url: str | None = None,
) -> bytes:
    """Download a generated image from ComfyUI output."""
    url = (base_url or get_comfyui_base_url()).rstrip("/")

    # First get the history to find the output filename
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(f"{url}/history/{prompt_id}")
        if resp.status_code != 200:
            raise ComfyUIError(f"Failed to get history for {prompt_id}")

        data = resp.json()
        entry = data.get(prompt_id, {})
        outputs = entry.get("outputs", {})
        node_output = outputs.get(node_id, {})
        images = node_output.get("images", [])

        if index >= len(images):
            raise ComfyUIError(f"Image index {index} out of range (have {len(images)})")

        img_info = images[index]
        filename = img_info["filename"]
        subfolder = img_info.get("subfolder", "")
        img_type = img_info.get("type", "output")

        params = {"filename": filename, "subfolder": subfolder, "type": img_type}
        resp = client.get(f"{url}/view", params=params)
        if resp.status_code != 200:
            raise ComfyUIError(f"Failed to download image: {resp.status_code}")

        return resp.content


def download_output_video(
    prompt_id: str,
    node_id: str,
    index: int = 0,
    *,
    base_url: str | None = None,
) -> bytes:
    """Download a generated video from ComfyUI output.

    ComfyUI VHS_VideoCombine outputs use 'gifs' key instead of 'images'.
    """
    url = (base_url or get_comfyui_base_url()).rstrip("/")

    with httpx.Client(timeout=30.0) as client:
        resp = client.get(f"{url}/history/{prompt_id}")
        if resp.status_code != 200:
            raise ComfyUIError(f"Failed to get history for {prompt_id}")

        data = resp.json()
        entry = data.get(prompt_id, {})
        outputs = entry.get("outputs", {})
        node_output = outputs.get(node_id, {})

        # VHS nodes use "gifs" key; standard nodes use "images"
        videos = node_output.get("gifs", node_output.get("images", []))

        if index >= len(videos):
            raise ComfyUIError(f"Video index {index} out of range (have {len(videos)})")

        vid_info = videos[index]
        filename = vid_info["filename"]
        subfolder = vid_info.get("subfolder", "")
        vid_type = vid_info.get("type", "output")

        params = {"filename": filename, "subfolder": subfolder, "type": vid_type}
        resp = client.get(f"{url}/view", params=params)
        if resp.status_code != 200:
            raise ComfyUIError(f"Failed to download video: {resp.status_code}")

        return resp.content


def get_system_stats(*, base_url: str | None = None) -> dict:
    """Check ComfyUI server status."""
    url = (base_url or get_comfyui_base_url()).rstrip("/")
    with httpx.Client(timeout=5.0) as client:
        resp = client.get(f"{url}/system_stats")
        if resp.status_code != 200:
            raise ComfyUIError(f"System stats failed: {resp.status_code}")
        return resp.json()
