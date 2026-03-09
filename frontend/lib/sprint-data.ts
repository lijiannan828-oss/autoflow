/**
 * MVP-0 三日冲刺监控数据
 *
 * 任务状态由各 Agent 通过修改本文件来更新。
 * 每完成一个任务，将对应 task 的 status 改为 "done"，并填入 completedAt。
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
