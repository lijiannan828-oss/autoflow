// 节点输入输出规格定义
// 根据文档定义每个节点的具体 I/O 类型

export interface IOFieldSpec {
  key: string
  label: string
  type: "text" | "json" | "table" | "image_grid" | "audio_list" | "video_grid" | "radar_chart" | "pie_chart" | "timeline" | "diff" | "progress" | "status_list" | "file_info" | "number" | "badge_list"
  description?: string
  truncate?: number // 截断字符数
  columns?: string[] // 表格列定义
  dimensions?: string[] // 雷达图维度
}

export interface NodeIOSpec {
  nodeId: string
  input: IOFieldSpec[]
  output: IOFieldSpec[]
  processData: IOFieldSpec[] // 过程数据
}

// 所有节点的 IO 规格
export const NODE_IO_SPECS: Record<string, NodeIOSpec> = {
  // ==================== Stage 1: 脚本 ====================
  N01: {
    nodeId: "N01",
    input: [
      { key: "file_name", label: "文件名", type: "text" },
      { key: "file_size", label: "文件大小", type: "text" },
      { key: "upload_time", label: "上传时间", type: "text" },
    ],
    output: [
      { key: "world_setting", label: "世界观设定", type: "json" },
      { key: "character_registry", label: "角色列表", type: "table", columns: ["角色名", "外貌描述"], truncate: 80 },
      { key: "location_registry", label: "场景列表", type: "table", columns: ["场景名", "描述"], truncate: 80 },
      { key: "episode_skeletons", label: "集数统计", type: "text" },
    ],
    processData: [
      { key: "model", label: "模型", type: "text" },
      { key: "token_in", label: "输入 Token", type: "number" },
      { key: "token_out", label: "输出 Token", type: "number" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N02: {
    nodeId: "N02",
    input: [
      { key: "episode_number", label: "集号", type: "number" },
      { key: "parsed_script_summary", label: "剧本摘要", type: "text" },
    ],
    output: [
      { key: "shot_count", label: "镜头总数", type: "number" },
      { key: "total_duration", label: "总预估时长", type: "text" },
      { key: "shot_list", label: "镜头列表", type: "table", columns: ["shot_id", "shot_type", "camera_movement", "duration_sec", "visual_prompt", "角色数"], truncate: 50 },
      { key: "keyframe_specs_count", label: "关键帧规格数", type: "number" },
      { key: "motion_segments_count", label: "运动分段数", type: "number" },
    ],
    processData: [
      { key: "model", label: "模型", type: "text" },
      { key: "tokens", label: "Token 数", type: "number" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N03: {
    nodeId: "N03",
    input: [
      { key: "shot_count", label: "来自 N02 的镜头总数", type: "number" },
    ],
    output: [
      { key: "radar_scores", label: "六维度评分", type: "radar_chart", dimensions: ["narrative_coherence", "visual_feasibility", "pacing", "character_consistency", "technical_compliance", "emotional_impact"] },
      { key: "weighted_score", label: "加权总分", type: "number" },
      { key: "decision", label: "决策", type: "badge_list" },
      { key: "issues", label: "问题列表", type: "table", columns: ["维度", "问题描述", "严重程度"] },
      { key: "model_comparison", label: "多模型评分对比", type: "table", columns: ["模型", "分数"] },
    ],
    processData: [
      { key: "voting_models", label: "投票模型", type: "badge_list" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
      { key: "reject_count", label: "打回次数", type: "number" },
    ],
  },
  N04: {
    nodeId: "N04",
    input: [
      { key: "qc_result_summary", label: "N03 QC 结果摘要", type: "text" },
      { key: "issue_count", label: "Issue 数量", type: "number" },
    ],
    output: [
      { key: "frozen_fields", label: "冻结字段清单", type: "badge_list" },
      { key: "diff", label: "修改前后 Diff", type: "diff" },
    ],
    processData: [
      { key: "conditional_llm", label: "是否触发 LLM", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N05: {
    nodeId: "N05",
    input: [
      { key: "frozen_shot_count", label: "N04 冻结镜头总数", type: "number" },
    ],
    output: [
      { key: "difficulty_distribution", label: "难度分布", type: "pie_chart" },
      { key: "qc_tier_distribution", label: "QC Tier 分布", type: "pie_chart" },
      { key: "keyframe_budget", label: "关键帧预算", type: "text" },
      { key: "shot_tier_list", label: "镜头分级列表", type: "table", columns: ["shot_id", "difficulty", "qc_tier", "keyframe_count", "candidate_count", "reason"] },
    ],
    processData: [
      { key: "model", label: "模型", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },

  // ==================== Stage 2: 美术 ====================
  N06: {
    nodeId: "N06",
    input: [
      { key: "character_count", label: "角色数", type: "number" },
      { key: "location_count", label: "场景数", type: "number" },
      { key: "prop_count", label: "道具数", type: "number" },
    ],
    output: [
      { key: "character_plan", label: "角色生成计划", type: "table", columns: ["name", "base_prompt", "reference_strategy", "candidate_count", "resolution"], truncate: 60 },
      { key: "location_plan", label: "场景生成计划", type: "table", columns: ["location_id", "time_variants", "candidate_count"] },
      { key: "prop_plan", label: "道具生成计划", type: "table", columns: ["prop_id", "prompt", "candidate_count"], truncate: 60 },
      { key: "total_images", label: "预计生成图片总数", type: "number" },
    ],
    processData: [
      { key: "model", label: "模型", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N07: {
    nodeId: "N07",
    input: [
      { key: "art_plan_summary", label: "ArtGenerationPlan 摘要", type: "text" },
    ],
    output: [
      { key: "image_grid", label: "图片网格", type: "image_grid", description: "按资产分组 → 按候选排列" },
      { key: "generation_progress", label: "生成进度", type: "progress" },
    ],
    processData: [
      { key: "comfyui_workflow_id", label: "工作流 ID", type: "text" },
      { key: "total_gpu_seconds", label: "GPU 总耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
      { key: "resolution", label: "分辨率", type: "text" },
    ],
  },
  N07b: {
    nodeId: "N07b",
    input: [
      { key: "character_count", label: "角色数", type: "number" },
      { key: "voice_requirements", label: "声音需求", type: "text" },
    ],
    output: [
      { key: "audio_cards", label: "音频播放卡片", type: "audio_list", description: "按角色分组" },
    ],
    processData: [
      { key: "voice_engine", label: "语音引擎", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N08: {
    nodeId: "N08",
    input: [
      { key: "pending_assets_count", label: "待审资产总数", type: "number" },
    ],
    output: [
      { key: "review_decisions", label: "审核决策", type: "table", columns: ["资产ID", "选定候选", "反馈"] },
      { key: "rejected_assets", label: "打回资产列表", type: "badge_list" },
    ],
    processData: [],
  },
  N09: {
    nodeId: "N09",
    input: [
      { key: "selected_results", label: "N08 选定结果", type: "json" },
    ],
    output: [
      { key: "frozen_art_grid", label: "FrozenArtAsset 网格", type: "image_grid" },
      { key: "firered_comparison", label: "FireRed 一致性对比", type: "diff" },
    ],
    processData: [
      { key: "firered_refs", label: "FireRed 引用数", type: "number" },
      { key: "variants_generated", label: "变体生成数", type: "number" },
      { key: "gpu_seconds", label: "GPU 耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },

  // ==================== Stage 3: 关键帧 ====================
  N10: {
    nodeId: "N10",
    input: [
      { key: "shot_count", label: "镜头总数", type: "number" },
      { key: "difficulty_distribution", label: "难度分布", type: "text" },
      { key: "current_shot", label: "当前 shot_id", type: "text" },
      { key: "visual_prompt", label: "视觉 Prompt", type: "text" },
      { key: "frozen_asset_refs", label: "FrozenAsset 参考图", type: "image_grid" },
    ],
    output: [
      { key: "phase1_keyframes", label: "Phase 1: 关键帧 Prompt", type: "table", columns: ["shot_id", "kf_index", "timestamp", "prompt"] },
      { key: "motion_script", label: "运动脚本", type: "text" },
      { key: "phase2_images", label: "Phase 2: 生成图片", type: "image_grid", description: "行=keyframe_index, 列=candidate_index" },
      { key: "generation_progress", label: "生成进度", type: "progress" },
    ],
    processData: [
      { key: "llm_model", label: "LLM 模型", type: "text" },
      { key: "prompt_source", label: "Prompt 来源", type: "badge_list" },
      { key: "llm_duration_s", label: "LLM 耗时", type: "number" },
      { key: "llm_cost_cny", label: "LLM 费用", type: "number" },
      { key: "comfyui_model", label: "ComfyUI 模型", type: "text" },
      { key: "total_gpu_seconds", label: "GPU 总耗时", type: "number" },
      { key: "gpu_cost_cny", label: "GPU 费用", type: "number" },
      { key: "resolution", label: "分辨率", type: "text" },
      { key: "controlnet_type", label: "ControlNet 类型", type: "text" },
    ],
  },
  N11: {
    nodeId: "N11",
    input: [
      { key: "candidate_keyframes", label: "候选关键帧网格", type: "image_grid" },
      { key: "reference_baseline", label: "参考基线图", type: "image_grid" },
    ],
    output: [
      { key: "radar_scores", label: "八维度评分", type: "radar_chart", dimensions: ["character_consistency", "body_integrity", "tone_consistency", "script_fidelity", "action_accuracy", "expression_match", "composition", "lighting_consistency"] },
      { key: "model_comparison", label: "多模型评分对比", type: "table", columns: ["模型", "分数"] },
      { key: "selected_candidate", label: "选定候选", type: "text" },
      { key: "decision", label: "决策", type: "badge_list" },
      { key: "issues", label: "问题列表", type: "table", columns: ["维度", "问题描述"] },
    ],
    processData: [
      { key: "qc_tier", label: "QC Tier", type: "text" },
      { key: "voting_models", label: "投票模型", type: "badge_list" },
      { key: "weighted_score", label: "加权分数", type: "number" },
      { key: "threshold", label: "阈值", type: "number" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N12: {
    nodeId: "N12",
    input: [
      { key: "selected_keyframes_strip", label: "全集选定关键帧", type: "image_grid", description: "按 shot 顺序排列的横向滚动条" },
    ],
    output: [
      { key: "overall_score", label: "连续性总分", type: "number" },
      { key: "issues", label: "问题清单", type: "table", columns: ["severity", "shot_id", "问题描述", "修复建议"] },
    ],
    processData: [
      { key: "model", label: "多模态模型", type: "text" },
      { key: "images_analyzed", label: "分析图片数", type: "number" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N13: {
    nodeId: "N13",
    input: [
      { key: "selected_keyframes", label: "选定关键帧", type: "image_grid" },
      { key: "continuity_report", label: "ContinuityReport 摘要", type: "text" },
    ],
    output: [
      { key: "frozen_keyframes", label: "FrozenKeyframe 列表", type: "image_grid" },
      { key: "adjustment_comparison", label: "调整前后对比", type: "diff" },
    ],
    processData: [
      { key: "adjusted_count", label: "调整数量", type: "number" },
      { key: "firered_edits", label: "FireRed 编辑数", type: "number" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },

  // ==================== Stage 4: 视频 ====================
  N14: {
    nodeId: "N14",
    input: [
      { key: "frozen_keyframes", label: "FrozenKeyframe 缩略图", type: "image_grid" },
      { key: "shot_spec_summary", label: "ShotSpec 摘要", type: "text" },
    ],
    output: [
      { key: "video_grid", label: "视频网格", type: "video_grid", description: "按 shot 分组 → candidate 排列" },
      { key: "generation_progress", label: "生成进度", type: "progress" },
    ],
    processData: [
      { key: "model", label: "模型", type: "badge_list" },
      { key: "keyframe_count", label: "关键帧数", type: "number" },
      { key: "num_frames", label: "帧数", type: "number" },
      { key: "resolution", label: "分辨率", type: "text" },
      { key: "gpu_seconds", label: "GPU 耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N15: {
    nodeId: "N15",
    input: [
      { key: "video_candidates", label: "视频候选网格", type: "video_grid" },
    ],
    output: [
      { key: "radar_scores", label: "评分雷达图", type: "radar_chart", dimensions: ["character_consistency", "body_integrity", "tone_consistency", "script_fidelity", "action_accuracy", "expression_match", "composition", "lighting_consistency", "motion_fluidity", "physics_plausibility"] },
      { key: "model_comparison", label: "多模型评分对比", type: "table", columns: ["模型", "分数"] },
      { key: "selected_candidate", label: "选定候选", type: "text" },
      { key: "decision", label: "决策", type: "badge_list" },
      { key: "special_rules", label: "特殊规则", type: "text", description: "任何维度 < 5.0 直接打回" },
    ],
    processData: [
      { key: "qc_tier", label: "QC Tier", type: "text" },
      { key: "voting_models", label: "投票模型", type: "badge_list" },
      { key: "weighted_score", label: "加权分数", type: "number" },
      { key: "threshold", label: "阈值", type: "number" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N16: {
    nodeId: "N16",
    input: [
      { key: "video_thumbnails", label: "全集视频缩略图序列", type: "video_grid" },
    ],
    output: [
      { key: "overall_rhythm_score", label: "节奏总分", type: "number" },
      { key: "duration_deviation", label: "时长偏差", type: "text" },
      { key: "shot_rhythm_table", label: "Shot 节奏表格", type: "table", columns: ["shot_id", "planned", "actual", "judgment", "trim_suggestion"] },
      { key: "transition_analysis", label: "场景转场分析", type: "text" },
    ],
    processData: [
      { key: "model", label: "模型", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N16b: {
    nodeId: "N16b",
    input: [
      { key: "pacing_report", label: "PacingReport 摘要", type: "text" },
      { key: "shots_to_adjust", label: "需要调整的 shot 列表", type: "badge_list" },
    ],
    output: [
      { key: "adjustment_list", label: "调整清单", type: "table", columns: ["shot_id", "调整类型", "参数", "时长变化"] },
      { key: "video_comparison", label: "调整前后视频对比", type: "video_grid" },
    ],
    processData: [
      { key: "adjustments_count", label: "调整数量", type: "number" },
      { key: "ffmpeg_ops", label: "FFmpeg 操作", type: "badge_list" },
      { key: "duration_s", label: "耗时", type: "number" },
    ],
  },
  N17: {
    nodeId: "N17",
    input: [
      { key: "adjusted_videos", label: "N16b 调整结果", type: "video_grid" },
    ],
    output: [
      { key: "frozen_videos", label: "FrozenVideo 列表", type: "video_grid" },
      { key: "file_size_stats", label: "文件大小统计", type: "text" },
    ],
    processData: [
      { key: "total_size_mb", label: "总大小 (MB)", type: "number" },
      { key: "upscaled", label: "是否超分", type: "text" },
      { key: "codec", label: "编码器", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
    ],
  },
  N18: {
    nodeId: "N18",
    input: [
      { key: "pending_shots_count", label: "待审镜头总数", type: "number" },
    ],
    output: [
      { key: "review_results", label: "逐镜审核结果", type: "table", columns: ["shot_id", "决策", "反馈"] },
    ],
    processData: [],
  },
  N19: {
    nodeId: "N19",
    input: [
      { key: "gate_result", label: "Gate 通过结果", type: "text" },
    ],
    output: [
      { key: "frozen_status", label: "冻结标记确认", type: "text" },
    ],
    processData: [],
  },

  // ==================== Stage 5: 音频 ====================
  N20: {
    nodeId: "N20",
    input: [
      { key: "frozen_video_count", label: "冻结视频片段数", type: "number" },
      { key: "dialogue_line_count", label: "对白行数", type: "number" },
      { key: "bgm_requirements", label: "BGM 需求", type: "text" },
    ],
    output: [
      { key: "multitrack_timeline", label: "多轨时间线", type: "timeline" },
      { key: "substep_progress", label: "子步骤进度", type: "status_list" },
    ],
    processData: [
      { key: "tts_engine", label: "TTS 引擎", type: "text" },
      { key: "tts_lines", label: "TTS 行数", type: "number" },
      { key: "lipsync_applied", label: "唇形同步", type: "text" },
      { key: "bgm_model", label: "BGM 模型", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N21: {
    nodeId: "N21",
    input: [
      { key: "av_preview", label: "合成预览视频", type: "video_grid" },
    ],
    output: [
      { key: "review_decision", label: "审核决策", type: "text" },
      { key: "feedback", label: "反馈", type: "text" },
    ],
    processData: [],
  },
  N22: {
    nodeId: "N22",
    input: [
      { key: "gate_result", label: "Gate 通过结果", type: "text" },
    ],
    output: [
      { key: "frozen_status", label: "冻结标记确认", type: "text" },
    ],
    processData: [],
  },

  // ==================== Stage 6: 成片 ====================
  N23: {
    nodeId: "N23",
    input: [
      { key: "av_multitrack", label: "AV 多轨", type: "timeline" },
      { key: "shot_data", label: "分镜数据", type: "json" },
    ],
    output: [
      { key: "final_video", label: "最终成片", type: "video_grid" },
      { key: "metadata", label: "元数据卡片", type: "json" },
      { key: "highlight_shots", label: "高光闪回片段", type: "badge_list" },
    ],
    processData: [
      { key: "codec", label: "编码器", type: "text" },
      { key: "file_size_mb", label: "文件大小 (MB)", type: "number" },
      { key: "resolution", label: "分辨率", type: "text" },
      { key: "fps", label: "帧率", type: "number" },
      { key: "duration_s", label: "耗时", type: "number" },
      { key: "cost_cny", label: "费用", type: "number" },
    ],
  },
  N24: {
    nodeId: "N24",
    input: [
      { key: "final_video", label: "最终成片", type: "video_grid" },
    ],
    output: [
      { key: "review_status", label: "三步审核状态", type: "status_list" },
      { key: "step_decisions", label: "每步审核决策", type: "table", columns: ["步骤", "决策", "反馈"] },
    ],
    processData: [],
  },
  N25: {
    nodeId: "N25",
    input: [
      { key: "gate_confirmation", label: "Gate 通过确认", type: "text" },
    ],
    output: [
      { key: "delivered_status", label: "交付状态", type: "text" },
      { key: "archive_policy", label: "归档策略", type: "text" },
    ],
    processData: [],
  },
  N26: {
    nodeId: "N26",
    input: [
      { key: "final_episode", label: "FinalEpisode", type: "json" },
      { key: "distribution_config", label: "分发配置", type: "json" },
    ],
    output: [
      { key: "platform_status", label: "平台发布状态", type: "status_list" },
      { key: "external_links", label: "外部链接", type: "badge_list" },
    ],
    processData: [
      { key: "platforms", label: "平台列表", type: "badge_list" },
      { key: "publish_status", label: "发布状态", type: "text" },
      { key: "duration_s", label: "耗时", type: "number" },
    ],
  },
}

// 获取节点 IO 规格
export function getNodeIOSpec(nodeId: string): NodeIOSpec | undefined {
  return NODE_IO_SPECS[nodeId]
}
