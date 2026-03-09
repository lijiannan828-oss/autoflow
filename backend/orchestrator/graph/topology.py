"""Pipeline DAG topology — single source of truth for node ordering,
dependency resolution, stage assignments, and reject targets.

All constants here mirror the Node Registry seed data (dev_seed.py) and
design.md §2.  Runtime node_registry from the DB is authoritative; this
module provides fast in-process lookups that don't require a DB round-trip.
"""

from __future__ import annotations

PIPELINE_NODES: list[str] = [
    "N01", "N02", "N03", "N04", "N05",
    "N06", "N07", "N08", "N09",
    "N10", "N11", "N12", "N13",
    "N14", "N15", "N16", "N17", "N18", "N19",
    "N20", "N21", "N22",
    "N23", "N24", "N25", "N26",
]

# ── 节点中文名称（与 dev_seed.py NODE_REGISTRY_SEEDS 保持一致）──────────
NODE_NAME: dict[str, str] = {
    "N01": "剧本结构化解析",
    "N02": "拆集拆镜",
    "N03": "分镜质检",
    "N04": "分镜定稿",
    "N05": "镜头分级",
    "N06": "视觉元素生成",
    "N07": "美术产品图生成",
    "N08": "Stage1 资产审核 Gate",
    "N09": "美术定稿固化",
    "N10": "关键帧生成",
    "N11": "关键帧质检",
    "N12": "跨镜头连续性检查",
    "N13": "关键帧定稿固化",
    "N14": "视频生成",
    "N15": "视频质检",
    "N16": "节奏连续性分析",
    "N17": "视频定稿固化",
    "N18": "Stage2 Shot 审核 Gate",
    "N19": "视觉整体定稿",
    "N20": "视听整合",
    "N21": "Stage3 Episode 审核 Gate",
    "N22": "视听定稿固化",
    "N23": "成片合成",
    "N24": "Stage4 串行审核 Gate",
    "N25": "成片定稿固化",
    "N26": "分发与推送",
}

_NODE_INDEX: dict[str, int] = {nid: i for i, nid in enumerate(PIPELINE_NODES)}

NODE_DEPENDS_ON: dict[str, list[str]] = {
    "N01": [],
    "N02": ["N01"],
    "N03": ["N02"],
    "N04": ["N03"],
    "N05": ["N04"],
    "N06": ["N04", "N05"],
    "N07": ["N06"],
    "N08": ["N07"],
    "N09": ["N08"],
    "N10": ["N06", "N09"],
    "N11": ["N10"],
    "N12": ["N11"],
    "N13": ["N12"],
    "N14": ["N13"],
    "N15": ["N14"],
    "N16": ["N15"],
    "N17": ["N16"],
    "N18": ["N17"],
    "N19": ["N18"],
    "N20": ["N19"],
    "N21": ["N20"],
    "N22": ["N21"],
    "N23": ["N22"],
    "N24": ["N23"],
    "N25": ["N24"],
    "N26": ["N25"],
}

# Linear successor in the default execution order.
NODE_SUCCESSOR: dict[str, str | None] = {}
for _i, _nid in enumerate(PIPELINE_NODES):
    NODE_SUCCESSOR[_nid] = PIPELINE_NODES[_i + 1] if _i + 1 < len(PIPELINE_NODES) else None

# ── Gate nodes ──────────────────────────────────────────────────────────
GATE_NODES: frozenset[str] = frozenset({"N08", "N18", "N21", "N24"})

GATE_NODE_BY_STAGE: dict[int, str] = {
    1: "N08",
    2: "N18",
    3: "N21",
    4: "N24",
}

GATE_STAGE_BY_NODE: dict[str, int] = {v: k for k, v in GATE_NODE_BY_STAGE.items()}

# ── QC auto-reject ──────────────────────────────────────────────────────
QC_NODES: frozenset[str] = frozenset({"N03", "N11", "N15"})

QC_REJECT_TARGET: dict[str, str] = {
    "N03": "N02",
    "N11": "N10",
    "N15": "N14",
}

MAX_AUTO_REJECTS: int = 3

# ── Stage assignment ────────────────────────────────────────────────────
def stage_no_for_node(node_id: str) -> int:
    """Return the pipeline stage (1-4) for the given node_id."""
    try:
        n = int(node_id[1:])
    except (ValueError, IndexError) as exc:
        raise ValueError(f"invalid node_id: {node_id}") from exc
    if 1 <= n <= 8:
        return 1
    if 9 <= n <= 18:
        return 2
    if 19 <= n <= 21:
        return 3
    if 22 <= n <= 26:
        return 4
    raise ValueError(f"node_id out of range: {node_id}")


# ── Agent role ──────────────────────────────────────────────────────────
NODE_AGENT_ROLE: dict[str, str] = {
    "N01": "script_analyst",
    "N02": "director",
    "N03": "quality_guardian",
    "N04": "director",
    "N05": "director",
    "N06": "visual_director",
    "N07": "visual_director",
    "N08": "human_review_entry",
    "N09": "visual_director",
    "N10": "visual_director",
    "N11": "quality_guardian",
    "N12": "storyboard_planner",
    "N13": "visual_director",
    "N14": "visual_director",
    "N15": "quality_guardian",
    "N16": "storyboard_planner",
    "N17": "visual_director",
    "N18": "human_review_entry",
    "N19": "visual_director",
    "N20": "audio_director",
    "N21": "human_review_entry",
    "N22": "audio_director",
    "N23": "director",
    "N24": "human_review_entry",
    "N25": "director",
    "N26": "director",
}

# ── Stage-level grouping ────────────────────────────────────────────────
STAGE_GROUP: dict[str, str] = {
    "N01": "script", "N02": "script", "N03": "script", "N04": "script", "N05": "script",
    "N06": "art", "N07": "art", "N08": "art", "N09": "art",
    "N10": "keyframe", "N11": "keyframe", "N12": "keyframe", "N13": "keyframe",
    "N14": "video", "N15": "video", "N16": "video", "N17": "video",
    "N18": "video", "N19": "video",
    "N20": "audio", "N21": "audio", "N22": "audio",
    "N23": "final", "N24": "final", "N25": "final", "N26": "final",
}


# ── 节点输出粒度（per_shot / per_asset / episode）─────────────────────
PER_SHOT_NODES: frozenset[str] = frozenset({"N10", "N11", "N14", "N15"})
PER_ASSET_NODES: frozenset[str] = frozenset({"N07"})


def output_scope(node_id: str) -> str:
    """Return the output granularity for a node."""
    if node_id in PER_SHOT_NODES:
        return "per_shot"
    if node_id in PER_ASSET_NODES:
        return "per_asset"
    return "episode"


def is_gate(node_id: str) -> bool:
    return node_id in GATE_NODES


def is_qc(node_id: str) -> bool:
    return node_id in QC_NODES


def next_node(current: str, completed: set[str] | None = None) -> str | None:
    """Return the next node to execute after *current* in the default DAG order.

    For simplicity this follows the linear successor chain.  In a rerun
    scenario the caller should consult ``rerun_node_ids`` first.
    """
    return NODE_SUCCESSOR.get(current)


def should_skip_in_rerun(node_id: str, rerun_node_ids: list[str] | None) -> bool:
    """During a rerun, nodes NOT in the rerun set are skipped."""
    if rerun_node_ids is None:
        return False
    return node_id not in rerun_node_ids
