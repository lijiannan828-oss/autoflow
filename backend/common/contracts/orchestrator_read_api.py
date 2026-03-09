from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.orchestrator.db_read_side import (  # noqa: E402
    build_dynamic_task_tabs,
    get_node_trace_payload,
    get_north_star_summary,
    get_registry_validation_payload,
    get_review_task_detail,
    get_stage_summary,
    get_tos_presigned_url,
    list_artifacts_by_node_run,
    list_dramas,
    list_episodes_for_drama,
    list_return_tickets,
    list_review_tasks,
)


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        raise SystemExit(
            "usage: orchestrator_read_api.py <acceptance|review-tasks|review-task-detail|review-stage2-summary|review-stage3-summary|review-stage4-summary|return-tickets|list-dramas|list-episodes|artifacts-by-node-run|tos-presigned-url|node-trace|registry-validation|north-star-summary> [arg]"
        )

    command = argv[1]

    if command == "acceptance":
        payload = {
            "taskTabs": build_dynamic_task_tabs(),
            "north_star_summary": get_north_star_summary(),
        }
    elif command == "review-tasks":
        limit = int(argv[2]) if len(argv) >= 3 else 20
        payload = list_review_tasks(limit=limit)
    elif command == "review-task-detail":
        if len(argv) < 3:
            raise SystemExit("review-task-detail requires <task_id>")
        payload = get_review_task_detail(argv[2]) or {"error": "not_found"}
    elif command == "review-stage2-summary":
        if len(argv) < 3:
            raise SystemExit("review-stage2-summary requires <episode_id>")
        payload = get_stage_summary(2, argv[2]) or {"error": "not_found"}
    elif command == "review-stage3-summary":
        if len(argv) < 3:
            raise SystemExit("review-stage3-summary requires <episode_id>")
        payload = get_stage_summary(3, argv[2]) or {"error": "not_found"}
    elif command == "review-stage4-summary":
        if len(argv) < 3:
            raise SystemExit("review-stage4-summary requires <episode_id>")
        payload = get_stage_summary(4, argv[2]) or {"error": "not_found"}
    elif command == "return-tickets":
        episode_id = argv[2] if len(argv) >= 3 else None
        status = argv[3] if len(argv) >= 4 else None
        limit = int(argv[4]) if len(argv) >= 5 else 50
        payload = list_return_tickets(episode_id=episode_id, status=status, limit=limit)
    elif command == "list-dramas":
        limit = int(argv[2]) if len(argv) >= 3 else 50
        payload = list_dramas(limit=limit)
    elif command == "list-episodes":
        if len(argv) < 3:
            raise SystemExit("list-episodes requires <episode_id>")
        payload = list_episodes_for_drama(argv[2])
    elif command == "artifacts-by-node-run":
        if len(argv) < 3:
            raise SystemExit("artifacts-by-node-run requires <node_run_id>")
        payload = list_artifacts_by_node_run(argv[2])
    elif command == "tos-presigned-url":
        if len(argv) < 3:
            raise SystemExit("tos-presigned-url requires <tos_url>")
        payload = get_tos_presigned_url(argv[2])
    elif command == "node-trace":
        payload = get_node_trace_payload()
    elif command == "registry-validation":
        payload = get_registry_validation_payload()
    elif command == "north-star-summary":
        payload = get_north_star_summary()
    else:
        raise SystemExit(f"unsupported command: {command}")

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv)
