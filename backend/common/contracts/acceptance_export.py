from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.orchestrator.db_read_side import build_dynamic_task_tabs, get_north_star_summary


def build_payload() -> dict[str, object]:
    return {
        "north_star_summary": get_north_star_summary(),
        "taskTabs": [
            {
                **task_tab,
                "generated_at": datetime.now(tz=timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            }
            for task_tab in build_dynamic_task_tabs()
        ]
    }


if __name__ == "__main__":
    print(json.dumps(build_payload(), ensure_ascii=False))
