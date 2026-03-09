export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { runPythonReadApi } from "@/lib/python-read-api"

export async function GET() {
  try {
    const result = await runPythonReadApi("get-agent-status")
    if (result?.agents && result.agents.length > 0) {
      return NextResponse.json(result)
    }
  } catch {
    // Python bridge unavailable
  }

  return NextResponse.json({ agents: MOCK_AGENTS })
}

const MOCK_AGENTS = [
  { agent_name: "script_analyst", display_name: "Script Analyst", role: "剧本解析", category: "production", responsible_nodes: ["N01"], status: "idle", health: "healthy", stats: { total_tasks: 45, success_rate: 0.98, avg_quality_score: 9.1, total_cost_cny: 1.2, avg_duration_sec: 3.2 }, last_active_at: new Date().toISOString() },
  { agent_name: "shot_designer", display_name: "Shot Designer", role: "分镜设计", category: "production", responsible_nodes: ["N02", "N04", "N05", "N16", "N16b"], status: "working", health: "healthy", stats: { total_tasks: 320, success_rate: 0.95, avg_quality_score: 8.8, total_cost_cny: 8.5, avg_duration_sec: 5.1 }, last_active_at: new Date().toISOString() },
  { agent_name: "visual_director", display_name: "Visual Director", role: "视觉生成", category: "production", responsible_nodes: ["N06", "N07", "N09", "N10", "N13", "N14", "N17", "N19"], status: "working", health: "busy", stats: { total_tasks: 280, success_rate: 0.92, avg_quality_score: 8.6, total_cost_cny: 42.1, avg_duration_sec: 12.3 }, last_active_at: new Date().toISOString() },
  { agent_name: "audio_director", display_name: "Audio Director", role: "音频生成", category: "production", responsible_nodes: ["N07b", "N20", "N22"], status: "idle", health: "healthy", stats: { total_tasks: 45, success_rate: 0.96, avg_quality_score: 8.9, total_cost_cny: 6.3, avg_duration_sec: 8.7 }, last_active_at: new Date().toISOString() },
  { agent_name: "quality_inspector", display_name: "Quality Inspector", role: "质量检测", category: "production", responsible_nodes: ["N03", "N11", "N12", "N15"], status: "working", health: "healthy", stats: { total_tasks: 620, success_rate: 0.99, avg_quality_score: 8.7, total_cost_cny: 3.8, avg_duration_sec: 2.1 }, last_active_at: new Date().toISOString() },
  { agent_name: "compositor", display_name: "Compositor", role: "成片合成", category: "production", responsible_nodes: ["N23", "N25", "N26"], status: "idle", health: "healthy", stats: { total_tasks: 45, success_rate: 1.0, avg_quality_score: null, total_cost_cny: 0.5, avg_duration_sec: 15.2 }, last_active_at: new Date().toISOString() },
  { agent_name: "review_dispatcher", display_name: "Review Dispatcher", role: "审核调度", category: "production", responsible_nodes: ["N08", "N18", "N21", "N24"], status: "idle", health: "healthy", stats: { total_tasks: 12, success_rate: 1.0, avg_quality_score: null, total_cost_cny: 0.3, avg_duration_sec: 1.5 }, last_active_at: new Date().toISOString() },
  { agent_name: "supervisor", display_name: "Supervisor", role: "横切守卫", category: "supervisor", responsible_nodes: [], status: "working", health: "healthy", stats: { total_tasks: 156, success_rate: 1.0, avg_quality_score: null, total_cost_cny: 0.8, avg_duration_sec: 0.5 }, supervisor_stats: { checks_today: 156, blocks_today: 3 }, last_active_at: new Date().toISOString() },
  { agent_name: "evolution_engine", display_name: "Evolution Engine", role: "自进化引擎", category: "evolution", responsible_nodes: [], status: "idle", health: "healthy", stats: { total_tasks: 8, success_rate: 1.0, avg_quality_score: null, total_cost_cny: 2.1, avg_duration_sec: 45.0 }, evolution_stats: { current_mode: "持续入库", weekly_evolutions: 2, rag_new_cases_today: 45 }, last_active_at: new Date().toISOString() },
]
