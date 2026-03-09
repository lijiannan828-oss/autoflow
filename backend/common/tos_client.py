"""Volcengine TOS (Tinder Object Storage) client.

Wraps the tos SDK for upload/download of JSON and binary files.
All keys follow the pattern: {episode_version_id}/{node_id}/{filename}
"""

from __future__ import annotations

import json
import logging

import tos

from backend.common.env import get_env

logger = logging.getLogger(__name__)

BUCKET = "autoflow-media-2102718571-cn-shanghai"
ENDPOINT = "tos-cn-shanghai.volces.com"
REGION = "cn-shanghai"


def _get_client() -> tos.TosClientV2:
    ak = get_env("VOLC_ACCESS_KEY_ID")
    sk = get_env("VOLC_SECRET_ACCESS_KEY")
    if not ak or not sk:
        raise RuntimeError("VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY not set")
    return tos.TosClientV2(ak, sk, ENDPOINT, REGION)


def upload_json(key: str, data: dict) -> str:
    """Upload JSON dict to TOS. Returns tos:// URL."""
    content = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
    client = _get_client()
    client.put_object(BUCKET, key, content=content, content_type="application/json")
    url = f"tos://{BUCKET}/{key}"
    logger.info("Uploaded JSON to %s (%d bytes)", url, len(content))
    return url


def upload_bytes(key: str, content: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload binary file to TOS. Returns tos:// URL."""
    client = _get_client()
    client.put_object(BUCKET, key, content=content, content_type=content_type)
    url = f"tos://{BUCKET}/{key}"
    logger.info("Uploaded binary to %s (%d bytes)", url, len(content))
    return url


def download_json(tos_url: str) -> dict:
    """Download JSON from tos:// URL."""
    key = _parse_key(tos_url)
    client = _get_client()
    resp = client.get_object(BUCKET, key)
    raw = resp.read()
    return json.loads(raw)


def download_bytes(tos_url: str) -> bytes:
    """Download binary from tos:// URL."""
    key = _parse_key(tos_url)
    client = _get_client()
    resp = client.get_object(BUCKET, key)
    return resp.read()


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a pre-signed HTTP URL for frontend display."""
    client = _get_client()
    url = client.pre_signed_url(tos.HttpMethodType.Http_Method_Get, BUCKET, key, expires=expires_in)
    return url.signed_url


def _parse_key(tos_url: str) -> str:
    """Extract object key from tos:// URL."""
    if tos_url.startswith("tos://"):
        parts = tos_url[6:]  # remove "tos://"
        # format: bucket/key or just key
        if "/" in parts:
            first_slash = parts.index("/")
            potential_bucket = parts[:first_slash]
            if potential_bucket == BUCKET:
                return parts[first_slash + 1:]
        return parts
    return tos_url
