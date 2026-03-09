from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.orchestrator.write_side import (  # noqa: E402
    approve_review_task,
    auto_reject_node_run,
    apply_model_job_callback,
    request_regeneration,
    return_review_task,
    seed_round4_demo,
    seed_round6_demo,
    seed_round7_demo,
    skip_review_task,
    submit_model_job,
    update_review_task_payload,
)


def _load_json_payload(raw: str | None) -> dict[str, object]:
    if not raw:
        return {}
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise SystemExit("payload must be a JSON object")
    return payload


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        raise SystemExit(
            "usage: orchestrator_write_api.py <seed-round4|seed-round6|seed-round7|review-approve|review-return|review-skip|review-update-payload|review-regenerate|auto-qc-reject|model-submit|model-callback> [task_id] [json_payload]"
        )

    command = argv[1]

    if command == "seed-round4":
        payload: object = seed_round4_demo()
    elif command == "seed-round6":
        payload = seed_round6_demo()
    elif command == "seed-round7":
        payload = seed_round7_demo()
    elif command == "review-approve":
        if len(argv) < 3:
            raise SystemExit("review-approve requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = approve_review_task(
            argv[2],
            str(request.get("decision_comment") or ""),
            list(request.get("review_points") or []),
        )
    elif command == "review-return":
        if len(argv) < 3:
            raise SystemExit("review-return requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = return_review_task(
            argv[2],
            str(request.get("decision_comment") or ""),
            list(request.get("review_points") or []),
        )
    elif command == "review-skip":
        if len(argv) < 3:
            raise SystemExit("review-skip requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = skip_review_task(argv[2], str(request.get("reason") or "optional_step_skipped"))
    elif command == "review-update-payload":
        if len(argv) < 3:
            raise SystemExit("review-update-payload requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        updates = dict(request.get("updates") or {}) if "updates" in request else request
        payload = update_review_task_payload(argv[2], updates)
    elif command == "review-regenerate":
        if len(argv) < 3:
            raise SystemExit("review-regenerate requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        regen_type = str(request.get("regen_type") or "asset")
        params = dict(request.get("params") or {})
        payload = request_regeneration(argv[2], regen_type, params)
    elif command == "auto-qc-reject":
        if len(argv) < 3:
            raise SystemExit("auto-qc-reject requires <node_run_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = auto_reject_node_run(
            argv[2],
            issue_type=str(request.get("issue_type") or "auto_qc_reject"),
            comment=str(request.get("comment") or "auto qc reject"),
            severity=str(request.get("severity") or "major"),
            quality_score=float(request["quality_score"]) if request.get("quality_score") is not None else None,
            error_code=str(request.get("error_code") or "auto_qc_reject"),
        )
    elif command == "model-submit":
        if len(argv) < 3:
            raise SystemExit("model-submit requires <node_run_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = submit_model_job(
            argv[2],
            overrides=dict(request.get("overrides") or {}),
            seed_namespace=str(request.get("seed_namespace") or "") or None,
        )
    elif command == "model-callback":
        if len(argv) < 3:
            raise SystemExit("model-callback requires <job_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = apply_model_job_callback(
            argv[2],
            status=str(request.get("status") or "succeeded"),
            output_ref=str(request.get("output_ref") or "") or None,
            error_code=str(request.get("error_code") or "") or None,
            error_message=str(request.get("error_message") or "") or None,
            metrics=dict(request.get("metrics") or {}),
        )
    else:
        raise SystemExit(f"unsupported command: {command}")

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv)
