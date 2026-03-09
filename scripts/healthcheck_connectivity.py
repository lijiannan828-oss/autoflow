#!/usr/bin/env python3
"""Connectivity healthcheck for local Redis tunnel/public fallback and TOS.

Usage:
  ./.venv-connectivity/bin/python scripts/healthcheck_connectivity.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        raise FileNotFoundError(f"env file not found: {path}")

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value.strip().strip('"').strip("'")
    return values


def require_module(name: str):
    try:
        return __import__(name)
    except ImportError as exc:
        raise RuntimeError(
            f"missing dependency '{name}', run: ./.venv-connectivity/bin/pip install redis tos"
        ) from exc


def redis_healthcheck(env: dict[str, str]) -> dict[str, object]:
    redis = require_module("redis")

    port = int(env.get("REDIS_PORT", "6379"))
    db = int(env.get("REDIS_DB", "0"))
    username = env.get("REDIS_USERNAME")
    password = env.get("REDIS_PASSWORD")

    candidates: list[tuple[str, str]] = []
    seen: set[str] = set()
    for mode, key in [
        ("configured", "REDIS_HOST"),
        ("public_fallback", "REDIS_PUBLIC_HOST"),
        ("private_reference", "REDIS_PRIVATE_HOST"),
    ]:
        host = env.get(key)
        if host and host not in seen:
            candidates.append((mode, host))
            seen.add(host)

    attempts: list[dict[str, object]] = []
    for mode, host in candidates:
        try:
            client = redis.Redis(
                host=host,
                port=port,
                db=db,
                username=username,
                password=password,
                socket_connect_timeout=5,
                socket_timeout=5,
                decode_responses=True,
            )
            pong = bool(client.ping())
            info = {
                "ok": pong,
                "selectedMode": mode,
                "selectedHost": host,
                "port": port,
                "db": db,
                "attempts": attempts + [{"mode": mode, "host": host, "ok": pong}],
            }
            if mode == "public_fallback":
                info["warning"] = "local Redis not reachable, fell back to public endpoint"
            return info
        except Exception as exc:  # noqa: BLE001
            attempts.append(
                {
                    "mode": mode,
                    "host": host,
                    "ok": False,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    return {
        "ok": False,
        "attempts": attempts,
        "error": "all Redis connection attempts failed",
    }


def tos_healthcheck(env: dict[str, str]) -> dict[str, object]:
    tos = require_module("tos")

    endpoint = env.get("TOS_ENDPOINT", "")
    region = env.get("TOS_REGION", "")
    bucket = env.get("TOS_BUCKET_NAME", "")
    ak = env.get("VOLC_ACCESS_KEY_ID", "")
    sk = env.get("VOLC_SECRET_ACCESS_KEY", "")

    client = tos.TosClientV2(
        ak=ak,
        sk=sk,
        endpoint=endpoint,
        region=region,
    )

    result: dict[str, object] = {
        "ok": False,
        "bucket": bucket,
        "region": region,
        "endpoint": endpoint,
    }

    key = f"healthchecks/perm-check-{int(time.time() * 1000)}.txt"
    object_created = False

    try:
        list_output = client.list_buckets()
        buckets = [item.name for item in list_output.buckets]
        result["listBuckets"] = {
            "ok": True,
            "containsTarget": bucket in buckets,
            "buckets": buckets,
        }
    except Exception as exc:  # noqa: BLE001
        result["listBuckets"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

    try:
        location_output = client.get_bucket_location(bucket)
        result["getBucketLocation"] = {
            "ok": True,
            "region": getattr(location_output, "region", None),
            "raw": {
                "Region": getattr(location_output, "region", None),
                "ExtranetEndpoint": getattr(location_output, "extranet_endpoint", None),
                "IntranetEndpoint": getattr(location_output, "intranet_endpoint", None),
            },
        }
    except Exception as exc:  # noqa: BLE001
        result["getBucketLocation"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

    try:
        put_output = client.put_object(bucket, key, content=b"healthcheck")
        object_created = True
        result["putObject"] = {
            "ok": True,
            "etag": getattr(put_output, "etag", None),
            "key": key,
        }
    except Exception as exc:  # noqa: BLE001
        result["putObject"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}", "key": key}

    try:
        head_output = client.head_object(bucket, key)
        result["headObject"] = {
            "ok": True,
            "contentLength": str(getattr(head_output, "content_length", None)),
        }
    except Exception as exc:  # noqa: BLE001
        result["headObject"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

    if object_created:
        try:
            client.delete_object(bucket, key)
            result["deleteObject"] = {"ok": True}
        except Exception as exc:  # noqa: BLE001
            result["deleteObject"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}", "key": key}
    else:
        result["deleteObject"] = {"ok": False, "skipped": True}

    result["ok"] = all(
        bool(result.get(step, {}).get("ok"))
        for step in [
            "listBuckets",
            "getBucketLocation",
            "putObject",
            "headObject",
            "deleteObject",
        ]
    )
    return result


def main() -> int:
    try:
        env = load_env_file(ENV_PATH)
        output = {
            "envFile": str(ENV_PATH),
            "redis": redis_healthcheck(env),
            "tos": tos_healthcheck(env),
        }
        output["ok"] = bool(output["redis"].get("ok")) and bool(output["tos"].get("ok"))
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0 if output["ok"] else 1
    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"{type(exc).__name__}: {exc}",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
