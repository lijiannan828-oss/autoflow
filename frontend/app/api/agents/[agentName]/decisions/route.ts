export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { runPythonReadApi } from "@/lib/python-read-api"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ agentName: string }> }
) {
  const { agentName } = await context.params
  const { searchParams } = new URL(request.url)
  const limit = searchParams.get("limit") || "20"

  try {
    const result = await runPythonReadApi("agent-decisions", [agentName, limit])
    if (result?.decisions && result.decisions.length > 0) {
      return NextResponse.json(result)
    }
  } catch {
    // Python bridge unavailable
  }

  return NextResponse.json(buildMockDecisions(agentName))
}

function buildMockDecisions(agentName: string) {
  const now = Date.now()
  const decisions = [
    {
      trace_group_id: "run-001:N06",
      episode_title: "万斯家第3集",
      node_id: "N06",
      timestamp: new Date(now - 3600000).toISOString(),
      decision_type: "planning",
      steps: [
        { step: "observe", content: "读取剧本第3集内容: 5场景(宫殿夜宴/花园密谈/密室/书房/城楼), 4角色, 32镜头", tokens_used: 1200, duration_ms: 800 },
        { step: "retrieve", content: "RAG检索: 宫殿夜景命中9.3分案例 / 密室场景⚠️无匹配案例(最近仅80条)", tokens_used: 500, duration_ms: 1200 },
        { step: "reason", content: "策略决策: palace_night_v3(24镜)+garden_v2(4镜)+indoor_dark_v1(4镜), 预算预估¥9.0", tokens_used: 2000, duration_ms: 1500 },
        { step: "act", content: "生成全集分镜策划表: 32条prompt + 景别分配 + ip_adapter参数", tokens_used: 3500, duration_ms: 2000 },
        { step: "reflect", content: "自检: 景别分布合理✅ 预算在红线内✅ ⚠️密室场景无RAG参考, 已标记需人工关注", tokens_used: 800, duration_ms: 600 },
      ],
      outcome: { quality_score: 8.8, status: "completed" },
    },
    {
      trace_group_id: "run-001:N14",
      episode_title: "万斯家第3集",
      node_id: "N14",
      timestamp: new Date(now - 7200000).toISOString(),
      decision_type: "execution",
      steps: [
        { step: "observe", content: "接收32镜头视频生成任务, 模型LTX-2.3 FP8, 预计耗时6-8min", tokens_used: 800, duration_ms: 500 },
        { step: "retrieve", content: "加载ip_adapter权重: 太后0.78/男主0.72/侍女0.65", tokens_used: 200, duration_ms: 300 },
        { step: "act", content: "批量执行: 32镜头并行生成, 完成30/32, 重试3次(#28-30密室镜头)", tokens_used: 0, duration_ms: 402000 },
        { step: "reflect", content: "密室indoor_dark_v1效果差(均值7.0), 已写入记忆并上报Evolution Engine", tokens_used: 600, duration_ms: 400 },
      ],
      outcome: { quality_score: 8.6, status: "completed" },
    },
    {
      trace_group_id: "run-002:N12",
      episode_title: "万斯家第3集",
      node_id: "N12",
      timestamp: new Date(now - 10800000).toISOString(),
      decision_type: "review",
      steps: [
        { step: "observe", content: "连续性复盘: 32镜头序列, 检查色温/构图/角色一致性", tokens_used: 4000, duration_ms: 3000 },
        { step: "reason", content: "发现: #8→#9色温跳变(ΔE=12) / 男主远景FaceID偏低(0.78) / 密室整体偏暗", tokens_used: 2000, duration_ms: 1500 },
        { step: "reflect", content: "亮点: 高潮段(#10-#14)连续性9.5⭐ / 总体连续性评分8.2", tokens_used: 1000, duration_ms: 800 },
      ],
      outcome: { quality_score: 8.2, status: "completed" },
    },
    {
      trace_group_id: "run-003:N10",
      episode_title: "万斯家第2集",
      node_id: "N10",
      timestamp: new Date(now - 86400000).toISOString(),
      decision_type: "execution",
      steps: [
        { step: "observe", content: "关键帧生成任务: 28镜头, 模型FLUX.2 Dev + FireRed 1.1", tokens_used: 600, duration_ms: 400 },
        { step: "act", content: "批量执行: 28镜头完成, 一次通过率94%, 重试2次", tokens_used: 0, duration_ms: 240000 },
        { step: "reflect", content: "质量稳定, 古装场景评分9.1, 无异常", tokens_used: 400, duration_ms: 300 },
      ],
      outcome: { quality_score: 9.1, status: "completed" },
    },
  ]

  return { decisions: agentName === "visual_director" ? decisions : decisions.slice(0, 2) }
}
