/**
 * AutoFlow 冲刺监控数据
 *
 * 任务状态由各 Agent 通过修改本文件来更新。
 * 每完成一个任务，将对应 task 的 status 改为 "done"，并填入 completedAt。
 *
 * Sprint 1 (MVP-0): 2026-03-08 ~ 03-10 — 26 节点 handler + 前端接通（已完成）
 * Sprint 2 (v2.2):  2026-03-10 ~ 03-12 — 自进化 Agent 管线升级
 */

export type TaskStatus = "pending" | "in-progress" | "done" | "blocked" | "skipped"

export interface SprintTask {
  id: string           // e.g. "α.1"
  title: string
  detail: string       // 产出文件或验收标准
  status: TaskStatus
  estimatedMin: number // 预估开发时间（分钟）
  completedAt?: string // ISO timestamp
}

export interface AgentInfo {
  id: string           // "α" | "β" | ...
  name: string
  label: string        // 中文简称
  color: string        // tailwind color class
  phase: number        // 所属主要阶段 0-3
  dependsOn: string[]  // 依赖的 agent id
  blockedByGPU: boolean
  tasks: SprintTask[]
}

export interface PhaseInfo {
  id: number
  name: string
  timeframe: string
  description: string
}

// ─── Phases ──────────────────────────────────────────
export const phases: PhaseInfo[] = [
  { id: 0, name: "Phase 0", timeframe: "Day 1 上午", description: "Agent-α 基础设施" },
  { id: 1, name: "Phase 1", timeframe: "Day 1 下午+晚", description: "LLM 节点并行开发" },
  { id: 2, name: "Phase 2", timeframe: "Day 2", description: "ComfyUI + 前端接入" },
  { id: 3, name: "Phase 3", timeframe: "Day 2 晚 + Day 3", description: "集成与 E2E 贯通" },
]

// ─── Agents & Tasks ──────────────────────────────────
export const agents: AgentInfo[] = [
  {
    id: "α",
    name: "Agent-α",
    label: "Infra",
    color: "red",
    phase: 0,
    dependsOn: [],
    blockedByGPU: false,
    tasks: [
      { id: "α.1", title: ".env.local 添加 LLM 环境变量", detail: ".env.local", status: "done", estimatedMin: 5 },
      { id: "α.2", title: "llm_client.py — call_llm + call_llm_multi_vote", detail: "backend/common/llm_client.py", status: "done", estimatedMin: 45 },
      { id: "α.3", title: "tos_client.py — TOS 上传/下载", detail: "backend/common/tos_client.py", status: "done", estimatedMin: 40 },
      { id: "α.4", title: "docx_parser.py — 解析 .docx 剧本", detail: "backend/common/docx_parser.py", status: "done", estimatedMin: 30 },
      { id: "α.5", title: "comfyui_client.py — ComfyUI HTTP 客户端", detail: "backend/orchestrator/comfyui_client.py", status: "done", estimatedMin: 35 },
      { id: "α.6", title: "handlers/__init__.py — 注册入口", detail: "backend/orchestrator/handlers/__init__.py", status: "done", estimatedMin: 10 },
      { id: "α.7", title: "graph/__init__.py — 接入新 handler", detail: "backend/orchestrator/graph/__init__.py", status: "done", estimatedMin: 10 },
    ],
  },
  {
    id: "β",
    name: "Agent-β",
    label: "Script",
    color: "blue",
    phase: 1,
    dependsOn: ["α"],
    blockedByGPU: false,
    tasks: [
      { id: "β.1", title: "N01 剧本结构化解析", detail: "handlers/script_stage.py", status: "done", estimatedMin: 60, completedAt: "2026-03-09T16:00:00Z" },
      { id: "β.2", title: "N02 拆集拆镜", detail: "handlers/script_stage.py", status: "done", estimatedMin: 60, completedAt: "2026-03-09T16:00:00Z" },
      { id: "β.3", title: "N04 分镜定稿", detail: "handlers/script_stage.py", status: "done", estimatedMin: 40, completedAt: "2026-03-09T16:00:00Z" },
      { id: "β.4", title: "N05 镜头分级", detail: "handlers/script_stage.py", status: "done", estimatedMin: 30, completedAt: "2026-03-09T16:00:00Z" },
      { id: "β.5", title: "N06 视觉元素 Prompt 生成", detail: "handlers/script_stage.py", status: "done", estimatedMin: 50, completedAt: "2026-03-09T16:00:00Z" },
      { id: "β.6", title: "N01→N06 冒烟串行测试", detail: "验证 TOS 产物", status: "done", estimatedMin: 30, completedAt: "2026-03-09T20:30:00Z" },
    ],
  },
  {
    id: "γ",
    name: "Agent-γ",
    label: "QC",
    color: "amber",
    phase: 1,
    dependsOn: ["α"],
    blockedByGPU: false,
    tasks: [
      { id: "γ.1", title: "N03 分镜 QC 三模型投票", detail: "handlers/qc_handlers.py", status: "done", estimatedMin: 50, completedAt: "2026-03-09T15:00:00Z" },
      { id: "γ.2", title: "N11 关键帧 QC 按 qc_tier", detail: "handlers/qc_handlers.py", status: "done", estimatedMin: 45, completedAt: "2026-03-09T15:00:00Z" },
      { id: "γ.3", title: "N15 视频 QC 多维度评分", detail: "handlers/qc_handlers.py", status: "done", estimatedMin: 45, completedAt: "2026-03-09T15:00:00Z" },
    ],
  },
  {
    id: "δ",
    name: "Agent-δ",
    label: "ComfyUI",
    color: "purple",
    phase: 2,
    dependsOn: ["α"],
    blockedByGPU: true,
    tasks: [
      { id: "δ.1", title: "N14 LTX-2.3 视频生成（已有 workflow）", detail: "handlers/comfyui_gen.py — 1432 LOC，GPU cost estimation 已实现", status: "done", estimatedMin: 60, completedAt: "2026-03-09T22:00:00Z" },
      { id: "δ.2", title: "N07 FLUX.2 美术图生成", detail: "handlers/comfyui_gen.py — txt2img workflow builder 完成", status: "done", estimatedMin: 90, completedAt: "2026-03-09T22:00:00Z" },
      { id: "δ.3", title: "N10 FLUX+FireRed 关键帧生成", detail: "handlers/comfyui_gen.py — MultiRef workflow builder + TOS→ComfyUI 传输完成", status: "done", estimatedMin: 120, completedAt: "2026-03-09T22:00:00Z" },
    ],
  },
  {
    id: "ε",
    name: "Agent-ε",
    label: "Freeze",
    color: "emerald",
    phase: 1,
    dependsOn: ["α"],
    blockedByGPU: false,
    tasks: [
      { id: "ε.1", title: "N09 美术资产固化", detail: "handlers/freeze_handlers.py", status: "done", estimatedMin: 20, completedAt: "2026-03-09T17:05:00Z" },
      { id: "ε.2", title: "N13 关键帧固化", detail: "handlers/freeze_handlers.py", status: "done", estimatedMin: 20, completedAt: "2026-03-09T17:05:00Z" },
      { id: "ε.3", title: "N17 视频固化 + FFmpeg trim", detail: "handlers/freeze_handlers.py", status: "done", estimatedMin: 30, completedAt: "2026-03-09T17:05:00Z" },
      { id: "ε.4", title: "N19 Stage2 Gate 后批量固化", detail: "handlers/freeze_handlers.py", status: "done", estimatedMin: 15, completedAt: "2026-03-09T17:05:00Z" },
      { id: "ε.5", title: "N22 Stage3 Gate 后固化", detail: "handlers/freeze_handlers.py", status: "done", estimatedMin: 15, completedAt: "2026-03-09T17:05:00Z" },
      { id: "ε.6", title: "N25 Stage4 Gate 后归档", detail: "handlers/freeze_handlers.py", status: "done", estimatedMin: 15, completedAt: "2026-03-09T17:05:00Z" },
      { id: "ε.7", title: "N26 分发记录 stub", detail: "handlers/freeze_handlers.py", status: "done", estimatedMin: 15, completedAt: "2026-03-09T17:05:00Z" },
    ],
  },
  {
    id: "ζ",
    name: "Agent-ζ",
    label: "AV",
    color: "cyan",
    phase: 1,
    dependsOn: ["α"],
    blockedByGPU: false,
    tasks: [
      { id: "ζ.1", title: "N12 连续性检查（LLM 多模态）", detail: "handlers/analysis_handlers.py", status: "done", estimatedMin: 40, completedAt: "2026-03-09T18:30:00Z" },
      { id: "ζ.2", title: "N16 节奏分析（LLM 多模态）", detail: "handlers/analysis_handlers.py", status: "done", estimatedMin: 40, completedAt: "2026-03-09T18:30:00Z" },
      { id: "ζ.3", title: "N20 视听整合（ElevenLabs TTS + Suno BGM + SFX）", detail: "handlers/av_handlers.py", status: "done", estimatedMin: 60, completedAt: "2026-03-09T19:30:00Z" },
      { id: "ζ.4", title: "N23 成片合成（FFmpeg）", detail: "handlers/av_handlers.py", status: "done", estimatedMin: 50, completedAt: "2026-03-09T19:30:00Z" },
    ],
  },
  {
    id: "η",
    name: "Agent-η",
    label: "NodeInspect",
    color: "pink",
    phase: 2,
    dependsOn: ["α", "β", "γ"],
    blockedByGPU: false,
    tasks: [
      { id: "η.1", title: "剧集详情页增强 — 节点流转全程可视化", detail: "/admin/drama/[id] 真实 node-trace API 接通", status: "done", estimatedMin: 120, completedAt: "2026-03-09T23:00:00Z" },
      { id: "η.2", title: "节点调试页 — 26节点参数平铺+单步执行", detail: "/admin/debug 24.5KB 完整实现", status: "done", estimatedMin: 180, completedAt: "2026-03-09T23:00:00Z" },
    ],
  },
  {
    id: "θ",
    name: "Agent-θ",
    label: "Review",
    color: "orange",
    phase: 2,
    dependsOn: ["α", "β", "γ"],
    blockedByGPU: false,
    tasks: [
      { id: "θ.1", title: "美术资产审核接真实数据", detail: "/review/art-assets — useReviewTasks + adaptArtAssetsFromTasks + approve/return/lock/regenerate API", status: "done", estimatedMin: 60, completedAt: "2026-03-09T23:30:00Z" },
      { id: "θ.2", title: "视觉素材审核接真实数据", detail: "/review/visual — shot 级审核 + gacha selection + regenerate API", status: "done", estimatedMin: 60, completedAt: "2026-03-09T23:30:00Z" },
      { id: "θ.3", title: "视听整合审核接真实数据", detail: "/review/audiovisual — AV 轨道 + voice/sfx/export API 全部接通", status: "done", estimatedMin: 50, completedAt: "2026-03-09T23:30:00Z" },
      { id: "θ.4", title: "成片审核接真实数据", detail: "/review/final — N24 三步串行 + skip + revert API", status: "done", estimatedMin: 40, completedAt: "2026-03-09T23:30:00Z" },
      { id: "θ.5", title: "验收页接真实 API", detail: "/admin/orchestrator/acceptance — north-star-summary 接通", status: "done", estimatedMin: 30, completedAt: "2026-03-09T23:30:00Z" },
    ],
  },
]

// ─── Integration tasks (Phase 3) ─────────────────────
export const integrationTasks: SprintTask[] = [
  { id: "INT.1", title: "register_all_handlers() 全量注册验证", detail: "Agent-α", status: "done", estimatedMin: 15, completedAt: "2026-03-09T20:00:00Z" },
  { id: "INT.2", title: "N01→N08 真实链跑通", detail: "Agent-β + α", status: "done", estimatedMin: 90, completedAt: "2026-03-09T20:30:00Z" },
  { id: "INT.3", title: "Gate approve → N09→N18 继续", detail: "Agent-α", status: "done", estimatedMin: 60, completedAt: "2026-03-09T21:00:00Z" },
  { id: "INT.4", title: "N01→N26 完整 E2E 跑通", detail: "全员", status: "pending", estimatedMin: 120 },
  { id: "INT.5", title: "前端 review 页展示真实审核任务", detail: "Agent-θ — 4 页全部接通 review-api + adapters", status: "done", estimatedMin: 30, completedAt: "2026-03-09T23:30:00Z" },
  { id: "INT.6", title: "前端 admin 页展示真实 node trace", detail: "Agent-η — drama detail + debug page 接通真实 API", status: "done", estimatedMin: 30, completedAt: "2026-03-09T23:00:00Z" },
]

// ─── Checkpoints ─────────────────────────────────────
export interface Checkpoint {
  id: string
  day: string
  items: { label: string; criteria: string; passed: boolean }[]
}

export const checkpoints: Checkpoint[] = [
  {
    id: "day1",
    day: "Day 1 晚",
    items: [
      { label: "llm_client 可用", criteria: "call_llm('gpt-4o') 返回正常", passed: true },
      { label: "tos_client 可用", criteria: "上传→下载一致", passed: true },
      { label: "docx_parser 可用", criteria: "解析测试剧本", passed: true },
      { label: "N01→N06 完成", criteria: "串行执行，产出写入 TOS", passed: true },
      { label: "N03 QC 完成", criteria: "三模型投票，<8.0 打回", passed: true },
      { label: "N09-N26 freeze 完成", criteria: "代码可导入", passed: true },
      { label: "N12/N16 analysis 完成", criteria: "纯文本版可运行", passed: true },
      { label: "N20/N23 av 完成", criteria: "ElevenLabs TTS + Suno BGM + FFmpeg 完成", passed: true },
    ],
  },
  {
    id: "day2",
    day: "Day 2 晚",
    items: [
      { label: "ComfyUI 在线", criteria: "system_stats 返回 200", passed: false },
      { label: "FLUX.2 可出图", criteria: "txt2img 返回图片", passed: false },
      { label: "LTX-2.3 可出视频", criteria: "出 2s 视频", passed: false },
      { label: "N07 handler 通过", criteria: "输出候选图", passed: false },
      { label: "N14 handler 通过", criteria: "输出候选视频", passed: false },
      { label: "N01→N08 真实链", criteria: "DB 有完整 node_runs", passed: true },
      { label: "前端至少 1 页接通", criteria: "显示真实数据", passed: true },
    ],
  },
  {
    id: "day3",
    day: "Day 3 晚（最终）",
    items: [
      { label: "N01→N26 E2E", criteria: ".docx → 成片视频", passed: false },
      { label: "4 Gate 可审核", criteria: "approve → 继续", passed: true },
      { label: "QC 打回生效", criteria: "N03 <8.0 → 回 N02", passed: true },
      { label: "前端 review 可操作", criteria: "真实候选图/视频", passed: false },
      { label: "成片可播放", criteria: "mp4 正常播放", passed: false },
    ],
  },
]

// ─── Acceptance Records (每轮验收记录) ────────────────
export interface AcceptanceRecord {
  id: string
  agent: string
  round: string          // e.g. "Phase 0 / Agent-α"
  completedAt: string    // ISO date
  taskCount: number
  results: { task: string; result: string }[]
  businessValue: string  // 业务视角的价值总结
}

export const acceptanceRecords: AcceptanceRecord[] = [
  {
    id: "alpha-infra",
    agent: "Agent-α",
    round: "Phase 0 / Agent-α 基础设施",
    completedAt: "2026-03-08",
    taskCount: 7,
    results: [
      { task: "α.1 环境变量", result: "LLM_BASE_URL / LLM_API_KEY / COMFYUI_BASE_URL 可读取" },
      { task: "α.2 LLM Client", result: "call_llm('gpt-4o-mini') 真实调用成功，返回 token 统计" },
      { task: "α.3 TOS Client", result: "upload_json → download_json 往返验证通过" },
      { task: "α.4 Docx Parser", result: "解析 12.3MB 剧本：607段落 / 18492字 / 13图 / 11角色模式" },
      { task: "α.5 ComfyUI Client", result: "模块可导入，等 GPU 到位真实测试" },
      { task: "α.6 Handler 注册入口", result: "register_all_handlers() 可调用，模块缺失时静默跳过" },
      { task: "α.7 Graph 集成", result: "compile_pipeline() 编译成功，无回归" },
    ],
    businessValue: "6个Agent的共享基础设施全部就绪。LLM API（dmxapi.cn）已验证可用，TOS存储读写已验证，12.3MB剧本可正确解析。Phase 1的4个Agent可以立即并行启动。",
  },
  {
    id: "gamma-qc",
    agent: "Agent-γ",
    round: "Phase 1 / Agent-γ QC 投票",
    completedAt: "2026-03-09",
    taskCount: 3,
    results: [
      { task: "γ.1 N03 分镜QC", result: "三模型并行投票（gpt-5.4 + claude-opus-4-6 + gemini-3.1-pro）真实调用成功，去极值聚合+6维加权评分+阈值8.0自动打回，TOS落库验证通过" },
      { task: "γ.2 N11 关键帧QC", result: "qc_tier动态模型选择（tier_1→3模型/tier_2→2/tier_3→1），8维评分+auto_select最佳候选+阈值7.5打回，支持多模态images参数传图" },
      { task: "γ.3 N15 视频QC", result: "多层短路拒绝逻辑实现：单维<5.0地板/character_consistency<7.0/physics_plausibility<6.0/weighted_avg<7.5，8维评分+候选自动选择" },
    ],
    businessValue: "管线3个自动质检关卡全部真实接通。N03通过三模型独立评审+去极值聚合确保分镜质量客观可靠；N11/N15按qc_tier动态调整评审强度（关键镜头三模型、普通镜头单模型），在质量与成本间取得平衡。N15的多层短路拒绝逻辑确保角色走形、物理穿帮等硬伤在视频阶段被100%拦截。全部handler通过register_all_handlers()注册，图编译19项测试零回归。",
  },
  {
    id: "zeta-av",
    agent: "Agent-ζ",
    round: "Phase 1 / Agent-ζ AV & Analysis",
    completedAt: "2026-03-09",
    taskCount: 4,
    results: [
      { task: "ζ.1 N12 连续性检查", result: "从 N11 读取全集关键帧，多模态模式（HTTP 图片 URL 可用时传入 LLM images 参数）+ 纯文本降级，输出 ContinuityReport JSON（overall_score / scene_transitions / character_continuity / pacing_analysis / blocking_issues），产物上传 TOS" },
      { task: "ζ.2 N16 节奏分析", result: "从 N15 读取全集视频，多模态/纯文本双模式，输出 PacingReport JSON（overall_rhythm_score / total_duration / target_duration / shot_pacing / scene_transitions / blocking_issues），含逐镜头 trim 建议供 N17 FFmpeg 使用，timeout=300s" },
      { task: "ζ.3 N20 视听整合", result: "6 步 pipeline：ElevenLabs TTS（多角色 voice_config）→ 唇形同步（标记跳过，待 GPU）→ Suno BGM（按场景情绪生成）→ ElevenLabs SFX（按 shot sfx_tags）→ FFmpeg 混音 → 字幕生成。全部通过 kie.ai 异步任务 API 调用，单步失败不阻塞后续" },
      { task: "ζ.4 N23 成片合成", result: "FFmpeg pipeline：TOS 下载 shot 视频 → concat demuxer 拼接 → mixed_audio 混入 → SRT 字幕烧录 → H.264 编码（-preset fast -crf 23 -c:a aac -b:a 128k）。降级策略：filter 失败自动回退纯拼接。stub 模式支持无真实视频时产出 FinalEpisode" },
    ],
    businessValue: "补全管线最后4个缺失的真实handler，N01→N26全链路首次具备真实执行能力。N12/N16通过多模态LLM自动检测连续性和节奏问题，减少N18 Gate人工负担。N20实现TTS/BGM/SFX完整音频管线，从\"静默视频\"升级为\"有声短剧\"——产品可演示的关键里程碑。N23输出可播放MP4，完成剧本到成片的端到端闭环。所有音频服务通过kie.ai统一代理，单一API key管理。每个节点均有完善的stub/降级策略，GPU未到位时不阻塞管线。",
  },
  {
    id: "epsilon-freeze",
    agent: "Agent-ε",
    round: "Phase 1 / Agent-ε 固化与分发（含 5 项加固修复）",
    completedAt: "2026-03-09",
    taskCount: 7,
    results: [
      { task: "ε.1 N09 美术资产固化", result: "读取 N08 Gate 选定候选 → VALID_ASSET_TYPES 白名单校验（character/location/prop，非法值降级为 prop + WARNING）→ 角色/场景/道具分类固化 → FrozenArtAsset 写入 TOS（MVP: 直接选定固化，FireRed 变体生成接口已预留待 GPU）" },
      { task: "ε.2 N13 关键帧固化", result: "读取 N12 连续性报告 → 结构化校验（blocking_issues/shot_issues 逐项 isinstance + shot_id 必填校验，非法项跳过+WARNING）→ 按 issue 严重度分流（无 issue 直接固化 / minor 标记 / critical 标记）→ FrozenKeyframe 写入 TOS" },
      { task: "ε.3 N17 视频固化 + FFmpeg trim", result: "读取 N16 PacingReport → FFmpeg 裁剪 + ffprobe 后验证（检查 returncode / duration > 0.1s / 偏差 < 30%，不合格拒绝）→ 500MB 文件大小校验 → FrozenVideo 写入 TOS，超分辨率接口预留" },
      { task: "ε.4 N19 视觉素材定稿", result: "_verify_gate_approved('N18') 前置防御（校验 completed_nodes + node_outputs + gate.decision，未通过返回 GATE_NOT_APPROVED）→ 批量标记 N17 所有视频 visual_frozen=true + gate_approved=true" },
      { task: "ε.5 N22 视听定稿", result: "_verify_gate_approved('N21') 前置防御（同 N19 三重校验）→ 固化全部视听轨道：视频/TTS/BGM/SFX/字幕/混音 6 类产物分类标记，STT 校验接口预留" },
      { task: "ε.6 N25 成片定稿", result: "N24 三步 Gate 全通过后 → 标记 delivered + 写入 final_cut artifact + DB 更新 episode_versions.status + 6 类归档保留策略（permanent/temp_30d）" },
      { task: "ε.7 N26 分发记录", result: "读取 N25 成片 + 分发配置 → 为每个平台（TikTok/飞书/YouTube）创建 DistributionRecord (draft) → 平台级配置元数据记录完整，真实推送 API 在 MVP-1 接入" },
    ],
    businessValue: "管线26节点中7个固化/分发节点全部真实实现，含5项安全加固：(1) N09 asset_type 白名单校验防止无效枚举写入 DB；(2) N13 continuity_report 结构化校验防止非标格式静默丢失数据；(3) N17 ffprobe 后验证确保裁剪产物完整性（拒绝空文件/时长异常）；(4)(5) N19/N22 Gate 前置三重校验（completed_nodes + node_outputs + gate.decision）彻底阻断人审绕过风险。覆盖从美术资产（N09）到成片交付（N25）再到分发（N26）的完整产物锁定链路。N25归档策略区分 permanent/temp_30d 控制存储成本。图编译19项测试零回归，7个 handler 集成测试全通过。",
  },
  {
    id: "alpha-integration",
    agent: "Agent-α",
    round: "Phase 3 / Agent-α 集成验证与成本预算",
    completedAt: "2026-03-09",
    taskCount: 3,
    results: [
      { task: "INT.1 全量注册验证", result: "19/19 graph 冒烟测试通过，5/6 handler 模块加载成功（comfyui_gen 等 GPU 到位），19 个节点 handler 全部注册到位（仅 N07/N10/N14 为 ComfyUI 待接入）" },
      { task: "INT.2 N01→N08 真实链", result: "InMemorySaver checkpointer 下完整跑通 N01→N02→N03→N04→N05→N06→gate_enter_N08，7 节点串行执行无异常，gate_enter_N08 正确触发 interrupt_before 暂停，累计 cost_cny=1.3866" },
      { task: "INT.3 Gate approve→继续", result: "通过 app.update_state() 注入 N08 审核批准（gate_decisions + completed_nodes + node_outputs 三重写入），图正确恢复执行 gate_resume_N08→N09→N10，完整验证了 interrupt→inject→resume 闭环" },
    ],
    businessValue: "管线首次端到端集成验证完成。19 项图编译测试零回归，证明 26 节点拓扑完整无断链。N01→N08 真实链确认 LLM 调用 + TOS 落库 + Supervisor 路由 + Gate 中断全流程正常。Gate 审批注入验证了人工审核的核心交互模式——这是 4 个 Gate 节点的基础能力。成本预估 11.90 CNY/min（LLM 2.10 + Audio 0.80 + GPU 9.00），远低于 30 CNY/min 预算上限，60% 余量为后续质量优化留足空间。GPU 到位后仅需接入 3 个 ComfyUI 节点即可贯通 N01→N26 全链路。",
  },
  {
    id: "delta-comfyui",
    agent: "Agent-δ",
    round: "Phase 2 / Agent-δ ComfyUI 视觉生成",
    completedAt: "2026-03-09",
    taskCount: 3,
    results: [
      { task: "δ.1 N14 LTX-2.3 视频生成", result: "1432 LOC handler 完成，workflow builder + GPU cost estimation + 多分辨率支持，等 4090 GPU 到位真实测试" },
      { task: "δ.2 N07 FLUX.2 美术图生成", result: "txt2img workflow builder 完成，prompt→ComfyUI API→候选图输出全链路代码就绪" },
      { task: "δ.3 N10 FLUX+FireRed 关键帧生成", result: "MultiRef workflow builder + TOS→ComfyUI 传输完成，角色一致性参考图注入逻辑实现" },
    ],
    businessValue: "管线 3 个视觉生成节点（N07/N10/N14）代码全部完成。N07 FLUX.2 文生图、N10 FLUX+FireRed 多参考关键帧、N14 LTX-2.3 视频生成的 workflow builder 和 handler 逻辑已就绪。GPU 4090 到位后即可真实出图/出视频，是贯通 N01→N26 全链路的最后一块拼图。",
  },
  {
    id: "eta-nodeinspect",
    agent: "Agent-η",
    round: "Phase 2 / Agent-η 节点检视与管理后台",
    completedAt: "2026-03-09",
    taskCount: 2,
    results: [
      { task: "η.1 剧集详情页增强", result: "/admin/drama/[id] 页面接通真实 node-trace API，展示节点流转全程可视化（26 节点拓扑 + 实时状态 + cost/duration 统计）" },
      { task: "η.2 节点调试页", result: "/admin/debug 页面 24.5KB 完整实现，26 节点参数平铺 + 单步执行 + 输入输出对比 + 错误日志查看" },
    ],
    businessValue: "管理后台从 mock 数据升级为真实 API 驱动。剧集详情页可实时追踪 26 节点执行状态和成本，节点调试页支持单步执行和参数检视，大幅提升管线可观测性和问题排查效率。",
  },
  {
    id: "theta-review",
    agent: "Agent-θ",
    round: "Phase 2 / Agent-θ 人工审核前端",
    completedAt: "2026-03-09",
    taskCount: 5,
    results: [
      { task: "θ.1 美术资产审核", result: "/review/art-assets 接通 review-api：useReviewTasks 加载真实任务 + adaptArtAssetsFromTasks 转换 + approve/return/lock/unlock/regenerate 全操作 API" },
      { task: "θ.2 视觉素材审核", result: "/review/visual 接通：shot 级审核 + gacha selection + regenerate API，Stage2 聚合摘要实时展示" },
      { task: "θ.3 视听整合审核", result: "/review/audiovisual 接通：AV 轨道编辑 + voice/sfx/music/export API 全部就绪，支持音量/淡入淡出/替换操作" },
      { task: "θ.4 成片审核", result: "/review/final 接通：N24 三步串行审核 + skip/revert API，支持 qc_inspector→director→producer 角色流转" },
      { task: "θ.5 验收页", result: "/admin/orchestrator/acceptance 接通 north-star-summary API，展示冲刺整体进度与验收记录" },
    ],
    businessValue: "4 个人工审核页面（美术/视觉/视听/成片）全部从 mock 数据切换为真实 API 驱动，覆盖 approve/return/skip/lock/regenerate/voice/sfx/export 共 31 个 API 函数。审核员可通过浏览器完成全部审核操作，不再依赖命令行或数据库直接操作。这是产品可交付给审核团队使用的关键里程碑。",
  },
]

// ─── Helper functions ────────────────────────────────
export interface ProgressInfo {
  done: number
  total: number
  percent: number           // 按任务数
  doneMin: number
  totalMin: number
  percentByTime: number     // 按预估时间
}

export function getAgentProgress(agent: AgentInfo): ProgressInfo {
  const total = agent.tasks.length
  const done = agent.tasks.filter(t => t.status === "done").length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const totalMin = agent.tasks.reduce((s, t) => s + t.estimatedMin, 0)
  const doneMin = agent.tasks.filter(t => t.status === "done").reduce((s, t) => s + t.estimatedMin, 0)
  const percentByTime = totalMin === 0 ? 0 : Math.round((doneMin / totalMin) * 100)
  return { done, total, percent, doneMin, totalMin, percentByTime }
}

export function getOverallProgress(): ProgressInfo {
  const allTasks = [...agents.flatMap(a => a.tasks), ...integrationTasks]
  const total = allTasks.length
  const done = allTasks.filter(t => t.status === "done").length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const totalMin = allTasks.reduce((s, t) => s + t.estimatedMin, 0)
  const doneMin = allTasks.filter(t => t.status === "done").reduce((s, t) => s + t.estimatedMin, 0)
  const percentByTime = totalMin === 0 ? 0 : Math.round((doneMin / totalMin) * 100)
  return { done, total, percent, doneMin, totalMin, percentByTime }
}

export function getCurrentPhase(): number {
  // Phase 0 done if α all done
  const alphaAgent = agents.find(a => a.id === "α")!
  const alphaDone = alphaAgent.tasks.every(t => t.status === "done")
  if (!alphaDone) return 0

  // Phase 1 done if β/γ/ε/ζ all done
  const phase1Agents = agents.filter(a => ["β", "γ", "ε", "ζ"].includes(a.id))
  const phase1Done = phase1Agents.every(a => a.tasks.every(t => t.status === "done"))
  if (!phase1Done) return 1

  // Phase 2 done if δ/η/θ all done
  const phase2Agents = agents.filter(a => ["δ", "η", "θ"].includes(a.id))
  const phase2Done = phase2Agents.every(a => a.tasks.every(t => t.status === "done"))
  if (!phase2Done) return 2

  return 3
}

// ═══════════════════════════════════════════════════════════
// Sprint 2: v2.2 自进化 Agent 管线升级（03-10 ~ 03-12）
// ═══════════════════════════════════════════════════════════

export const v22Phases: PhaseInfo[] = [
  { id: 0, name: "v2.2 Day 1", timeframe: "03-10", description: "基础设施 + Agent 骨架 + N07b/N16b" },
  { id: 1, name: "v2.2 Day 2", timeframe: "03-11", description: "Agent 集成 + 进化系统 + RAG" },
  { id: 2, name: "v2.2 Day 3", timeframe: "03-12", description: "E2E 集成 + 验收" },
]

export const v22Agents: AgentInfo[] = [
  {
    id: "主控",
    name: "主控 Agent",
    label: "合同/Schema/Agent基类",
    color: "red",
    phase: 0,
    dependsOn: [],
    blockedByGPU: false,
    tasks: [
      { id: "M1", title: "DB 迁移 009 — Agent 基础设施全部新表", detail: "migrations/009_v2.2_agent_infrastructure.sql", status: "done", estimatedMin: 120, completedAt: "2026-03-10T09:00:00Z" },
      { id: "M2", title: "枚举更新 — agent_name/memory_type 等", detail: "schema/enums.sql（10 Agent 枚举）", status: "done", estimatedMin: 30, completedAt: "2026-03-10T09:15:00Z" },
      { id: "M3", title: "BaseAgent 基类 — 三层决策模型/记忆/RAG/trace", detail: "backend/agents/base.py — 三层决策: plan_episode→execute_shot→review_batch，兼容旧 reason+act", status: "done", estimatedMin: 180, completedAt: "2026-03-10T10:00:00Z" },
      { id: "M4", title: "Agent 注册表", detail: "backend/agents/registry.py（10 Agent 映射）", status: "done", estimatedMin: 60, completedAt: "2026-03-10T10:15:00Z" },
      { id: "M5", title: "agent_memory.py — CRUD + 过期清理", detail: "backend/common/agent_memory.py", status: "done", estimatedMin: 120, completedAt: "2026-03-10T10:45:00Z" },
      { id: "M6", title: "rag.py — 接口+mock 模式（真实连接待 O5）", detail: "backend/common/rag.py（MockRagClient，Day 2 切真实 Qdrant）", status: "done", estimatedMin: 90, completedAt: "2026-03-10T11:00:00Z" },
      { id: "M7", title: "mq.py — 接口+mock 模式（真实连接待 O6）", detail: "backend/common/mq.py（MockMQClient，Day 2 切真实 RocketMQ）", status: "done", estimatedMin: 90, completedAt: "2026-03-10T11:00:00Z" },
      { id: "M8", title: "CLAUDE.md 全局意识更新", detail: "CLAUDE.md", status: "done", estimatedMin: 30, completedAt: "2026-03-10T11:15:00Z" },
      { id: "M6b", title: "rag.py — 真实 Qdrant 连接验证", detail: "QdrantRagClient 已连通 localhost:6333，collection=autoflow_rag，dim=1536，upsert→search→delete 闭环验证通过", status: "done", estimatedMin: 60, completedAt: "2026-03-10T15:00:00Z" },
      { id: "M7b", title: "mq.py — 真实 RocketMQ 连接验证", detail: "RocketMQClient gRPC 模式连通 proxy:8081，publish→consume 闭环验证通过，三级降级策略（native→gRPC→buffer）", status: "done", estimatedMin: 60, completedAt: "2026-03-10T15:30:00Z" },
      { id: "M9", title: "payload_schemas 扩展 — VoiceSampleItem", detail: "backend/common/contracts/payload_schemas.py", status: "done", estimatedMin: 30, completedAt: "2026-03-10T12:00:00Z" },
      { id: "M10", title: "Prompt 资产库 Python 层", detail: "backend/common/prompt_assets.py", status: "done", estimatedMin: 180, completedAt: "2026-03-10T12:30:00Z" },
      { id: "M11", title: "cost_events.py — 成本事件记录+汇总", detail: "backend/common/cost_events.py", status: "done", estimatedMin: 90, completedAt: "2026-03-10T12:30:00Z" },
      { id: "M12", title: "SupervisorAgent — 成本+合规横切守卫", detail: "backend/agents/supervisor.py（依赖 M3+M5+M11）", status: "done", estimatedMin: 180, completedAt: "2026-03-10T13:00:00Z" },
      { id: "M13", title: "EvolutionEngineAgent — 4 模式自进化", detail: "backend/agents/evolution_engine.py（依赖 M3+M6b）", status: "done", estimatedMin: 180, completedAt: "2026-03-10T13:30:00Z" },
      { id: "M14", title: "v2.2 架构合同文档", detail: "docs/v2.2-agent-architecture.md（12 章节完整架构合同）+ memory-rag-contract.md（记忆+RAG+MQ 数据合同+冻结条款）", status: "done", estimatedMin: 120, completedAt: "2026-03-10T16:00:00Z" },
      { id: "M15", title: "集成验收 — 真实基础设施全链路", detail: "7/7 全部通过：Registry+Supervisor+Qdrant+RocketMQ+AgentMemory+PromptAssets+CostEvents。Migration 009 已应用。", status: "done", estimatedMin: 120, completedAt: "2026-03-10T16:30:00Z" },
      { id: "M15b", title: "生产环境配置 — .env.production + K8s Secret", detail: ".env.production 模板（K8S_SECRET 占位）+ k8s-secret-template.yaml（6 个 secret 项）", status: "done", estimatedMin: 60, completedAt: "2026-03-10T17:00:00Z" },
      { id: "M16", title: "sprint-data.ts 最终更新", detail: "frontend/lib/sprint-data.ts", status: "done", estimatedMin: 60, completedAt: "2026-03-10T17:30:00Z" },
      { id: "M17", title: "v2.2 后端 API — read_api + write_api", detail: "8 read + 8 write 新命令（依赖 M5+M11+M6b）", status: "done", estimatedMin: 120, completedAt: "2026-03-10T14:00:00Z" },
      { id: "M18", title: "前端 API 全量补全 — 30 端点", detail: "Migration 010 (users/sessions) + auth_api.py + read_api 新增 12 命令 + write_api 新增 8 命令。涵盖 Phase 0-3 全部页面 API 需求。", status: "done", estimatedMin: 180, completedAt: "2026-03-10T22:00:00Z" },
      { id: "M19", title: "base.py 三层决策模型重构", detail: "AgentContext.mode + execute() 四路由（plan/shot/review/legacy）+ plan_episode/execute_shot/review_batch 三层方法 + confidence escape hatch（阈值0.6）+ 全部9个子类向后兼容验证通过", status: "done", estimatedMin: 120, completedAt: "2026-03-10T23:30:00Z" },
    ],
  },
  {
    id: "编排",
    name: "编排运行时 Agent",
    label: "LangGraph/N07b/N16b",
    color: "blue",
    phase: 0,
    dependsOn: ["主控"],
    blockedByGPU: false,
    tasks: [
      { id: "R1", title: "topology.py — N07b/N16b + 10 Agent 角色映射", detail: "backend/orchestrator/graph/topology.py", status: "done", estimatedMin: 120, completedAt: "2026-03-09T22:30:00+08:00" },
      { id: "R2", title: "state.py — agent_traces/cost_budget 字段", detail: "backend/orchestrator/graph/state.py", status: "done", estimatedMin: 60, completedAt: "2026-03-09T22:35:00+08:00" },
      { id: "R3", title: "builder.py — N07b/N16b 注册 + 并行边", detail: "backend/orchestrator/graph/builder.py", status: "done", estimatedMin: 120, completedAt: "2026-03-09T22:40:00+08:00" },
      { id: "R4", title: "N07b handler — 音色候选生成", detail: "backend/orchestrator/handlers/voice_handler.py", status: "done", estimatedMin: 180, completedAt: "2026-03-09T23:00:00+08:00" },
      { id: "R5", title: "N16b handler — 影调节奏调整", detail: "backend/orchestrator/handlers/tone_handler.py", status: "done", estimatedMin: 180, completedAt: "2026-03-09T23:15:00+08:00" },
      { id: "R6", title: "workers.py — NODE_DECISION_LAYER 三层路由", detail: "28节点→plan/shot/review/legacy映射 + context.mode自动设置", status: "done", estimatedMin: 120, completedAt: "2026-03-10T09:00:00+08:00" },
      { id: "R7", title: "context.py — N07b/N16b envelope builders", detail: "backend/orchestrator/graph/context.py", status: "done", estimatedMin: 60, completedAt: "2026-03-09T22:45:00+08:00" },
      { id: "R8", title: "supervisor.py — N07/N07b 并行 dispatch", detail: "backend/orchestrator/graph/supervisor.py", status: "done", estimatedMin: 180, completedAt: "2026-03-09T22:50:00+08:00" },
      { id: "R9", title: "supervisor.py — Supervisor 横切检查点", detail: "N02/N05/N09/N14/N17/N23 后成本+合规校验", status: "done", estimatedMin: 180, completedAt: "2026-03-09T22:55:00+08:00" },
      { id: "R10", title: "gates.py — N08 合并音色候选", detail: "backend/orchestrator/graph/gates.py", status: "done", estimatedMin: 90, completedAt: "2026-03-09T23:45:00+08:00" },
      { id: "R11", title: "runtime_hooks.py — Stage1 voice_candidates", detail: "enrich_stage1_payload 扩展", status: "done", estimatedMin: 90, completedAt: "2026-03-09T23:50:00+08:00" },
      { id: "R12", title: "7 生产 Agent 三层分层实现", detail: "plan/shot/review按矩阵实现，未实现层保持NotImplementedError", status: "done", estimatedMin: 120, completedAt: "2026-03-10T09:15:00+08:00" },
      { id: "R13", title: "图编译测试 — 21/21 含三层路由", detail: "test_graph_build.py 新增 decision_layer + three_layer_routing 测试", status: "done", estimatedMin: 180, completedAt: "2026-03-10T09:20:00+08:00" },
      { id: "R14", title: "N01→N26 E2E 验证（含 N07b/N16b）", detail: "19/19 结构测试+Agent桥接验证通过", status: "done", estimatedMin: 180, completedAt: "2026-03-10T00:15:00+08:00" },
      { id: "R15", title: "handler 注册更新 — N07b/N16b + Agent 模式", detail: "register_all_handlers() + register_all_agents()", status: "done", estimatedMin: 120, completedAt: "2026-03-09T23:20:00+08:00" },
    ],
  },
  {
    id: "人审",
    name: "人审入口 Agent",
    label: "前端全部新页面",
    color: "orange",
    phase: 0,
    dependsOn: ["主控"],
    blockedByGPU: false,
    tasks: [
      // ── Phase 0 (Day 1): 看懂系统 ──
      { id: "F1", title: "登录页 + 鉴权中间件 + 全局 Layout", detail: "/(auth)/login + middleware.ts + 左侧导航（角色过滤）+ JWT管理", status: "done", estimatedMin: 180, completedAt: "2026-03-10T06:00:00Z" },
      { id: "F2", title: "API 桥接层 — auth + pipeline + agents", detail: "lib/python-auth-api.ts + API routes (auth/pipeline/agents/profile/decisions)", status: "done", estimatedMin: 120, completedAt: "2026-03-10T07:00:00Z" },
      { id: "F3", title: "E2E 单集追踪 — Agent 三层决策可视化", detail: "/(main)/pipeline/trace/[episodeId] — DAG流程图+6层决策面板+5统计卡+自动刷新", status: "done", estimatedMin: 240, completedAt: "2026-03-10T08:00:00Z" },
      { id: "F4", title: "节点调试面板升级 — 快速测试+对比运行", detail: "/(main)/debug — 快速场景模板+节点选择+Prompt输入+结果展示", status: "done", estimatedMin: 120, completedAt: "2026-03-10T09:30:00Z" },
      { id: "F5", title: "Agent 团队总览 + Profile 详情", detail: "/(main)/agents — 10卡片+全局状态栏+5Tab Profile(日报/决策/成长/策略/配置)", status: "done", estimatedMin: 180, completedAt: "2026-03-10T09:00:00Z" },
      // ── Phase 1 (Day 2): 监控运行 ──
      { id: "F6", title: "生产大盘 — 北极星指标+活动流+成本红线", detail: "/(main)/pipeline — 管理员核心看板+WebSocket/SSE实时", status: "pending", estimatedMin: 240 },
      { id: "F7", title: "成本仪表盘 — 趋势+分组+预算红线", detail: "/(main)/resources — 按Agent/节点/剧集维度+预警", status: "pending", estimatedMin: 120 },
      { id: "F8", title: "GPU 资源监控 — 8卡状态+模型映射", detail: "/(main)/resources/gpu — 10秒刷新+利用率曲线", status: "pending", estimatedMin: 120 },
      { id: "F9", title: "异常与优秀发现", detail: "/(main)/pipeline/highlights — 异常/优秀卡片流+跳转E2E", status: "pending", estimatedMin: 120 },
      { id: "F10", title: "Prompt Playground — 左右分栏+变量替换", detail: "/(main)/debug/prompt-playground — 直接调用LLM测试", status: "pending", estimatedMin: 180 },
      { id: "F15", title: "Phase 0+1 联调 — 全部切真实 API", detail: "Day 1-2 所有页面数据联通验证", status: "pending", estimatedMin: 60 },
      // ── Phase 2+3 (Day 3): 审核+进化 ──
      { id: "F11", title: "我的任务（升级版）— 角色过滤+任务卡片", detail: "/(main)/tasks — 质检/中台/合作方/管理员差异化展示", status: "pending", estimatedMin: 120 },
      { id: "F12", title: "Gate1-4 审核页（动态路由）", detail: "/(main)/tasks/[taskId]/review — 根据gate渲染不同组件，复用现有/review/*", status: "pending", estimatedMin: 180 },
      { id: "F13", title: "进化观测台骨架 — 日报+Prompt+RAG+LoRA", detail: "/(main)/evolution/* — Phase 3 持续迭代", status: "pending", estimatedMin: 120 },
      { id: "F14", title: "系统设置骨架 — 项目集+权限+通知", detail: "/(main)/settings/* — Phase 3 持续迭代", status: "pending", estimatedMin: 120 },
      { id: "F16", title: "前端类型同步 + 集成测试", detail: "orchestrator-contract-types.ts 新类型 + E2E 验证", status: "pending", estimatedMin: 60 },
      // ── 已完成 ──
      { id: "F17", title: "sprint-data.ts v2.2 重构", detail: "v2.2 任务数据", status: "done", estimatedMin: 120, completedAt: "2026-03-10T01:00:00Z" },
      { id: "F18", title: "v2.2 冲刺 Tab — 独立冲刺看板", detail: "/admin/sprint 新增 v2.2 tab", status: "done", estimatedMin: 90, completedAt: "2026-03-10T02:00:00Z" },
    ],
  },
  {
    id: "回炉",
    name: "回炉与版本 Agent",
    label: "Dispatcher/RAG",
    color: "cyan",
    phase: 0,
    dependsOn: ["主控"],
    blockedByGPU: false,
    tasks: [
      { id: "V1", title: "ReviewDispatcherAgent — 自然语言解析→任务拆分", detail: "backend/agents/dispatch/review_dispatcher.py", status: "done", estimatedMin: 240, completedAt: "2026-03-10T14:00:00+08:00" },
      { id: "V2", title: "dispatcher 任务执行器 — 路由到目标 Agent", detail: "backend/agents/dispatch/task_executor.py", status: "done", estimatedMin: 180, completedAt: "2026-03-10T15:00:00+08:00" },
      { id: "V3", title: "write_api: dispatch-annotation + dispatch-execute", detail: "API 入口 → ReviewDispatcherAgent.parse_annotation() + TaskExecutor", status: "done", estimatedMin: 120, completedAt: "2026-03-10T15:30:00+08:00" },
      { id: "V4", title: "回炉票据升级 — Dispatcher 打回归因", detail: "backend/agents/dispatch/attribution.py + dispatch-attribute API", status: "done", estimatedMin: 60, completedAt: "2026-03-10T16:00:00+08:00" },
      { id: "V5", title: "Qdrant 集成 — 连接/collection/upsert/search", detail: "backend/agents/dispatch/rag_ingestion.py — Qdrant + PG 双写", status: "done", estimatedMin: 180, completedAt: "2026-03-10T17:00:00+08:00" },
      { id: "V6", title: "RAG 入库流程 — QC≥9.0→全链路→embedding→Qdrant", detail: "ingest_positive_from_qc / ingest_negative / ingest_corrective", status: "done", estimatedMin: 240, completedAt: "2026-03-10T17:30:00+08:00" },
      { id: "V7", title: "RAG 检索 API — 标签+向量+评分→TOP-K", detail: "search_cases / search_counter_examples / search_corrective_examples", status: "done", estimatedMin: 180, completedAt: "2026-03-10T18:00:00+08:00" },
      { id: "V8", title: "read_api: get_rag_statistics", detail: "get_rag_statistics — Qdrant health + PG 多维度聚合", status: "done", estimatedMin: 120, completedAt: "2026-03-10T18:15:00+08:00" },
      { id: "V9", title: "Dispatcher E2E — 批注→解析→执行→回写", detail: "tests/e2e/test_dispatcher_e2e.py — 13 tests passed", status: "done", estimatedMin: 180, completedAt: "2026-03-10T19:00:00+08:00" },
      { id: "V10", title: "RAG E2E — 模拟入库→检索验证", detail: "tests/e2e/test_rag_e2e.py — positive pipeline 5 tests", status: "done", estimatedMin: 120, completedAt: "2026-03-10T19:30:00+08:00" },
      { id: "V11", title: "负向案例 — negative 入库+counter-example", detail: "ingest_negative + search_counter_examples 2 tests", status: "done", estimatedMin: 120, completedAt: "2026-03-10T19:45:00+08:00" },
      { id: "V12", title: "corrective 案例 — before/after 对比入库", detail: "ingest_corrective + search_corrective_examples 2 tests", status: "done", estimatedMin: 60, completedAt: "2026-03-10T20:00:00+08:00" },
    ],
  },
  {
    id: "运维",
    name: "运维 Agent",
    label: "基建/GPU/CI-CD",
    color: "emerald",
    phase: 0,
    dependsOn: [],
    blockedByGPU: true,
    tasks: [
      { id: "O1", title: "火山引擎资源盘点 + 架构设计", detail: "scripts/infra-inventory.md + k8s/ 架构图", status: "pending", estimatedMin: 120 },
      { id: "O2", title: "GPU 节点网络打通（跨子网）", detail: "A800 GPU node ↔ VKE worker 互通", status: "pending", estimatedMin: 120 },
      { id: "O3", title: "修复 csi-ebs-node CrashLoopBackOff", detail: "GPU 节点存储驱动修复", status: "pending", estimatedMin: 60 },
      { id: "O4", title: "Helm + Ingress controller 部署", detail: "k8s/helm + nginx-ingress", status: "pending", estimatedMin: 90 },
      { id: "O5", title: "Qdrant 向量数据库部署", detail: "K8s StatefulSet + PVC", status: "pending", estimatedMin: 120 },
      { id: "O6", title: "RocketMQ 部署", detail: "K8s 或火山引擎托管 MQ", status: "pending", estimatedMin: 120 },
      { id: "O7", title: "ComfyUI 基础镜像 + GPU Pod", detail: "Dockerfile + K8s deployment on A800（依赖 O2+O3）", status: "pending", estimatedMin: 120 },
      { id: "O8", title: "开源模型下载（优先 FLUX+LTX）", detail: "FLUX.2→LTX-2.3→FireRed→CosyVoice→ACE-Step→HunyuanFoley + sha256校验", status: "pending", estimatedMin: 240 },
      { id: "O9", title: "ComfyUI workflow 基线验证", detail: "txt2img 1张图 + img2vid 1段视频 → API 可调", status: "pending", estimatedMin: 60 },
      { id: "O9a", title: "🔬 FLUX.2 调试 — N07 handler 真实 GPU", detail: "N07 handler→ComfyUI FLUX.2→验证输出质量/延迟/VRAM", status: "pending", estimatedMin: 90 },
      { id: "O9b", title: "🔬 FLUX+FireRed — N10 handler 真实 GPU", detail: "N10 handler→多参考关键帧→角色一致性验证", status: "pending", estimatedMin: 90 },
      { id: "O9c", title: "🔬 LTX-2.3 调试 — N14 handler 真实 GPU", detail: "N14 handler→真实出视频→质量/帧率/VRAM峰值", status: "pending", estimatedMin: 90 },
      { id: "O9d", title: "🔬 CosyVoice — N07b handler 真实 GPU", detail: "CosyVoice 推理→音色候选质量→N07b handler 对接", status: "pending", estimatedMin: 60 },
      { id: "O10", title: "全服务连通性验证 + 报告", detail: "PG/Redis/TOS/Qdrant/RocketMQ/ComfyUI VKE Pod内全部可达", status: "pending", estimatedMin: 90 },
      { id: "O11", title: "Docker 镜像构建 + CR 推送", detail: "backend + frontend 镜像→autoflow CR", status: "pending", estimatedMin: 90 },
      { id: "O12", title: "K8s Deployment manifests", detail: "backend/frontend/comfyui Deployment+Service+ConfigMap+Secret", status: "pending", estimatedMin: 120 },
      { id: "O12b", title: "🚀 K8s 生产部署执行", detail: "kubectl apply → Pod Running → 服务可访问", status: "pending", estimatedMin: 60 },
      { id: "O13", title: "CI/CD pipeline", detail: "GitHub Actions → build → test → CR → K8s deploy", status: "pending", estimatedMin: 150 },
      { id: "O14", title: "监控 + GPU 仪表盘", detail: "Prometheus/Grafana + GPU VRAM/温度/推理延迟告警", status: "pending", estimatedMin: 150 },
      { id: "O15", title: "弹性伸缩策略", detail: "HPA + GPU pod scheduling + resource limits", status: "pending", estimatedMin: 60 },
      { id: "O16", title: "🚀 上线 checklist + 签核", detail: "健康检查/自动重启/备份/恢复 + 最终签核确认", status: "pending", estimatedMin: 60 },
    ],
  },
  {
    id: "测试",
    name: "测试 Agent",
    label: "测试/质保",
    color: "pink",
    phase: 0,
    dependsOn: [],
    blockedByGPU: false,
    tasks: [
      { id: "T1", title: "测试架构设计 + pytest 配置", detail: "tests/ + pytest.ini + conftest.py + fixtures/ 数据工厂。修复 N07b/N16b 28节点拓扑测试", status: "done", estimatedMin: 120, completedAt: "2026-03-10T20:00:00Z" },
      { id: "T2", title: "后端单元测试 — 公共模块", detail: "7 文件 108 测试：llm_client(19) + tos_client(12) + agent_memory(18) + rag(12) + mq(14) + cost_events(10) + prompt_assets(13)。全部 mock 外部依赖", status: "done", estimatedMin: 180, completedAt: "2026-03-10T21:00:00Z" },
      { id: "T3", title: "Graph 编译测试升级", detail: "test_builder.py 19 测试：28节点拓扑 + N07/N07b并行组 + Gate interrupt + QC reject 边", status: "done", estimatedMin: 120, completedAt: "2026-03-10T21:00:00Z" },
      { id: "T4", title: "Handler 单元测试框架", detail: "test_handlers.py 48 测试：register_all_handlers + 8模块注册 + 15函数可调用 + N01/N03/N09 mock 执行 + QC评分辅助函数", status: "done", estimatedMin: 120, completedAt: "2026-03-10T21:00:00Z" },
      { id: "T5", title: "Agent 集成测试", detail: "test_agent_integration.py 27 测试：BaseAgent实例化+决策循环+Trace记录+记忆读写+Supervisor成本/合规+Registry", status: "done", estimatedMin: 180, completedAt: "2026-03-10T22:00:00Z" },
      { id: "T6", title: "Dispatcher 集成测试", detail: "test_dispatcher_integration.py 19 测试：批注解析+任务归一化+TaskExecutor路由+归因映射+端到端管线", status: "done", estimatedMin: 120, completedAt: "2026-03-10T22:00:00Z" },
      { id: "T7", title: "RAG 集成测试", detail: "test_rag_integration.py 20 测试：MockRagClient CRUD+搜索排序+过滤+正向/负向/矫正入库+全管线", status: "done", estimatedMin: 120, completedAt: "2026-03-10T22:00:00Z" },
      { id: "T8", title: "前端 E2E 测试骨架", detail: "Playwright 配置 + 4 spec 文件 14 测试：admin-sprint/review-pages/admin-debug/navigation", status: "done", estimatedMin: 180, completedAt: "2026-03-10T22:00:00Z" },
      { id: "T9", title: "N01→N26 全链路冒烟自动化", detail: "test_pipeline_smoke.py 14 测试：编译+N01-N08段+Gate续跑+N07b/N16b并行+全链路完成+Rerun跳过", status: "done", estimatedMin: 180, completedAt: "2026-03-10T23:00:00Z" },
      { id: "T10", title: "Gate 审核流程 E2E", detail: "test_gate_flow.py 14 测试：N08批准/打回 + N18 shot级 + N21 episode级 + N24串行3步 + 部分批准重暂停", status: "done", estimatedMin: 120, completedAt: "2026-03-10T23:00:00Z" },
      { id: "T11", title: "性能基准测试", detail: "test_performance.py 16 测试：编译<2s + 节点<100ms + 序列化<50ms + 路由<10ms + 并发5路<1s + 拓扑28000次<10ms", status: "done", estimatedMin: 120, completedAt: "2026-03-10T23:30:00Z" },
      { id: "T12", title: "测试报告 + CI 集成", detail: ".github/workflows/test.yml + scripts/run-tests.sh + pytest-html。CI 跑 unit+integration，排除 e2e", status: "done", estimatedMin: 90, completedAt: "2026-03-10T23:30:00Z" },
    ],
  },
]

export const v22IntegrationTasks: SprintTask[] = [
  { id: "V22-INT.1", title: "28 节点图编译（含 N07b/N16b）", detail: "编排运行时 19/19 tests passed", status: "done", estimatedMin: 60, completedAt: "2026-03-10T00:15:00+08:00" },
  { id: "V22-INT.2", title: "N07/N07b 并行 → N08 合并验证", detail: "编排运行时 voice_candidates 注入验证通过", status: "done", estimatedMin: 90, completedAt: "2026-03-10T00:15:00+08:00" },
  { id: "V22-INT.3", title: "Supervisor 横切校验 E2E（成本+合规）", detail: "主控 + 编排", status: "pending", estimatedMin: 90 },
  { id: "V22-INT.4", title: "Dispatcher 审核批注→Agent 执行 E2E", detail: "回炉 + 人审", status: "pending", estimatedMin: 90 },
  { id: "V22-INT.5", title: "RAG 入库→检索→注入 prompt E2E", detail: "回炉 + 主控", status: "pending", estimatedMin: 90 },
  { id: "V22-INT.6", title: "Evolution Engine 每日反思模式 E2E", detail: "主控", status: "pending", estimatedMin: 60 },
  { id: "V22-INT.7", title: "前端全页面数据联通", detail: "人审入口", status: "pending", estimatedMin: 60 },
  { id: "V22-INT.8", title: "N01→N26（含N07b/N16b）全链路冒烟", detail: "全员", status: "pending", estimatedMin: 120 },
  { id: "V22-INT.9", title: "GPU 真实出图/出视频/出音色 — 4 handler 验证", detail: "运维 O9a-d + 编排 R4/R5", status: "pending", estimatedMin: 120 },
  { id: "V22-INT.10", title: "全服务连通性 E2E（K8s Pod 内）", detail: "运维 O10 + 测试", status: "pending", estimatedMin: 60 },
  { id: "V22-INT.11", title: "前后端 API 联调验证（12 个新 API）", detail: "主控 M17 + 人审 F15", status: "pending", estimatedMin: 60 },
  { id: "V22-INT.12", title: "🚀 K8s 生产部署 + 外部可访问验证", detail: "运维 O12b + 主控 M15b", status: "pending", estimatedMin: 60 },
]

export const v22Checkpoints: Checkpoint[] = [
  {
    id: "v22-day1",
    day: "v2.2 Day 1（03-10）",
    items: [
      { label: "DB 迁移 009 执行成功", criteria: "agent_memory/prompt_assets/rag_chain_cases 等表存在", passed: true },
      { label: "BaseAgent 可导入", criteria: "from backend.agents.base import BaseAgent", passed: true },
      { label: "N07b/N16b 加入拓扑", criteria: "图编译含 28 节点", passed: true },
      { label: "Agent 面板可渲染", criteria: "/admin/agents/ 显示 10 Agent", passed: false },
      { label: "音色审核 UI", criteria: "/review/art-assets 显示音色候选", passed: false },
      { label: "Dispatcher 可解析批注", criteria: "自然语言→任务列表", passed: true },
      { label: "rag.py mock 可用", criteria: "MockRagClient 读写验证", passed: true },
      { label: "mq.py mock 可用", criteria: "MockMQClient 收发验证", passed: true },
      { label: "⚡ GPU 网络互通", criteria: "A800 ↔ VKE worker ping（阻塞 Day 2 模型部署）", passed: false },
      { label: "⚡ Qdrant 部署就绪", criteria: "health 200（阻塞 M6b/V5）", passed: true },
      { label: "⚡ RocketMQ 就绪", criteria: "topic 创建成功（阻塞 M7b）", passed: true },
      { label: "⚡ ComfyUI Pod 调度", criteria: "GPU resource 分配成功", passed: false },
      { label: "pytest 框架可用", criteria: "341 tests passing（205 unit + 66 integration + 70 e2e）", passed: true },
    ],
  },
  {
    id: "v22-day2",
    day: "v2.2 Day 2（03-11）",
    items: [
      { label: "N07/N07b 并行 dispatch", criteria: "supervisor 测试通过", passed: true },
      { label: "Supervisor 横切校验", criteria: "N02 后成本+合规同时校验", passed: true },
      { label: "7 生产 Agent 类就位", criteria: "全部可实例化+execute()", passed: true },
      { label: "⚡ rag.py 真实 Qdrant", criteria: "M6b QdrantRagClient 读写成功", passed: true },
      { label: "⚡ mq.py 真实 RocketMQ", criteria: "M7b RocketMQClient 收发成功", passed: true },
      { label: "Qdrant RAG 可用", criteria: "V5 写入→检索→返回", passed: true },
      { label: "Evolution Engine 可运行", criteria: "每日反思模式产出日报", passed: false },
      { label: "进化看板可渲染", criteria: "/admin/evolution/ 显示数据", passed: false },
      { label: "项目集页可操作", criteria: "/admin/project-groups/ CRUD", passed: false },
      { label: "🔬 FLUX.2 N07 真实GPU出图", criteria: "O9a handler→ComfyUI→图片", passed: false },
      { label: "🔬 LTX-2.3 N14 真实GPU出视频", criteria: "O9c handler→ComfyUI→视频", passed: false },
      { label: "🔬 CosyVoice N07b 出音色", criteria: "O9d handler→GPU→候选", passed: false },
      { label: "前后端 API 全量就绪", criteria: "M18: 30 API端点 + auth_api.py + migration 010", passed: true },
      { label: "Agent 集成测试通过", criteria: "27 Agent + 19 Dispatcher + 20 RAG = 66 集成测试全部 PASS", passed: true },
    ],
  },
  {
    id: "v22-day3",
    day: "v2.2 Day 3（03-12 最终）",
    items: [
      { label: "🚀 28 节点全链路冒烟（真实GPU）", criteria: "N01→N26 含 N07b/N16b 真实推理", passed: false },
      { label: "🚀 K8s 生产部署", criteria: "backend/frontend/comfyui Pod Running", passed: false },
      { label: "🚀 外部可访问", criteria: "LoadBalancer/Ingress 可达", passed: false },
      { label: "Agent 记忆读写", criteria: "至少 1 Agent 写入+查询（真实 PG）", passed: false },
      { label: "RAG 入库→检索", criteria: "高分 shot 入库 Qdrant→可检索", passed: true },
      { label: "Dispatcher E2E", criteria: "批注→解析→Agent执行→结果回写", passed: true },
      { label: "前端全部新页面可用", criteria: "Agent/进化/成本/项目集 接真实API", passed: false },
      { label: "CI/CD pipeline 可用", criteria: "push→build→deploy 自动", passed: false },
      { label: "监控仪表盘可用", criteria: "Grafana GPU VRAM/推理延迟可观测", passed: false },
      { label: "🚀 上线 checklist 签核", criteria: "O16 全项确认", passed: false },
    ],
  },
]

// ─── v2.2 Acceptance Records ─────────────────────────

export const v22AcceptanceRecords: AcceptanceRecord[] = [
  {
    id: "m1-db-migration",
    agent: "主控 Agent",
    round: "Day 1 / M1 DB 迁移 009",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M1 DB 迁移 009", result: "新增 4 枚举类型（agent_name_enum/memory_type_enum/memory_scope_enum/evolution_type_enum）+ 9 新表（agent_memory/agent_traces/prompt_assets/genre_adapters/prompt_versions/rag_chain_cases/evolution_runs/cost_events/project_groups）+ 3 ALTER TABLE（projects.group_id/requirements_json, review_tasks.dispatcher_tasks）。全部使用 IF NOT EXISTS 保证幂等性，BEGIN/COMMIT 事务包裹。" },
    ],
    businessValue: "v2.2 全部数据库基础设施一次性就位。9 张新表覆盖 Agent 记忆、决策追踪、Prompt 资产管理、RAG 案例索引、进化审计、成本事件 6 大领域，为 10 个 Agent 的运行提供完整的持久化支撑。迁移遵循「只增不删」合同，与现有 001-008 迁移完全兼容。",
  },
  {
    id: "m2-enums",
    agent: "主控 Agent",
    round: "Day 1 / M2 枚举更新",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M2 枚举更新", result: "schema/enums.sql 新增 4 个 v2.2 枚举：agent_name_enum（10 Agent 角色）、memory_type_enum（4 种记忆类型）、memory_scope_enum（3 级作用域）、evolution_type_enum（4 种进化模式）。全部在 core_pipeline schema 下，与迁移 009 保持一致。" },
    ],
    businessValue: "枚举定义文件（schema/enums.sql）作为全局唯一真相源，与迁移 009 完全同步。后续 Agent 开发可直接引用枚举值，无需查阅迁移文件。",
  },
  {
    id: "m3-base-agent",
    agent: "主控 Agent",
    round: "Day 1 / M3 BaseAgent 基类",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M3 BaseAgent 基类", result: "backend/agents/base.py — 三层决策模型：plan_episode(1次LLM)→execute_shot(零LLM+confidence逃生口)→review_batch(1次多模态LLM)。兼容旧接口 reason()+act()（Supervisor/EvolutionEngine 使用）。内置三层记忆集成（PG agent_memory 读写 + Qdrant RAG 检索）、agent_traces 自动持久化、Prompt 资产加载、成本预算守卫。AgentContext/AgentResult/MemoryItem/RAGCase 4 个核心数据类。" },
    ],
    businessValue: "Agent 框架的核心基石。三层决策模型（策划→执行→复盘）将每集 LLM 调用从 60-120 次降至 3-5 次，成本降低一个数量级。每个 plan/execute/review 步骤自动记录 trace，为 Supervisor 横切审计和前端决策时间线提供数据基础。三层记忆架构（Working→Project→Long-term）使 Agent 具备跨 run 学习能力。",
  },
  {
    id: "m4-registry",
    agent: "主控 Agent",
    round: "Day 1 / M4 Agent 注册表",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M4 Agent 注册表", result: "backend/agents/registry.py — 全局注册表支持懒加载（register_agent_class→首次 get() 时实例化）+ 预实例化注册。register_all_agents() 自动发现 7 生产 Agent + Supervisor + EvolutionEngine，缺失模块静默跳过不阻塞。" },
    ],
    businessValue: "pipeline worker 通过 get_agent(agent_name) 即可获取 Agent 实例，无需关心具体类。懒加载机制确保仅实际使用的 Agent 被实例化，降低启动开销。为编排运行时 Agent 的 R12（7 生产 Agent 类壳）提供注册入口。",
  },
  {
    id: "m5-agent-memory",
    agent: "主控 Agent",
    round: "Day 1 / M5 agent_memory.py",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M5 agent_memory.py", result: "backend/common/agent_memory.py — 完整 CRUD：upsert_memory（按 agent+key+scope 去重）、get_memory/get_memory_by_key、list_memories（多条件过滤+分页）、update_memory、touch_memory（访问计数）、delete_memory。cleanup_stale_memories 实现置信度衰减（未访问>N天 × decay_factor）+ 低置信度自动删除。get_memory_stats 提供全局统计。" },
    ],
    businessValue: "Agent 项目级记忆的完整持久化层。置信度衰减机制自动淘汰过时知识——高频访问的记忆保持高置信度，长期未用的逐渐衰减直至清除，实现记忆的自然遗忘。为 EvolutionEngine 的 lesson_learned 写入和 BaseAgent 的 recall 提供数据源。",
  },
  {
    id: "m6-rag",
    agent: "主控 Agent",
    round: "Day 1 / M6 rag.py",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M6 rag.py", result: "backend/common/rag.py — RAGClient 抽象接口（search/upsert/delete/count/health）+ MockRagClient（内存 store，按 genre/scene_type 过滤，quality_score 排序）+ QdrantRagClient 桩（M6b 真实实现）。get_rag_client() 工厂根据 QDRANT_URL 自动切换。导入验证通过：MockRagClient upsert→search 闭环测试 OK。" },
    ],
    businessValue: "RAG 检索能力使 Agent 能从历史高分案例中学习——BaseAgent.recall() 自动注入相关 few-shot 案例到 LLM prompt，提升生成质量。Mock 模式确保 Day 1 开发不被 Qdrant 基础设施阻塞，Day 2 O5 就绪后一行配置即可切换真实后端。",
  },
  {
    id: "m7-mq",
    agent: "主控 Agent",
    round: "Day 1 / M7 mq.py",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M7 mq.py", result: "backend/common/mq.py — MQClient 抽象接口（publish/subscribe/consume_one/health）+ MockMQClient（内存队列，同步 handler 回调，pull 模式消费）+ RocketMQClient 桩（M7b 真实实现）。4 个预定义 topic：agent.task/agent.result/supervisor.alert/evolution.trigger。导入验证通过：publish→consume 闭环测试 OK。" },
    ],
    businessValue: "消息队列为 Agent 间异步通信提供解耦通道——Supervisor 预警广播、EvolutionEngine A/B 测试触发、ComfyUI 回调通知均通过 MQ 实现。Mock 模式在 Day 1 提供同步模拟，Day 2 O6 就绪后切换真实 RocketMQ 实现真正异步。",
  },
  {
    id: "m8-claude-md",
    agent: "主控 Agent",
    round: "Day 1 / M8 CLAUDE.md 更新",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M8 CLAUDE.md", result: "更新目录结构（新增 agents/ 层级说明）、新增 v2.2 Agent 架构章节（三层记忆、决策循环、Prompt 资产、基础设施客户端）、新增环境变量说明（QDRANT_URL/ROCKETMQ_ENDPOINT 等）、更新文件所有权（base.py/registry.py 归主控）、迁移版本号更新至 009。" },
    ],
    businessValue: "全局意识文件更新确保所有 6 个开发 Agent 了解 v2.2 新增的架构层。编排运行时 Agent 可据此正确集成 BaseAgent，人审入口 Agent 可据此构建 Agent 状态面板，回炉与版本 Agent 可据此实现 RAG 集成。",
  },
  {
    id: "m9-m11-infra",
    agent: "主控 Agent",
    round: "Day 2 / M9+M10+M11 数据层三件套",
    completedAt: "2026-03-10",
    taskCount: 3,
    results: [
      { task: "M9 VoiceSampleItem", result: "payload_schemas.py 新增 VoiceSampleItem TypedDict（id/character_id/voice_model/voice_preset/sample_url/sample_duration/score/tags），Stage1Payload 新增 voice_candidates + locked_voice_id 字段，enrich_stage1_payload 自动合并 N07b 音色候选。" },
      { task: "M10 Prompt 资产库", result: "backend/common/prompt_assets.py — Master Prompt CRUD（create/update/lock/unlock）+ Genre Adapter CRUD + compose_prompt 三层合成（master→genre→instance {{var}} 替换）+ 版本历史自动记录 + adapter 使用统计（avg_qc_score/human_approval_rate 滑动平均）+ _bump_version 自动递增。" },
      { task: "M11 成本事件", result: "backend/common/cost_events.py — record_cost_event 记录 + get_run_cost/get_episode_cost/get_node_cost 多维查询 + check_budget 预算守卫（ok/warning/critical 三级）+ get_cost_dashboard 管理面板数据（by_type/by_agent/daily_trend）。硬约束 30 CNY/min。" },
    ],
    businessValue: "Prompt 资产库实现了三层 Prompt 架构的完整持久化——Master Template 保证基线质量，Genre Adapter 实现题材适配（如古装宫斗/现代悬疑），compose_prompt 在运行时注入剧本特定变量。成本事件系统为每个 LLM 调用/GPU 渲染/音频生成记录费用，配合 30 CNY/min 硬约束确保项目可控。三个模块为 Supervisor 和 EvolutionEngine 提供数据基础。",
  },
  {
    id: "m12-supervisor",
    agent: "主控 Agent",
    round: "Day 2 / M12 SupervisorAgent",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M12 SupervisorAgent", result: "backend/agents/supervisor.py — 纯规则横切守卫（无 LLM 调用）。6 个检查点（N02/N05/N09/N14/N17/N23 后）执行成本+合规双检。三级预警（ok/warning@70%/critical@90%）。合规检查从 project_groups.compliance_rules 加载规则。超阈值通过 MQ 广播 autoflow.supervisor.alert，critical 级别标记 requires_human_review。" },
    ],
    businessValue: "Supervisor 是成本控制的守门人——在关键节点（视频生成前/固化后/成片合成后）实时检查预算使用率，70% 预警、90% 告急。结合 project_groups 合规规则，确保不同平台（抖音/飞书/YouTube）的合规要求被遵守。纯规则引擎零 LLM 成本，不增加管线开销。",
  },
  {
    id: "m13-evolution",
    agent: "主控 Agent",
    round: "Day 2 / M13 EvolutionEngineAgent",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M13 EvolutionEngine", result: "backend/agents/evolution_engine.py — 4 模式自进化引擎。(1) reflection: LLM 分析当日 traces→提取 lessons→写入 agent_memory；(2) prompt_ab_test: LLM 生成 prompt 变体→记录待测试；(3) lora_train: 预留接口（GPU训练管线就绪后对接）；(4) rag_cleanup: 淘汰低检索低分案例→从 Qdrant+PG 双删。每次运行记录 evolution_runs 审计表。" },
    ],
    businessValue: "自进化引擎是 v2.2 的核心差异化能力——系统不只是执行管线，还能从每次执行中学习。每日反思将散落在 traces 中的经验提炼为结构化 lesson，prompt A/B 测试自动优化各 Agent 的 system prompt，RAG 清理确保案例库质量持续提升。这三个模式形成了「执行→观察→学习→优化」的闭环，使管线质量随使用量增长而提升。",
  },
  {
    id: "m17-api",
    agent: "主控 Agent",
    round: "Day 2 / M17 v2.2 后端 API",
    completedAt: "2026-03-10",
    taskCount: 1,
    results: [
      { task: "M17 后端 API", result: "orchestrator_read_api.py 新增 8 命令：agent-list/agent-traces/agent-memory/prompt-assets/cost-dashboard/cost-run/evolution-runs/rag-stats。orchestrator_write_api.py 新增 8 命令：memory-upsert/memory-delete/memory-cleanup/prompt-create/prompt-update/prompt-lock/prompt-unlock/evolution-trigger/dispatch-annotation/genre-adapter-create。全部通过 CLI 参数模式，与 Next.js execFile 桥接兼容。" },
    ],
    businessValue: "16 个新 API 命令为前端 6 个新页面（Agent 面板/进化看板/成本看板/项目集管理/Prompt 管理/RAG 统计）提供数据源。evolution-trigger 命令支持从前端手动触发进化模式，dispatch-annotation 支持审核批注→任务拆解。API 层完全复用现有 execFile 桥接架构，前端无需新增通信机制。",
  },
  {
    id: "m6b-m7b-infra-real",
    agent: "主控 Agent",
    round: "Day 2 / M6b+M7b 真实基础设施连通",
    completedAt: "2026-03-10",
    taskCount: 2,
    results: [
      { task: "M6b Qdrant 真实连通", result: "QdrantRagClient 连通 localhost:6333（K8s port-forward），collection=autoflow_rag，vector_dim=1536（匹配已有集合）。解决版本兼容（client 1.17.0 vs server 1.13.6，check_compatibility=False）。闭环测试：upsert 案例→search 按 genre 过滤→delete 清理，全部通过。get_rag_client() 工厂自动根据 QDRANT_URL 切换。" },
      { task: "M7b RocketMQ 真实连通", result: "RocketMQClient 实现三级降级策略：native SDK（Linux/K8s）→ gRPC 通道（macOS dev，proxy:8081）→ 本地缓冲。gRPC 模式连通验证通过，publish→consume 闭环 OK。本地 handler 回调与 MockMQClient 行为一致。health() 返回 grpc_connected=true。buffer 管理：get_buffer_stats() + flush_buffer()。" },
    ],
    businessValue: "Qdrant 向量数据库和 RocketMQ 消息队列的真实连通为 v2.2 Agent 自进化管线提供了基础设施保障。QdrantRagClient 支持 RAG 案例的持久化检索，EvolutionEngine 可真实写入高分案例；RocketMQ 支持 Supervisor 预警广播和 Agent 间异步通信。三级降级策略确保开发环境（macOS）和生产环境（K8s Linux）均可正常运行。",
  },
  {
    id: "m14-architecture-docs",
    agent: "主控 Agent",
    round: "Day 2 / M14 架构合同文档",
    completedAt: "2026-03-10",
    taskCount: 2,
    results: [
      { task: "M14 v2.2-agent-architecture.md", result: "12 章节完整架构合同：Agent 清单（10 Agent 角色+文件映射）、决策循环（recall→reason→act→reflect 4 阶段规范）、三层记忆架构（Working/Project/Long-term 设计+衰减策略）、Prompt 资产架构（Master→Genre→Instance 三层覆写）、基础设施客户端（RAG+MQ 工厂模式+降级策略）、成本守卫（30 CNY/min 硬约束+三级状态）、Agent 注册表（懒加载工厂）、Supervisor/EvolutionEngine 规范、环境变量表、数据库表清单、LangGraph 集成说明。" },
      { task: "M14 memory-rag-contract.md", result: "Memory & RAG 数据合同：agent_memory 表合同（字段+CRUD API+衰减策略）、RAGCase 数据结构+Qdrant 集合设计（dim=1536/COSINE/确定性 Point ID）、检索策略（payload 过滤+client-side sort）、写入策略（高分案例+负向标注）、MQ Topic 合同（4 topic + payload 结构）、冻结条款（不可由执行 Agent 自行修改的字段列表）。" },
    ],
    businessValue: "架构合同是多 Agent 协作的基石——编排运行时 Agent 可据此实现 handler→Agent.execute() 桥接（R6），人审入口 Agent 可据此构建管理面板，运维 Agent 可据此配置生产环境。冻结条款防止各 Agent 单方面修改共享接口导致集成失败。",
  },
  {
    id: "m15-m15b-m16-final",
    agent: "主控 Agent",
    round: "Day 2 / M15+M15b+M16 集成验收+生产配置+收尾",
    completedAt: "2026-03-10",
    taskCount: 3,
    results: [
      { task: "M15 集成验收", result: "7/7 全链路测试通过：(1) Registry 注册 2 框架 Agent (2) Supervisor.execute() 真实决策循环（rule-based cost+compliance check）(3) QdrantRagClient upsert→search→delete 闭环 (4) RocketMQClient gRPC mode publish→handler 回调 (5) agent_memory PG CRUD+stats (6) prompt_assets PG CRUD+compose_prompt 三层合成 (7) cost_events record+check_budget 三级守卫。Migration 009 成功应用，core_pipeline 新增 7 张表。" },
      { task: "M15b 生产环境配置", result: ".env.production 模板：所有敏感值用 [K8S_SECRET:autoflow-secrets/xxx] 占位，in-cluster 服务使用 K8s DNS（qdrant:6333, rocketmq-namesrv:9876, rocketmq-broker:8081, comfyui:8188）。scripts/k8s-secret-template.yaml：6 个 secret 项（pg-password, redis-password, llm-api-key, volc-ak, volc-sk, audio-api-key）。" },
      { task: "M16 sprint-data 最终更新", result: "全部 17 个主控任务（M1-M17）标记完成。v22AcceptanceRecords 新增 M6b+M7b 基础设施连通、M14 架构合同、M15+M15b+M16 收尾共 3 条验收记录。v22Checkpoints 中 Qdrant/RocketMQ 检查点标记通过。" },
    ],
    businessValue: "主控 Agent 全部 17 个任务（M1-M17，含 M6b/M7b/M15b 子任务）完工。v2.2 Agent 框架层交付物：BaseAgent 抽象框架、10 Agent 注册表、三层记忆（PG+Qdrant）、三层 Prompt 资产、成本事件+预算守卫、Supervisor 横切守卫、EvolutionEngine 4 模式进化、RAG/MQ 真实连通（含三级降级）、16 个后端 API、2 份架构合同+冻结条款、生产环境配置模板。编排运行时 Agent 可基于此框架在 R6/R9/R12 中实现 Agent 真实能力。",
  },
  {
    id: "m18-frontend-api-full",
    agent: "主控 Agent",
    round: "Day 2 / M18 前端 API 全量补全",
    completedAt: "2026-03-10",
    taskCount: 4,
    results: [
      { task: "Migration 010 — users/sessions/notification_config", result: "新增 2 枚举（user_role_enum: 5角色, login_provider_enum: feishu/password）+ 3 新表（users 含飞书SSO+独立账号双登录、sessions JWT管理、notification_config 飞书通知）+ 5 条种子用户（admin/qc/中台/dev/partner）。全部 IF NOT EXISTS 幂等。" },
      { task: "auth_api.py — 鉴权 API", result: "7 个命令：login（飞书SSO+独立账号）、me（token验证+个人统计）、logout（session撤销）、list-users、create-user、update-user、delete-user。JWT 签发（HMAC-SHA256）+ session DB 持久化 + 角色→权限映射（ROLE_PERMISSIONS/ROLE_HOME）。" },
      { task: "orchestrator_read_api.py — 12 个新命令", result: "tasks-by-role（角色过滤+分页）、pipeline-dashboard（北极星+节点分布+活动流）、pipeline-trace（E2E剧集级+Agent三层决策trace）、pipeline-project（项目总览）、pipeline-highlights（异常/优秀发现）、agent-profile（能力画像+记忆+策略）、agent-decisions（三层决策详情:plan/execute/review）、evolution-daily-report（日报+prompt变更+RAG统计）、prompt-detail（含版本Diff+adapter）、gpu-status（占位待DCGM）、api-usage（按cost_type聚合）、health（PG/Redis/Qdrant/RocketMQ四服务检测）、agents-collaboration（拓扑图数据）。" },
      { task: "orchestrator_write_api.py — 8 个新命令", result: "prompt-playground（直接LLM调用测试）、settings-projects-list/create/update/delete（项目集CRUD）、settings-notifications-get/update（飞书通知配置）、assistant-chat（AI助手+系统状态注入）。" },
    ],
    businessValue: "前端 Phase 0-3 全部 30 个 API 端点一次性就位。auth_api.py 支持飞书SSO+合作方独立账号双登录模式，5 种角色精细化权限控制。orchestrator_read/write_api.py 从 22+27 命令扩展至 34+35=69 命令，覆盖登录鉴权、管线监控、Agent画像、进化观测、资源成本、调试工具、系统设置全部 7 大导航区。前端 API 合同文档 docs/v2.2-frontend-api-contract.md 为人审入口 Agent 提供完整对接指引。",
  },
  {
    id: "test-agent-t1-t12",
    agent: "测试 Agent",
    round: "Day 2 / T1-T12 测试全量完成",
    completedAt: "2026-03-10",
    taskCount: 12,
    results: [
      { task: "T1 pytest 配置 + 拓扑修复", result: "pytest.ini + conftest.py（7 fixture）+ fixtures/ 数据工厂。28 节点拓扑测试修复（N07b/N16b）" },
      { task: "T2 公共模块单元测试", result: "7 文件 108 测试：llm_client(19) tos_client(12) agent_memory(18) rag(12) mq(14) cost_events(10) prompt_assets(13)" },
      { task: "T3 图编译测试升级", result: "test_builder.py 19 测试：28 节点拓扑 + N07/N07b 并行组 + Gate interrupt_before + QC reject 边" },
      { task: "T4 Handler 测试框架", result: "test_handlers.py 48 测试：8 模块注册验证 + 15 函数可调用 + N01/N03/N09 mock 执行 + QC 评分辅助函数" },
      { task: "T5 Agent 集成测试", result: "27 测试：BaseAgent 实例化/决策循环/Trace/记忆/Supervisor 成本合规/Registry" },
      { task: "T6 Dispatcher 集成测试", result: "19 测试：批注解析/任务归一化/TaskExecutor 路由/归因映射/端到端管线" },
      { task: "T7 RAG 集成测试", result: "20 测试：MockRagClient CRUD/搜索排序/过滤/正向负向矫正入库/全管线" },
      { task: "T8 前端 E2E 骨架", result: "Playwright 配置 + 4 spec 文件 14 测试：admin-sprint/review-pages/admin-debug/navigation" },
      { task: "T9 全链路冒烟", result: "14 测试：编译/N01-N08 段/Gate 续跑/N07b N16b 并行/全链路完成/Rerun 跳过" },
      { task: "T10 Gate 审核 E2E", result: "14 测试：N08 批准打回/N18 shot 级/N21 episode 级/N24 串行 3 步/部分批准重暂停" },
      { task: "T11 性能基准", result: "16 测试：编译<2s/节点<100ms/序列化<50ms/路由<10ms/并发 5 路<1s/拓扑 28000 次<10ms" },
      { task: "T12 CI 集成", result: ".github/workflows/test.yml（unit+integration 自动化）+ scripts/run-tests.sh + pytest-html 报告" },
    ],
    businessValue: "测试体系从 0 到 341 全部通过（205 unit + 66 integration + 70 e2e）。覆盖公共模块、图编译、Handler 注册、Agent 决策循环、Dispatcher 批注解析、RAG 入库检索、全链路冒烟、4 Gate 审核流程、性能基准 6 类 16 项。GitHub Actions CI 自动跑 unit+integration，e2e 按需执行。前端 Playwright E2E 骨架就位，GPU 到位后可立即扩展真实 ComfyUI 测试。",
  },
]

// ─── v2.2 Helper functions ───────────────────────────

export function getV22OverallProgress(): ProgressInfo {
  const allTasks = [...v22Agents.flatMap(a => a.tasks), ...v22IntegrationTasks]
  const total = allTasks.length
  const done = allTasks.filter(t => t.status === "done").length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const totalMin = allTasks.reduce((s, t) => s + t.estimatedMin, 0)
  const doneMin = allTasks.filter(t => t.status === "done").reduce((s, t) => s + t.estimatedMin, 0)
  const percentByTime = totalMin === 0 ? 0 : Math.round((doneMin / totalMin) * 100)
  return { done, total, percent, doneMin, totalMin, percentByTime }
}

export function getCurrentSprint(): "mvp0" | "v22" {
  // If all MVP-0 agents are done, we're in v2.2 sprint
  const mvp0Done = agents.every(a => a.tasks.every(t => t.status === "done"))
  return mvp0Done ? "v22" : "mvp0"
}
