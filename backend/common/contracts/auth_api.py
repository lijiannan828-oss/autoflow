"""AutoFlow v2.2 — Auth API (login / me / user management)

前端通过 execFile 调用本脚本，与 orchestrator_read/write_api.py 同构。
"""
from __future__ import annotations

import hashlib
import json
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.common.db import execute, execute_returning_one, fetch_all, fetch_one  # noqa: E402

# JWT-like token (simplified: HMAC-SHA256 签名的 JSON payload)
# 生产环境建议替换为 PyJWT
_TOKEN_SECRET = "autoflow-auth-secret-v2.2"  # TODO: move to env
_TOKEN_EXPIRY_HOURS = 24


# ── helpers ────────────────────────────────────────────

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_token(user_id: str, role: str) -> tuple[str, str, datetime]:
    """Generate a bearer token. Returns (token, token_hash, expires_at)."""
    import hmac
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRY_HOURS)
    payload = json.dumps({
        "user_id": user_id,
        "role": role,
        "exp": expires_at.isoformat(),
    })
    sig = hmac.new(_TOKEN_SECRET.encode(), payload.encode(), "sha256").hexdigest()
    token = f"{payload}|{sig}"
    # Base64 encode for transport
    import base64
    token_b64 = base64.urlsafe_b64encode(token.encode()).decode()
    return token_b64, _hash_token(token_b64), expires_at


def _verify_token(token_b64: str) -> dict | None:
    """Verify and decode a token. Returns payload dict or None."""
    import base64
    import hmac
    try:
        token = base64.urlsafe_b64decode(token_b64.encode()).decode()
        payload_str, sig = token.rsplit("|", 1)
        expected_sig = hmac.new(_TOKEN_SECRET.encode(), payload_str.encode(), "sha256").hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(payload_str)
        exp = datetime.fromisoformat(payload["exp"])
        if exp < datetime.now(timezone.utc):
            return None
        return payload
    except Exception:
        return None


def _hash_password(password: str) -> str:
    """Simple password hash (production: use bcrypt)."""
    return hashlib.sha256(f"autoflow-salt:{password}".encode()).hexdigest()


# ── Role → permission mapping ─────────────────────────

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ["*"],
    "qc_inspector": ["/tasks", "/tasks/:taskId/review"],
    "middle_platform": ["/tasks", "/tasks/:taskId/review"],
    "partner": ["/tasks", "/tasks/:taskId/review"],
    "developer": ["/debug", "/agents", "/evolution", "/pipeline"],
}

ROLE_HOME: dict[str, str] = {
    "admin": "/pipeline",
    "qc_inspector": "/tasks",
    "middle_platform": "/tasks",
    "partner": "/tasks",
    "developer": "/debug",
}


# ── Commands ───────────────────────────────────────────

def cmd_login(request: dict) -> dict:
    """POST /api/auth/login"""
    provider = request.get("provider", "password")

    if provider == "feishu":
        # Feishu SSO: lookup by feishu_user_id
        # In real implementation, exchange code for feishu access_token first
        feishu_user_id = request.get("feishu_user_id") or request.get("code", "")
        if not feishu_user_id:
            return {"error": "feishu_user_id or code required"}
        user = fetch_one(
            "SELECT * FROM core_pipeline.users WHERE feishu_user_id = %s AND is_active = TRUE",
            (feishu_user_id,),
        )
        if not user:
            # Auto-create user from feishu (default role: developer)
            user = execute_returning_one(
                """INSERT INTO core_pipeline.users (name, role, login_provider, feishu_user_id, avatar_url)
                   VALUES (%s, 'developer', 'feishu', %s, %s)
                   RETURNING *""",
                (
                    request.get("name", "飞书用户"),
                    feishu_user_id,
                    request.get("avatar_url"),
                ),
            )
    elif provider == "password":
        username = request.get("username", "")
        password = request.get("password", "")
        if not username or not password:
            return {"error": "username and password required"}
        pw_hash = _hash_password(password)
        user = fetch_one(
            "SELECT * FROM core_pipeline.users WHERE username = %s AND password_hash = %s AND is_active = TRUE",
            (username, pw_hash),
        )
        if not user:
            return {"error": "invalid_credentials"}
    else:
        return {"error": f"unsupported provider: {provider}"}

    # Generate token
    user_id = str(user["id"])
    role = user["role"]
    token, token_hash, expires_at = _generate_token(user_id, role)

    # Save session
    execute_returning_one(
        """INSERT INTO core_pipeline.sessions (user_id, token_hash, expires_at)
           VALUES (%s, %s, %s) RETURNING id""",
        (user_id, token_hash, expires_at),
    )

    # Update last_login_at
    execute(
        "UPDATE core_pipeline.users SET last_login_at = now() WHERE id = %s",
        (user_id,),
    )

    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": user["name"],
            "role": role,
            "avatar_url": user.get("avatar_url"),
            "permissions": ROLE_PERMISSIONS.get(role, []),
            "home": ROLE_HOME.get(role, "/tasks"),
        },
    }


def cmd_me(token: str) -> dict:
    """GET /api/auth/me — verify token + return user info + task stats"""
    payload = _verify_token(token)
    if not payload:
        return {"error": "invalid_or_expired_token"}

    # Verify session exists
    token_hash = _hash_token(token)
    session = fetch_one(
        "SELECT * FROM core_pipeline.sessions WHERE token_hash = %s AND expires_at > now()",
        (token_hash,),
    )
    if not session:
        return {"error": "session_expired"}

    user = fetch_one(
        "SELECT * FROM core_pipeline.users WHERE id = %s AND is_active = TRUE",
        (payload["user_id"],),
    )
    if not user:
        return {"error": "user_not_found"}

    role = user["role"]

    # Aggregate personal stats from review_tasks
    stats = {"pending_tasks": 0, "today_reviewed": 0, "today_hours": 0}
    try:
        pending = fetch_one(
            """SELECT COUNT(*) as cnt FROM core_pipeline.review_tasks
               WHERE status = 'pending' AND (reviewer_role = %s OR %s = 'admin')""",
            (role, role),
        )
        stats["pending_tasks"] = pending["cnt"] if pending else 0

        today_done = fetch_one(
            """SELECT COUNT(*) as cnt FROM core_pipeline.review_tasks
               WHERE status IN ('approved', 'returned')
               AND updated_at >= CURRENT_DATE
               AND (reviewer_role = %s OR %s = 'admin')""",
            (role, role),
        )
        stats["today_reviewed"] = today_done["cnt"] if today_done else 0
    except Exception:
        pass  # review_tasks may not have reviewer_role column yet

    return {
        "id": str(user["id"]),
        "name": user["name"],
        "role": role,
        "avatar_url": user.get("avatar_url"),
        "permissions": ROLE_PERMISSIONS.get(role, []),
        "home": ROLE_HOME.get(role, "/tasks"),
        "stats": stats,
    }


def cmd_logout(token: str) -> dict:
    """POST /api/auth/logout — revoke session"""
    token_hash = _hash_token(token)
    execute(
        "DELETE FROM core_pipeline.sessions WHERE token_hash = %s",
        (token_hash,),
    )
    return {"success": True}


def cmd_list_users() -> list:
    """GET /api/settings/users"""
    rows = fetch_all(
        "SELECT id, name, role, login_provider, username, feishu_user_id, avatar_url, email, is_active, last_login_at, created_at FROM core_pipeline.users ORDER BY created_at",
        (),
    )
    return rows or []


def cmd_create_user(request: dict) -> dict:
    """POST /api/settings/users"""
    provider = request.get("login_provider", "password")
    password_hash = None
    if provider == "password" and request.get("password"):
        password_hash = _hash_password(request["password"])

    user = execute_returning_one(
        """INSERT INTO core_pipeline.users (name, role, login_provider, username, password_hash, feishu_user_id, email)
           VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *""",
        (
            request["name"],
            request.get("role", "developer"),
            provider,
            request.get("username"),
            password_hash,
            request.get("feishu_user_id"),
            request.get("email"),
        ),
    )
    return user or {"error": "create_failed"}


def cmd_update_user(user_id: str, request: dict) -> dict:
    """PUT /api/settings/users/:id"""
    sets = []
    params: list = []
    for field in ["name", "role", "email", "is_active"]:
        if field in request:
            sets.append(f"{field} = %s")
            params.append(request[field])
    if request.get("password"):
        sets.append("password_hash = %s")
        params.append(_hash_password(request["password"]))
    if not sets:
        return {"error": "no_fields_to_update"}
    sets.append("updated_at = now()")
    params.append(user_id)
    user = execute_returning_one(
        f"UPDATE core_pipeline.users SET {', '.join(sets)} WHERE id = %s RETURNING *",
        params,
    )
    return user or {"error": "not_found"}


def cmd_delete_user(user_id: str) -> dict:
    """DELETE /api/settings/users/:id"""
    execute("UPDATE core_pipeline.users SET is_active = FALSE WHERE id = %s", (user_id,))
    return {"success": True}


# ── CLI dispatcher ─────────────────────────────────────

def _load_json_payload(raw: str | None) -> dict:
    if not raw:
        return {}
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise SystemExit("payload must be a JSON object")
    return payload


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        raise SystemExit("usage: auth_api.py <login|me|logout|list-users|create-user|update-user|delete-user> [args]")

    command = argv[1]

    if command == "login":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        payload = cmd_login(request)

    elif command == "me":
        if len(argv) < 3:
            raise SystemExit("me requires <token>")
        payload = cmd_me(argv[2])

    elif command == "logout":
        if len(argv) < 3:
            raise SystemExit("logout requires <token>")
        payload = cmd_logout(argv[2])

    elif command == "list-users":
        payload = cmd_list_users()

    elif command == "create-user":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        payload = cmd_create_user(request)

    elif command == "update-user":
        if len(argv) < 3:
            raise SystemExit("update-user requires <user_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = cmd_update_user(argv[2], request)

    elif command == "delete-user":
        if len(argv) < 3:
            raise SystemExit("delete-user requires <user_id>")
        payload = cmd_delete_user(argv[2])

    else:
        raise SystemExit(f"unsupported command: {command}")

    print(json.dumps(payload, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main(sys.argv)
