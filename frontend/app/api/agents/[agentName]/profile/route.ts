export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { runPythonReadApi } from "@/lib/python-read-api"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ agentName: string }> }
) {
  const { agentName } = await context.params

  const mock = buildMockProfile(agentName)

  try {
    const result = await runPythonReadApi("agent-profile", [agentName])
    // Merge: use mock as base, overlay real data where present
    if (result && typeof result === "object" && !result.error) {
      return NextResponse.json({ ...mock, ...result, display_name: mock.display_name, description: mock.description, role: mock.role, category: mock.category, responsible_nodes: mock.responsible_nodes, primary_model: mock.primary_model, stats: { ...mock.stats, ...(result.stats || {}) }, capabilities: mock.capabilities, current_strategy: mock.current_strategy, memories: (result.memories && result.memories.length > 0) ? result.memories : mock.memories, recent_decisions: (result.recent_decisions && result.recent_decisions.length > 0) ? result.recent_decisions : mock.recent_decisions, today_summary: mock.today_summary, model_routing: mock.model_routing })
    }
  } catch {
    // Python bridge unavailable
  }

  return NextResponse.json(mock)
}

const AGENT_META: Record<string, { display_name: string; description: string; role: string; responsible_nodes: string[]; category: string; primary_model: string }> = {
  script_analyst: { display_name: "Script Analyst", description: "剧本深度解析，提取角色、场景、情绪、镜头暗示", role: "剧本解析", responsible_nodes: ["N01"], category: "production", primary_model: "Gemini 3.1" },
  shot_designer: { display_name: "Shot Designer", description: "全集分镜设计——景别/难度/质检层级分配，节奏把控", role: "分镜设计", responsible_nodes: ["N02", "N04", "N05", "N16", "N16b"], category: "production", primary_model: "Gemini 3.1" },
  visual_director: { display_name: "Visual Director", description: "视觉策划+prompt工程+关键帧/视频生成全链路", role: "视觉生成", responsible_nodes: ["N06", "N07", "N09", "N10", "N13", "N14", "N17", "N19"], category: "production", primary_model: "FLUX.2 / LTX-2.3" },
  audio_director: { display_name: "Audio Director", description: "音色生成+配音+视听整合全链路", role: "音频生成", responsible_nodes: ["N07b", "N20", "N22"], category: "production", primary_model: "CosyVoice 2" },
  quality_inspector: { display_name: "Quality Inspector", description: "多维度质量检测——构图/色彩/连续性/节奏/合规", role: "质量检测", responsible_nodes: ["N03", "N11", "N12", "N15"], category: "production", primary_model: "Gemini 3.1" },
  compositor: { display_name: "Compositor", description: "成片合成——字幕烧录/色彩校正/多轨混音/封装输出", role: "成片合成", responsible_nodes: ["N23", "N25", "N26"], category: "production", primary_model: "FFmpeg" },
  review_dispatcher: { display_name: "Review Dispatcher", description: "审核任务调度——Gate节点创建审核任务/分配审核人/收集结果", role: "审核调度", responsible_nodes: ["N08", "N18", "N21", "N24"], category: "production", primary_model: "N/A" },
  supervisor: { display_name: "Supervisor", description: "横切守卫——成本校验/合规检查/异常拦截/质量兜底", role: "横切守卫", responsible_nodes: [], category: "supervisor", primary_model: "Gemini 3.1" },
  evolution_engine: { display_name: "Evolution Engine", description: "自进化引擎——4模式(持续入库/定期蒸馏/A-B测试/LoRA微调)驱动全系统能力提升", role: "自进化引擎", responsible_nodes: [], category: "evolution", primary_model: "Gemini 3.1" },
}

function buildMockProfile(agentName: string) {
  const meta = AGENT_META[agentName] || { display_name: agentName, description: "Unknown agent", role: "unknown", responsible_nodes: [], category: "production", primary_model: "N/A" }

  // Generate 30-day trend data
  const now = new Date()
  const qualityTrend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (29 - i))
    return { date: d.toISOString().slice(0, 10), score: +(7.8 + Math.random() * 1.5 + i * 0.02).toFixed(1) }
  })
  const speedTrend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (29 - i))
    return { date: d.toISOString().slice(0, 10), avg_sec: +(5 + Math.random() * 10).toFixed(1) }
  })
  const costTrend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (29 - i))
    return { date: d.toISOString().slice(0, 10), cost_cny: +(0.5 + Math.random() * 3).toFixed(2) }
  })

  return {
    agent_name: agentName,
    display_name: meta.display_name,
    description: meta.description,
    role: meta.role,
    category: meta.category,
    responsible_nodes: meta.responsible_nodes,
    primary_model: meta.primary_model,
    status: "idle",
    health: "healthy",
    current_task: agentName === "visual_director" ? "万斯家第8集 N14 分镜15-20" : null,
    stats: {
      total_tasks: Math.floor(Math.random() * 500) + 50,
      completed_tasks: Math.floor(Math.random() * 450) + 40,
      failed_tasks: Math.floor(Math.random() * 5),
      avg_quality_score: +(8.0 + Math.random() * 1.2).toFixed(1),
      total_cost_cny: +(Math.random() * 50).toFixed(2),
      avg_duration_sec: +(2 + Math.random() * 15).toFixed(1),
      success_rate: +(0.9 + Math.random() * 0.1).toFixed(3),
      return_rate: +(Math.random() * 0.15).toFixed(3),
    },
    capabilities: { quality_trend: qualityTrend, speed_trend: speedTrend, cost_trend: costTrend },
    current_strategy: {
      active_prompt_version: `${agentName}_master_v3`,
      genre_adapters: [
        { genre: "古装宫廷", adapter_id: "ancient_costume_v2", status: "stable" },
        { genre: "现代都市", adapter_id: "modern_urban_v1", status: "warning" },
        { genre: "悬疑", adapter_id: "mystery_dark_v1", status: "stable" },
        { genre: "言情", adapter_id: "romance_warm_v1", status: "stable" },
      ],
      rag_case_count: 3420,
      rag_positive_count: 2890,
      rag_negative_count: 530,
      rag_hit_rate: 0.78,
      rag_weekly_new: 45,
      ab_tests: [{ name: "ancient_night_variant", progress: "15/30", status: "running" }],
    },
    memories: [
      { project: "万斯家的回响", items: ["太后角色 ip_adapter 最佳值 0.78", "本剧夜景需加暖光约束", "男主远景不需要 FireRed 高保真", "宫殿走廊场景需要专用prompt"] },
      { project: "星辰海", items: ["现代办公室场景窗光方向需固定", "女主金发用seed偏移+200效果更好"] },
    ],
    model_routing: agentName === "visual_director" ? [
      { stage: "策划(N06)", primary: "Gemini 3.1", fallback: "Claude Opus 4.6" },
      { stage: "生图(N07)", primary: "FLUX.2 Dev + FireRed 1.1", fallback: null },
      { stage: "关键帧(N10)", primary: "FLUX.2 Dev + FireRed", fallback: null },
      { stage: "视频(N14)", primary: "LTX-2.3 FP8", fallback: "HuMo(S2条件)" },
      { stage: "超分(N17)", primary: "RealESRGAN", fallback: null },
    ] : [],
    recent_decisions: [
      { node_run_id: "nr-001", episode_title: "万斯家第3集", node_id: "N06", decision_summary: "全集策划: 5场景·4角色·预算¥9.0", quality_score: 8.8, timestamp: new Date(Date.now() - 3600000).toISOString() },
      { node_run_id: "nr-002", episode_title: "万斯家第3集", node_id: "N14", decision_summary: "批量执行: 32镜头·6min42s·¥8.2·重试3次(密室场景)", quality_score: 8.6, timestamp: new Date(Date.now() - 7200000).toISOString() },
      { node_run_id: "nr-003", episode_title: "万斯家第2集", node_id: "N10", decision_summary: "关键帧生成: 28镜头·一次通过率94%", quality_score: 9.1, timestamp: new Date(Date.now() - 86400000).toISOString() },
    ],
    today_summary: "1. 古装宫殿夜景镜头中，加烛光约束的prompt评分平均高出0.8分。建议将此约束正式纳入ancient_costume适配器。\n2. 现代都市场景构图评分偏低（均值7.8，其他场景8.5+），可能原因：现代场景RAG案例仅120条（古装820条）。建议优先为现代场景积累更多positive案例。\n3. ip_adapter_scale=0.78对太后角色效果稳定(均值FaceID 0.91)，但对男主效果一般(0.83)，可能需要针对男主单独调参。",
  }
}
