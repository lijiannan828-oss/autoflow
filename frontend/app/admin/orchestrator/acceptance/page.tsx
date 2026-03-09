"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { AdminNavSidebar } from "@/components/admin/admin-nav-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NODE_LABELS, orchestratorAcceptanceScenarios } from "@/lib/orchestrator-acceptance-mock"
import {
  getEquivalentCompletedHours,
  roadmapTasks,
  type RoadmapMilestone,
  type RoadmapTask,
  type RoadmapTaskStatus,
} from "@/lib/orchestrator-roadmap-progress"
import type {
  AcceptanceApiResponse,
  AcceptanceTaskTab,
  ModelJob,
  NorthStarSummary,
  NodeRun,
  OrchestratorAcceptanceScenario,
  ReturnTicket,
  ReviewTaskStatus,
  Run,
} from "@/lib/orchestrator-contract-types"

function getStatusTone(status: string) {
  switch (status) {
    case "running":
    case "in_progress":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    case "succeeded":
    case "approved":
    case "resolved":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300"
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    case "returned":
    case "failed":
    case "auto_rejected":
    case "wontfix":
      return "border-red-500/30 bg-red-500/10 text-red-300"
    case "retrying":
    case "partial":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300"
    case "skipped":
    case "canceled":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300"
    default:
      return "border-border bg-secondary/50 text-foreground"
  }
}

function formatTimestamp(value: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function sortNodeRuns(nodeRuns: NodeRun[]) {
  return [...nodeRuns].sort((a, b) => {
    const left = a.started_at ?? a.created_at
    const right = b.started_at ?? b.created_at
    return new Date(left).getTime() - new Date(right).getTime()
  })
}

function getLatestNodeRun(nodeRuns: NodeRun[], currentNodeId: string | null) {
  const currentNodeRun = nodeRuns.find((nodeRun) => nodeRun.node_id === currentNodeId)
  if (currentNodeRun) return currentNodeRun
  const sorted = sortNodeRuns(nodeRuns)
  return sorted[sorted.length - 1] ?? null
}

function getFocusRun(scenario: OrchestratorAcceptanceScenario) {
  return scenario.runs.find((run) => run.id === scenario.focus_run_id) ?? scenario.runs[0] ?? null
}

function getLatestReturnTicket(returnTickets: ReturnTicket[]) {
  return [...returnTickets].sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })[0] ?? null
}

function getNodeLabel(nodeId: string | null) {
  if (!nodeId) return "-"
  return NODE_LABELS[nodeId] ? `${nodeId} · ${NODE_LABELS[nodeId]}` : nodeId
}

function JsonPreview({ value }: { value: Record<string, unknown> | null }) {
  if (!value) {
    return <p className="text-sm text-muted-foreground">无</p>
  }

  return (
    <pre className="overflow-x-auto rounded-lg border border-border/50 bg-black/20 p-3 text-xs leading-5 text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function SummaryCard({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-0">
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function TaskLensCard({
  title,
  items,
}: {
  title: string
  items: string[] | undefined
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            {items.map((item) => (
              <div key={item} className="rounded-lg border border-border/50 p-3">
                {item}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无</p>
        )}
      </CardContent>
    </Card>
  )
}

function getSignalTone(signal: "measured" | "missing") {
  return signal === "measured"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
}

function formatMetric(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  return value.toFixed(digits)
}

function NorthStarSummaryPanel({ summary }: { summary: NorthStarSummary | null }) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>北极星指标摘要</CardTitle>
          <CardDescription>第五轮开始接入统一 truth source 与最小指标骨架。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">当前还没有可展示的真实指标摘要。</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>北极星指标摘要</CardTitle>
              <CardDescription>
                第五轮开始用统一读侧输出成本、质量、吞吐与反馈信号，而不是由页面各自拼装。
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                summary.truth_source.core_truth_ready
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }
            >
              {summary.truth_source.preferred_review_task_source}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-5">
          <SummaryCard
            title="真相源收口"
            value={summary.truth_source.core_truth_ready ? "core truth ready" : "compat fallback"}
            detail={summary.truth_source.summary}
          />
          <SummaryCard
            title="成本信号"
            value={`¥ ${formatMetric(summary.cost.total_cost_cny, 2)}`}
            detail={`avg/node_run=${formatMetric(summary.cost.avg_cost_per_node_run, 3)} · redline=${summary.cost.cost_redline_per_minute_cny}/min`}
          />
          <SummaryCard
            title="质量信号"
            value={formatMetric(summary.quality.avg_quality_score, 2)}
            detail={`coverage=${summary.quality.quality_coverage_rate ?? "-"}% · low_quality=${summary.quality.low_quality_node_runs}`}
          />
          <SummaryCard
            title="吞吐/等待"
            value={`${summary.throughput.total_runs} runs`}
            detail={`artifacts=${summary.throughput.artifact_count} · model_jobs=${summary.throughput.model_job_count}`}
          />
          <SummaryCard
            title="反馈闭环"
            value={`${summary.feedback.total_return_tickets} tickets`}
            detail={`auto_qc=${summary.feedback.auto_qc_return_tickets} · approval_rate=${summary.feedback.approval_rate ?? "-"}%`}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">成本</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant="outline" className={getSignalTone(summary.cost.signal)}>
              {summary.cost.signal}
            </Badge>
            <div className="rounded-lg border border-border/50 p-3">
              total_cost_cny: {formatMetric(summary.cost.total_cost_cny, 2)}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              total_gpu_seconds: {formatMetric(summary.cost.total_gpu_seconds, 1)}
            </div>
            <p className="text-muted-foreground">{summary.cost.note}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">质量</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant="outline" className={getSignalTone(summary.quality.signal)}>
              {summary.quality.signal}
            </Badge>
            <div className="rounded-lg border border-border/50 p-3">
              avg_quality_score: {formatMetric(summary.quality.avg_quality_score, 2)}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              scored_node_runs: {summary.quality.scored_node_runs}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              unstable_node_runs: {summary.quality.unstable_node_runs}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">吞吐</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant="outline" className={getSignalTone(summary.throughput.signal)}>
              {summary.throughput.signal}
            </Badge>
            <div className="rounded-lg border border-border/50 p-3">
              rerun_runs: {summary.throughput.rerun_runs} / active_runs: {summary.throughput.active_runs}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              artifact_count: {summary.throughput.artifact_count}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              model_job_count: {summary.throughput.model_job_count} / active_model_jobs: {summary.throughput.active_model_jobs}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              avg_node_duration_seconds: {formatMetric(summary.throughput.avg_node_duration_seconds, 1)}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              avg_review_cycle_seconds: {formatMetric(summary.throughput.avg_review_cycle_seconds, 1)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">反馈</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant="outline" className={getSignalTone(summary.feedback.signal)}>
              {summary.feedback.signal}
            </Badge>
            <div className="rounded-lg border border-border/50 p-3">
              total_review_tasks: {summary.feedback.total_review_tasks}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              open_return_tickets: {summary.feedback.open_return_tickets}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              resolved_return_tickets: {summary.feedback.resolved_return_tickets}
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              auto_qc_return_tickets: {summary.feedback.auto_qc_return_tickets}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ReviewStatusBadge({ status }: { status: ReviewTaskStatus | null }) {
  if (!status) {
    return <span className="text-muted-foreground">未创建</span>
  }

  return (
    <Badge variant="outline" className={getStatusTone(status)}>
      {status}
    </Badge>
  )
}

function RunsTable({ runs, focusRun }: { runs: Run[]; focusRun: Run | null }) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">当前场景没有真实 Run 数据。</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>run.id</TableHead>
          <TableHead>status</TableHead>
          <TableHead>episode_version_id</TableHead>
          <TableHead>current_node_id</TableHead>
          <TableHead>is_rerun</TableHead>
          <TableHead>rerun_from_ticket_id</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow
            key={run.id}
            className={run.id === focusRun?.id ? "bg-emerald-500/5" : undefined}
          >
            <TableCell className="font-medium">{run.id}</TableCell>
            <TableCell>
              <Badge variant="outline" className={getStatusTone(run.status)}>
                {run.status}
              </Badge>
            </TableCell>
            <TableCell>{run.episode_version_id}</TableCell>
            <TableCell>{run.current_node_id ?? "-"}</TableCell>
            <TableCell>{run.is_rerun ? "true" : "false"}</TableCell>
            <TableCell>{run.rerun_from_ticket_id ?? "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ScenarioPanel({ scenario }: { scenario: OrchestratorAcceptanceScenario }) {
  const focusRun = getFocusRun(scenario)
  const focusNodeRuns = sortNodeRuns(
    scenario.node_runs.filter((nodeRun) => nodeRun.run_id === focusRun?.id)
  )
  const latestNodeRun = getLatestNodeRun(focusNodeRuns, focusRun?.current_node_id ?? null)
  const activeGateItems = scenario.gate_list?.items ?? []
  const latestReturnTicket = getLatestReturnTicket(scenario.return_tickets)
  const artifacts = scenario.artifacts ?? []
  const modelJobs = (scenario.model_jobs ?? []) as ModelJob[]
  const hasGateBlock = activeGateItems.length > 0
  const hasRerunPlan = scenario.return_tickets.some(
    (ticket) => !!ticket.rerun_plan_json && Object.keys(ticket.rerun_plan_json).length > 0
  )
  const autoQcTickets = scenario.return_tickets.filter((ticket) => ticket.source_type === "auto_qc")
  const vPlusOneId =
    scenario.return_tickets.find((ticket) => ticket.resolved_version_id)?.resolved_version_id ??
    scenario.runs.find((run) => run.is_rerun)?.episode_version_id ??
    null

  return (
    <TabsContent value={scenario.id} className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-foreground">{scenario.label}</h2>
        <p className="max-w-4xl text-sm text-muted-foreground">{scenario.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Run"
          value={focusRun?.id ?? "无 Run 数据"}
          detail={
            focusRun
              ? `status=${focusRun.status} · langgraph_thread_id=${focusRun.langgraph_thread_id ?? "-"}`
              : "当前场景主要用于展示真实数据库空态、兼容层或 registry 校验结果。"
          }
        />
        <SummaryCard
          title="当前或最近节点"
          value={getNodeLabel(focusRun?.current_node_id ?? null)}
          detail={`recent_node=${getNodeLabel(latestNodeRun?.node_id ?? null)}`}
        />
        <SummaryCard
          title="Gate 状态"
          value={hasGateBlock ? "卡在 Gate" : "未卡 Gate"}
          detail={
            hasGateBlock
              ? `${activeGateItems[0]?.gate_node_id} · ${activeGateItems.length} 个 review_task 待处理`
              : "当前场景没有 pending / in_progress 的 Gate 列表项"
          }
        />
        <SummaryCard
          title="ReturnTicket / rerun / v+1"
          value={latestReturnTicket ? latestReturnTicket.id : "无 ReturnTicket"}
          detail={`rerun_plan=${hasRerunPlan ? "yes" : "no"} · v+1=${vPlusOneId ?? "no"}`}
        />
        <SummaryCard
          title="Artifacts / auto_qc"
          value={`${artifacts.length} / ${autoQcTickets.length}`}
          detail="artifact_count / auto_qc_ticket_count"
        />
        <SummaryCard
          title="Model Jobs"
          value={`${modelJobs.length}`}
          detail={modelJobs[0] ? `${modelJobs[0].status} / ${modelJobs[0].provider ?? "-"}` : "暂无 model job"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Run 列表</CardTitle>
            <CardDescription>使用冻结字段 `runs.id/status/current_node_id/is_rerun/rerun_from_ticket_id`。</CardDescription>
          </CardHeader>
          <CardContent>
            <RunsTable runs={scenario.runs} focusRun={focusRun} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最小闭环结论</CardTitle>
            <CardDescription>直接回答验收时最关心的几个问题。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <span className="text-muted-foreground">是否卡在 Gate</span>
              <Badge variant="outline" className={getStatusTone(hasGateBlock ? "pending" : "succeeded")}>
                {hasGateBlock ? "yes" : "no"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <span className="text-muted-foreground">是否产生 ReturnTicket</span>
              <Badge
                variant="outline"
                className={getStatusTone(latestReturnTicket ? latestReturnTicket.status : "skipped")}
              >
                {latestReturnTicket ? "yes" : "no"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <span className="text-muted-foreground">是否已有 rerun_plan_json</span>
              <Badge variant="outline" className={getStatusTone(hasRerunPlan ? "running" : "skipped")}>
                {hasRerunPlan ? "yes" : "no"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <span className="text-muted-foreground">是否已有 v+1</span>
              <Badge variant="outline" className={getStatusTone(vPlusOneId ? "running" : "skipped")}>
                {vPlusOneId ? "yes" : "no"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Model Jobs</CardTitle>
            <CardDescription>第七轮开始展示真实 `model_jobs` 台账，验证 submit/callback 最小执行链。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>job_id</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>provider</TableHead>
                  <TableHead>job_type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelJobs.length > 0 ? (
                  modelJobs.map((job) => (
                    <TableRow key={job.job_id}>
                      <TableCell className="max-w-56 truncate font-medium">{job.job_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusTone(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{job.provider ?? "-"}</TableCell>
                      <TableCell>{job.job_type}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      当前场景没有 model_jobs
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Model Callback</CardTitle>
            <CardDescription>快速查看最新模型任务的请求与结果快照。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">latest status / callback_url</p>
              <p className="mt-1 text-muted-foreground">
                {modelJobs[0] ? `${modelJobs[0].status} / ${modelJobs[0].callback_url ?? "-"}` : "-"}
              </p>
            </div>
            <div>
              <p className="mb-2 font-medium">request_payload</p>
              <JsonPreview value={modelJobs[0]?.request_payload ?? null} />
            </div>
            <div>
              <p className="mb-2 font-medium">result_payload / error_payload</p>
              <JsonPreview value={modelJobs[0]?.result_payload ?? modelJobs[0]?.error_payload ?? null} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Artifacts</CardTitle>
            <CardDescription>第六轮开始展示真实产物索引，用于验证 T5 的最小固化链路。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>artifact_type</TableHead>
                  <TableHead>node_run_id</TableHead>
                  <TableHead>resource_url</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artifacts.length > 0 ? (
                  artifacts.map((artifact) => (
                    <TableRow key={artifact.id}>
                      <TableCell className="font-medium">{artifact.artifact_type}</TableCell>
                      <TableCell className="max-w-48 truncate">{artifact.node_run_id ?? "-"}</TableCell>
                      <TableCell className="max-w-64 truncate">{artifact.resource_url}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      当前场景没有可展示的 artifacts
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto QC Ticket</CardTitle>
            <CardDescription>第六轮开始区分人工 return 与自动质检打回。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">auto_qc tickets</p>
              <p className="mt-1 text-muted-foreground">{autoQcTickets.length}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">latest auto_qc issue_type</p>
              <p className="mt-1 text-muted-foreground">{autoQcTickets[0]?.issue_type ?? "-"}</p>
            </div>
            <div>
              <p className="mb-2 font-medium">latest auto_qc rerun_plan_json</p>
              <JsonPreview value={autoQcTickets[0]?.rerun_plan_json ?? null} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>NodeRun 列表</CardTitle>
            <CardDescription>聚焦当前 Run 的 `node_runs`，方便查看状态、耗时、复用与错误。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>node_id</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>attempt_no</TableHead>
                  <TableHead>quality_score</TableHead>
                  <TableHead>cost_cny</TableHead>
                  <TableHead>duration_s</TableHead>
                  <TableHead>error_code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {focusNodeRuns.map((nodeRun) => (
                  <TableRow key={nodeRun.id}>
                    <TableCell className="font-medium">{getNodeLabel(nodeRun.node_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusTone(nodeRun.status)}>
                        {nodeRun.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{nodeRun.attempt_no}</TableCell>
                    <TableCell>{nodeRun.quality_score ?? "-"}</TableCell>
                    <TableCell>{nodeRun.cost_cny.toFixed(2)}</TableCell>
                    <TableCell>{nodeRun.duration_s ?? "-"}</TableCell>
                    <TableCell>{nodeRun.error_code ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>review_tasks</CardTitle>
            <CardDescription>新前端视图只基于 `review_tasks`，没有继续依赖 `stage_tasks`。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                  <TableHead>step</TableHead>
                  <TableHead>reviewer_role</TableHead>
                  <TableHead>status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenario.review_tasks.length > 0 ? (
                  scenario.review_tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.id}</TableCell>
                      <TableCell>{`${task.stage_no}.${task.review_step_no}`}</TableCell>
                      <TableCell>{task.reviewer_role}</TableCell>
                      <TableCell>
                        <ReviewStatusBadge status={task.status} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      当前场景没有活跃或历史 review_tasks
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Gate DTO 列表/详情</CardTitle>
            <CardDescription>对齐 `review_task_id` 主键和 `payload` 字段。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">gate_list.total</p>
              <p className="mt-1 text-muted-foreground">{scenario.gate_list?.total ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">gate_detail.review_task_id</p>
              <p className="mt-1 break-all text-muted-foreground">
                {scenario.gate_detail?.review_task_id ?? "-"}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">gate_detail.status / reviewer_role</p>
              <p className="mt-1 text-muted-foreground">
                {scenario.gate_detail
                  ? `${scenario.gate_detail.status} / ${scenario.gate_detail.reviewer_role}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="mb-2 font-medium">gate_detail.payload</p>
              <JsonPreview value={scenario.gate_detail?.payload ?? null} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>聚合/串行视图</CardTitle>
            <CardDescription>覆盖 Stage2 聚合和 Stage4 串行步骤查询的最小信息。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">Stage2 聚合</p>
              <p className="mt-1 text-muted-foreground">
                {scenario.stage2_summary
                  ? `approved=${scenario.stage2_summary.approved_count} · pending=${scenario.stage2_summary.pending_count} · all_approved=${scenario.stage2_summary.all_approved}`
                  : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">Stage4 串行步骤</p>
              <div className="mt-2 space-y-2">
                {scenario.stage4_summary ? (
                  scenario.stage4_summary.steps.map((step) => (
                    <div key={step.step_no} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        step_{step.step_no} / {step.reviewer_role}
                      </span>
                      <ReviewStatusBadge status={step.status} />
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">-</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ReturnTicket / rerun_plan_json</CardTitle>
            <CardDescription>检查是否已打回、是否已产生重跑规划、是否已解析到新版本。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">最新 ReturnTicket</p>
              <p className="mt-1 break-all text-muted-foreground">
                {latestReturnTicket ? latestReturnTicket.id : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium">status / resolved_version_id</p>
              <p className="mt-1 text-muted-foreground">
                {latestReturnTicket
                  ? `${latestReturnTicket.status} / ${latestReturnTicket.resolved_version_id ?? "-"}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="mb-2 font-medium">rerun_plan_json</p>
              <JsonPreview value={latestReturnTicket?.rerun_plan_json ?? null} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>时间线补充</CardTitle>
          <CardDescription>方便快速确认 Run、NodeRun、ReturnTicket 的时间顺序。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/50 p-3 text-sm">
            <p className="font-medium">run.started_at / finished_at</p>
            <p className="mt-1 text-muted-foreground">
              {formatTimestamp(focusRun?.started_at ?? null)} / {formatTimestamp(focusRun?.finished_at ?? null)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 p-3 text-sm">
            <p className="font-medium">latest node_run</p>
            <p className="mt-1 text-muted-foreground">
              {latestNodeRun
                ? `${latestNodeRun.node_id} · ${formatTimestamp(latestNodeRun.started_at)}`
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 p-3 text-sm">
            <p className="font-medium">latest return_ticket.updated_at</p>
            <p className="mt-1 text-muted-foreground">
              {formatTimestamp(latestReturnTicket?.updated_at ?? null)}
            </p>
          </div>
        </CardContent>
      </Card>

      {scenario.version_patch ? (
        <Card>
          <CardHeader>
            <CardTitle>补充读库状态</CardTitle>
            <CardDescription>用于展示第三轮新增的数据库计数、registry 校验和兼容层说明。</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonPreview value={scenario.version_patch} />
          </CardContent>
        </Card>
      ) : null}
    </TabsContent>
  )
}

function getRoadmapStatusTone(status: RoadmapTaskStatus) {
  switch (status) {
    case "done":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300"
    case "in_progress":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    case "blocked":
      return "border-red-500/30 bg-red-500/10 text-red-300"
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-300"
  }
}

function getRoadmapStatusLabel(status: RoadmapTaskStatus) {
  switch (status) {
    case "done":
      return "已完成"
    case "in_progress":
      return "进行中"
    case "blocked":
      return "阻塞"
    default:
      return "未开始"
  }
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`
}

function getRoadmapProgress(tasks: RoadmapTask[]) {
  const totalHours = tasks.reduce((sum, task) => sum + task.estimateHours, 0)
  const completedHours = tasks.reduce((sum, task) => sum + getEquivalentCompletedHours(task), 0)
  const progress = totalHours === 0 ? 0 : (completedHours / totalHours) * 100
  return { totalHours, completedHours, progress }
}

function getMilestoneTasks(milestone: RoadmapMilestone) {
  return roadmapTasks.filter((task) => task.milestone === milestone)
}

function getPhaseRows(tasks: RoadmapTask[]) {
  const phaseMap = new Map<
    string,
    {
      phase: string
      totalHours: number
      completedHours: number
      activeCount: number
    }
  >()

  for (const task of tasks) {
    const current = phaseMap.get(task.phase) ?? {
      phase: task.phase,
      totalHours: 0,
      completedHours: 0,
      activeCount: 0,
    }
    current.totalHours += task.estimateHours
    current.completedHours += getEquivalentCompletedHours(task)
    if (task.status === "in_progress") current.activeCount += 1
    phaseMap.set(task.phase, current)
  }

  return [...phaseMap.values()]
    .map((row) => ({
      ...row,
      progress: row.totalHours === 0 ? 0 : (row.completedHours / row.totalHours) * 100,
    }))
    .sort((left, right) => right.totalHours - left.totalHours)
}

function RoadmapSummaryCard({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-0">
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function PhaseProgressCard({
  title,
  tasks,
}: {
  title: string
  tasks: RoadmapTask[]
}) {
  const rows = getPhaseRows(tasks)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>按估算开发工时折算，不按任务数量平均。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.phase} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{row.phase}</p>
                <p className="text-muted-foreground">
                  {formatHours(row.completedHours)} / {formatHours(row.totalHours)} · 活跃任务 {row.activeCount}
                </p>
              </div>
              <span className="text-sm font-medium">{row.progress.toFixed(1)}%</span>
            </div>
            <Progress value={row.progress} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TaskRoadmapTable({ tasks }: { tasks: RoadmapTask[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>任务进度明细</CardTitle>
        <CardDescription>每个任务展示估算工时、当前完成度与等效已完成工时。</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>阶段</TableHead>
              <TableHead>估算工时</TableHead>
              <TableHead>完成度</TableHead>
              <TableHead>折算已完成</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="align-top">
                  <div className="space-y-1">
                    <p className="font-medium">{task.id}</p>
                    <p className="text-sm text-muted-foreground">{task.title}</p>
                    <p className="max-w-xl text-xs text-muted-foreground">{task.summary}</p>
                  </div>
                </TableCell>
                <TableCell className="align-top">{task.phase}</TableCell>
                <TableCell className="align-top">{formatHours(task.estimateHours)}</TableCell>
                <TableCell className="align-top">
                  <div className="min-w-40 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{task.completionPercent}%</span>
                    </div>
                    <Progress value={task.completionPercent} />
                  </div>
                </TableCell>
                <TableCell className="align-top">{formatHours(getEquivalentCompletedHours(task))}</TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline" className={getRoadmapStatusTone(task.status)}>
                    {getRoadmapStatusLabel(task.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function getTaskTabSourceTone(source: AcceptanceTaskTab["source"]) {
  switch (source) {
    case "real-write":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    case "real-db":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300"
    case "real-db-compat":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300"
    case "real-read":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    case "fallback-mock":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-300"
  }
}

function getTaskTabSourceLabel(source: AcceptanceTaskTab["source"]) {
  switch (source) {
    case "real-write":
      return "真实写侧"
    case "real-db":
      return "真实数据库"
    case "real-db-compat":
      return "真实库兼容层"
    case "real-read":
      return "真实读取"
    case "fallback-mock":
      return "回退 mock"
    default:
      return "契约 mock"
  }
}

function OverallRoadmapPanel({
  overall,
  mvp0,
  mvp1,
  mvp0Tasks,
  mvp1Tasks,
  activeTasks,
}: {
  overall: ReturnType<typeof getRoadmapProgress>
  mvp0: ReturnType<typeof getRoadmapProgress>
  mvp1: ReturnType<typeof getRoadmapProgress>
  mvp0Tasks: RoadmapTask[]
  mvp1Tasks: RoadmapTask[]
  activeTasks: RoadmapTask[]
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>总开发进度</CardTitle>
          <CardDescription>
            当前进度按“估算开发工时 * 当前完成度”折算，不按完成任务数量平均。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RoadmapSummaryCard
              title="全任务加权进度"
              value={`${overall.progress.toFixed(1)}%`}
              detail={`${formatHours(overall.completedHours)} / ${formatHours(overall.totalHours)} 等效已完成`}
            />
            <RoadmapSummaryCard
              title="MVP-0"
              value={`${mvp0.progress.toFixed(1)}%`}
              detail={`${formatHours(mvp0.completedHours)} / ${formatHours(mvp0.totalHours)} · 当前主线`}
            />
            <RoadmapSummaryCard
              title="MVP-1"
              value={`${mvp1.progress.toFixed(1)}%`}
              detail={`${formatHours(mvp1.completedHours)} / ${formatHours(mvp1.totalHours)} · 后置运营与稳定性`}
            />
            <RoadmapSummaryCard
              title="当前活跃任务"
              value={`${activeTasks.length}`}
              detail={activeTasks.map((task) => task.id).join(" / ")}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">全任务加权进度条</span>
              <span className="font-medium">{overall.progress.toFixed(1)}%</span>
            </div>
            <Progress value={overall.progress} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <PhaseProgressCard title="MVP-0 分阶段进度" tasks={mvp0Tasks} />
        <PhaseProgressCard title="MVP-1 分阶段进度" tasks={mvp1Tasks} />
      </div>

      <TaskRoadmapTable tasks={roadmapTasks} />
    </div>
  )
}

function TaskAcceptancePanel({
  taskTabs,
  isLoading,
  errorMessage,
}: {
  taskTabs: AcceptanceTaskTab[]
  isLoading: boolean
  errorMessage: string | null
}) {
  return (
    <Tabs defaultValue={taskTabs[0]?.id} className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">本轮任务验收</h2>
          <p className="text-sm text-muted-foreground">
            总体页保持不动，独立任务验收通过 Tab 查看，不覆盖整体进度页。
          </p>
        </div>
        {isLoading ? (
          <div className="rounded-lg border border-border/50 p-3 text-sm text-muted-foreground">
            正在拉取最新真实数据库读侧结果，若失败将继续展示回退 mock。
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            动态读侧暂不可用：{errorMessage}
          </div>
        ) : null}
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          {taskTabs.map((taskTab) => (
            <TabsTrigger
              key={taskTab.id}
              value={taskTab.id}
              className="h-auto rounded-lg border border-border/60 px-4 py-2 data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/10"
            >
              {taskTab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {taskTabs.map((taskTab) => (
        <TabsContent key={taskTab.id} value={taskTab.id} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{taskTab.label}</CardTitle>
                  <CardDescription>{taskTab.description}</CardDescription>
                </div>
                <Badge variant="outline" className={getTaskTabSourceTone(taskTab.source)}>
                  {getTaskTabSourceLabel(taskTab.source)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {taskTab.generated_at && (
                <div className="rounded-lg border border-border/50 p-3 text-sm text-muted-foreground">
                  数据生成时间：{formatTimestamp(taskTab.generated_at)}
                </div>
              )}

              <div className="grid gap-6 xl:grid-cols-3">
                <TaskLensCard title="技术视角：本轮交付" items={taskTab.technical_outcomes} />
                <TaskLensCard title="业务视角：本轮推进" items={taskTab.business_outcomes} />
                <TaskLensCard title="CTO 视角：离目标还差" items={taskTab.remaining_gaps} />
              </div>

              {taskTab.scenarios.length > 0 ? (
                <Tabs defaultValue={taskTab.scenarios[0]?.id} className="space-y-6">
                  <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                    {taskTab.scenarios.map((scenario) => (
                      <TabsTrigger
                        key={scenario.id}
                        value={scenario.id}
                        className="h-auto rounded-lg border border-border/60 px-4 py-2 data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/10"
                      >
                        {scenario.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {taskTab.scenarios.map((scenario) => (
                    <ScenarioPanel key={scenario.id} scenario={scenario} />
                  ))}
                </Tabs>
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  当前任务 Tab 暂无可展示场景，通常表示真实读取失败且未生成回退场景。
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  )
}

export default function OrchestratorAcceptancePage() {
  const overall = getRoadmapProgress(roadmapTasks)
  const mvp0Tasks = getMilestoneTasks("MVP-0")
  const mvp1Tasks = getMilestoneTasks("MVP-1")
  const mvp0 = getRoadmapProgress(mvp0Tasks)
  const mvp1 = getRoadmapProgress(mvp1Tasks)
  const activeTasks = roadmapTasks.filter((task) => task.status === "in_progress")
  const [dynamicTaskTabs, setDynamicTaskTabs] = useState<AcceptanceTaskTab[]>([])
  const [northStarSummary, setNorthStarSummary] = useState<NorthStarSummary | null>(null)
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null)
  const [isAcceptanceLoading, setIsAcceptanceLoading] = useState(true)

  const taskTabs = useMemo<AcceptanceTaskTab[]>(() => {
    const roundOneTab: AcceptanceTaskTab = {
      id: "round-2026-03-07-first",
      label: "2026-03-07 首轮任务",
      description: "查看首轮多 Agent 任务的契约基线与场景验收。",
      source: "mock",
      technical_outcomes: [
        "多 Agent 共享合同、文件边界和任务目录制度首次冻结。",
        "最小编排验收页与按工时折算的总体进度页首次落地。",
        "backend/orchestrator 与 backend/rerun 的最小骨架已具备后续接线基础。",
      ],
      business_outcomes: [
        "把“多人并行做系统”先变成“同一规则下协作”，避免一开始就因协作混乱拖慢业务推进。",
        "第一次具备一个统一验收入口，让你能像看产线看板一样看系统建设进度。",
        "为后续从剧本到成片的全链路 MVP 打下最小治理底座，而不是靠口头协调推进。",
      ],
      remaining_gaps: [
        "这一轮主要解决协作秩序，不直接产生真实业务数据或运行闭环。",
        "还无法证明人审 Gate、局部返工、成本控制这些核心业务能力。",
        "离真实短剧生产系统还停留在“有组织方式和页面骨架”的阶段。",
      ],
      scenarios: orchestratorAcceptanceScenarios,
    }
    const fallbackDynamicTabs: AcceptanceTaskTab[] = [
      {
        id: "round-2026-03-07-second",
        label: "2026-03-07 第二轮任务",
        description: "优先展示真实数据库兼容读侧；若失败则回退到契约一致的 mock 场景。",
        source: "fallback-mock",
        technical_outcomes: [
          "从纯 mock 页面推进到真实读取优先的验收模式。",
          "第二轮验收开始覆盖 Stage2、Stage4 和回炉最小场景。",
          "页面结构保持稳定，便于后续各轮持续叠加。",
        ],
        business_outcomes: [
          "团队开始能用统一界面看“最小编排是否像生产流程”。",
          "首次把关键审核与回炉概念映射到可见场景，缩短业务沟通距离。",
          "为后续真实接库争取到前置验证空间。",
        ],
        remaining_gaps: [
          "回退 mock 只用于兜底，不能代表真实库状态。",
          "还不能证明线上数据链路稳定。",
          "还未进入真实写侧和局部返工闭环。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-07-third",
        label: "2026-03-07 第三轮任务",
        description: "第三轮真实数据库读侧、Review Gateway 与 Node Trace 承接结果。",
        source: "fallback-mock",
        technical_outcomes: [
          "真实数据库读侧、Review Gateway 最小 API、Node Trace 真读侧开始收口。",
          "可看到 core_pipeline、review_tasks、return_tickets、node_registry 的真实空态或兼容态。",
          "第三轮把“接真库”这件事做成了稳定验收能力。",
        ],
        business_outcomes: [
          "第一次可以基于真实数据库讨论系统现在卡在哪，而不是仅靠推测。",
          "让后续外包前端、人审链路和主控逻辑围绕同一真相源收敛。",
          "为后续精准打回与产线调度建立观测面。",
        ],
        remaining_gaps: [
          "如果真实读侧不可用，这里仍会回退为 mock 展示。",
          "核心运行表为空时，还不能证明真实业务闭环成立。",
          "仍缺少真正的写回动作和回炉联动。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-fourth",
        label: "2026-03-08 第四轮任务",
        description: "第四轮真实写侧闭环结果；若动态读侧失败则回退到合同一致的 mock 场景。",
        source: "fallback-mock",
        technical_outcomes: [
          "第四轮目标是最小真实写侧闭环，包括种子、写回、回炉与 Node Trace 承接。",
          "正常情况下应优先展示真实 runs/node_runs/review_tasks/return_tickets。",
          "当前回退 mock 仅作为接口不可用时的展示兜底。",
        ],
        business_outcomes: [
          "这一轮的核心价值是证明人审意见可以驱动局部返工，而不是整条链重跑。",
          "它直接逼近“4 个关键人工节点 + 自动化其余节点”的业务目标。",
          "也是后续成本、吞吐、审核效率量化的起点。",
        ],
        remaining_gaps: [
          "若看到这张回退卡，说明真写侧结果未被当前页面拿到。",
          "它不能替代真实写侧验收结论。",
          "仍需恢复真实 API 后再以真实数据为准。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-fifth",
        label: "2026-03-08 第五轮任务",
        description: "第五轮真相源统一与北极星指标骨架；若真实读侧失败则暂不展示真实指标。",
        source: "fallback-mock",
        technical_outcomes: [
          "目标是把 truth source 状态和北极星指标摘要做成统一读侧契约。",
          "Review Gateway / acceptance / Node Trace 将共享同一份指标输出。",
          "当前回退场景不代表第五轮真实验收完成，仅用于页面兜底。",
        ],
        business_outcomes: [
          "开始把验收从“功能对不对”推进到“离成本、质量、吞吐目标还差多少”。",
          "减少多人并行时因 DTO 口径不一致带来的沟通摩擦。",
          "为后续质量评测、审核运营和成本控制提前铺设统一事实层。",
        ],
        remaining_gaps: [
          "回退 mock 不代表真实指标已成功接出。",
          "如果看不到真实第五轮 Tab，应以 API/读侧校验结果为准。",
          "完整 Data Center、质量策略闭环和规模化控制仍在后续轮次。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-sixth",
        label: "2026-03-08 第六轮任务",
        description: "第六轮聚焦 artifact、auto_qc 与 model gateway 最小执行底座。",
        source: "fallback-mock",
        technical_outcomes: [
          "T5/T6/T9 在本轮开始具备最小真实骨架，不再只有 spec 和字段占位。",
          "系统开始沉淀 artifact、auto_qc ticket 与模型执行请求预览三类关键对象。",
          "验收页继续沿用统一结构，但可视结果更接近真实执行链。",
        ],
        business_outcomes: [
          "为后续打开 T8.x 真执行主链减少返工风险和接口漂移。",
          "把失败、回炉与产物从抽象描述推进到可被查验的系统对象。",
          "多 Agent 后续接模型时，将围绕同一模型网关合同协作。",
        ],
        remaining_gaps: [
          "当前仍是最小骨架，不代表完整生产执行链已打通。",
          "artifact 复用/继承策略和正式 callback worker 还未落地。",
          "auto_qc 多维质量规则与正式阈值引擎仍待后续补强。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-seventh",
        label: "2026-03-08 第七轮任务",
        description: "第七轮聚焦 model_jobs 提交与 callback 回写的最小真实执行链。",
        source: "fallback-mock",
        technical_outcomes: [
          "T9 从静态 preview 推进到最小真实 job 链。",
          "系统开始具备 job_id、request_payload、result_payload 的统一落库表达。",
          "验收页开始可见 model_jobs 这一层对象。",
        ],
        business_outcomes: [
          "后续各 Worker Agent 可以围绕统一模型任务台账协作。",
          "主控开始能追踪一次模型调用从提交到结果的完整链条。",
          "这为后续排障、重试和成本追踪打下底座。",
        ],
        remaining_gaps: [
          "仍未接多 provider 真 SDK 和 worker 化回调处理。",
          "下游 variants / revision_logs 分发未接。",
          "超时补偿和取消控制尚未落地。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-eighth",
        label: "2026-03-08 第八轮任务",
        description: "第八轮聚焦真实 LangGraph 接线与 N01/N02/N03 最小真实链，先让编排图真正开始运转。",
        source: "fallback-mock",
        technical_outcomes: [
          "已确认项目 venv 中 `langgraph` 可编译出真实 `CompiledStateGraph`，graph compile 不再停留在概念层。",
          "已为 `N01/N02/N03` 注册最小真实 script handlers，并用 artifacts/meta 承接结构化 payload 传递。",
          "已把 `pipeline_tasks` 真实入口推进到 `run -> pause@N08 -> resume -> pause@N18`，即使动态读侧暂未返回最新场景，页面也会先保留这层阶段文案。",
        ],
        business_outcomes: [
          "这一步的业务意义是把前七轮的状态机设计和节点规格真正装配成可运转的执行引擎。",
          "它已经让脚本阶段开始留下真实 `run/node_run/artifact` 痕迹，且真实入口具备暂停/恢复能力，后续 T8.x 不必再各写各的执行流。",
          "对验收视角来说，第八轮已从“运行引擎开始落地”推进到“真实入口已可暂停/恢复”。",
        ],
        remaining_gaps: [
          "第八轮范围内已验收通过；这里保留的是后续轮次事项，而非本轮阻塞项。",
          "`pipeline_tasks` 正式生产 hook、真实 LLM/TOS 写入和正式 EpisodeContext 来源仍待后续轮次补齐。",
          "后续仍需用真实第八轮场景持续替换当前兜底展示。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-ninth",
        label: "2026-03-08 第九轮任务",
        description: "第九轮已完成生产化依赖注入与 Stage1 真 Gate 闭环，把第八轮的最小真实 graph 推进成真实审核任务可落库、可放行、可继续执行的主链。",
        source: "fallback-mock",
        technical_outcomes: [
          "已新增 production `context_loader / review_task_creator`，并默认由 `pipeline_tasks` 在 compile graph 时注入。",
          "已让 `N01` 回填 `episode_context_ref`，`N02` 优先读取真实 `EpisodeContext`，不再只依赖开发态 fallback。",
          "已打通 `N08 -> review_tasks -> approve -> resume -> N09 -> N18` 的最小真实 Stage1 闭环。",
        ],
        business_outcomes: [
          "系统已从“可以暂停/恢复”推进到“Stage1 真审核闭环已经成立”，后续扩 Stage2~Stage4 时可沿同一条主链继续推进。",
          "真实 `public.review_tasks`、`core_pipeline.runs/node_runs` 与验收页展示已围绕同一条生产语义主链收敛。",
          "对验收视角来说，第九轮把“可运行”进一步推进到“真实审核动作可以驱动图继续执行”。",
        ],
        remaining_gaps: [
          "Stage2~Stage4 仍待按同一路径继续生产化。",
          "`EpisodeContext` 中仍有部分项目级字段待继续映射到正式真相源。",
          "`N10~N26` 的真实模型 SDK / TOS 正式写入仍待后续轮次展开。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-tenth",
        label: "2026-03-08 第十轮任务",
        description: "第十轮已完成 Stage2 shot 级真 Gate 闭环，让 `N18` 进入真实多任务审核、部分通过继续等待、全部通过后自动放行到下游。",
        source: "fallback-mock",
        technical_outcomes: [
          "已将 `N18` 的任务创建从单条占位升级为按真实 shot 列表批量创建 `public.review_tasks`。",
          "已为 Stage2 `review_tasks` 写入 `scope_meta`，包含 `shot_id / scene_id / shot_number / global_shot_index`。",
          "已打通 `N18 -> approve all -> resume -> N19 -> N21` 的最小真实 Stage2 闭环。",
        ],
        business_outcomes: [
          "系统已从 Stage1 真闭环推进到 Stage2 shot 级真闭环，首次具备真正的多 scope 聚合放行语义。",
          "这让后续 Stage3/Stage4 可以继续沿同一套 production hook / review truth source 模式推进，而不用再造新流程。",
          "对验收与管理视角来说，Stage2 的审核动作、运行推进与面板展示已经围绕同一条真实主链收敛。",
        ],
        remaining_gaps: [
          "Stage2 打回后的局部回炉仍待后续轮次继续收口。",
          "`N21` 与 `N24` 仍待按相同方式继续生产化。",
          "`N14~N20` 的真实模型执行与正式产物固化仍待后续轮次展开。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-eleventh",
        label: "2026-03-08 第十一轮任务",
        description: "第十一轮已完成 Stage3 episode 级真 Gate 闭环，让 `N21` 进入真实 episode 级审核任务、approve 后自动放行到下游。",
        source: "fallback-mock",
        technical_outcomes: [
          "已将 `N21` 的 scope 解析从通用 fallback 升级为显式 episode 级任务，并写入 `scope_meta`。",
          "已打通 `N21 -> approve -> resume -> N22` 的最小真实 Stage3 闭环。",
          "已为 `_build_resume_hint` 增加 stage 3 的 scope_items 处理，与 stage 1/2 保持一致。",
        ],
        business_outcomes: [
          "系统已从 Stage2 shot 级真闭环推进到 Stage3 episode 级真闭环，主链具备 `N08 -> N18 -> N21` 三阶段 Gate 真闭环。",
          "为 Stage4 `N24` 串行三步打好基础，可沿同一套 production hook 继续推进。",
          "对验收与管理视角来说，Stage3 的审核动作、运行推进与面板展示已围绕同一条真实主链收敛。",
        ],
        remaining_gaps: [
          "Stage3 打回后的回炉仍待后续轮次继续收口。",
          "`N24` 仍待按相同方式继续生产化。",
          "`N14~N20` 的真实模型执行与正式产物固化仍待后续轮次展开。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
      {
        id: "round-2026-03-08-twelfth",
        label: "2026-03-08 第十二轮任务",
        description: "第十二轮已完成 Stage4 episode 级串行 3 步真 Gate 闭环，让 `N24` 进入真实串行审核任务、三步 approve 后自动放行到 N25，4 Gate 全生产化收口。",
        source: "fallback-mock",
        technical_outcomes: [
          "已将 `N24` 的 scope 解析从通用 fallback 升级为显式 episode 级串行 3 步，并写入 `scope_meta`。",
          "已升级 `_ensure_next_stage4_step`：uuid5 确定性 task_id、scope_id、scope_meta、due_at。",
          "已打通 `N24 -> Step1/2/3 approve -> resume -> N25` 的最小真实 Stage4 闭环。",
        ],
        business_outcomes: [
          "4 Gate（N08/N18/N21/N24）全部生产化，主链 Gate 体系收口完成。",
          "可专注 PLAN Phase 0 与 Phase 1，推进真实 handler 与执行链。",
          "对验收与管理视角来说，Stage4 的串行 3 步审核、运行推进与面板展示已围绕同一条真实主链收敛。",
        ],
        remaining_gaps: [
          "Stage2/Stage3/Stage4 打回后的局部回炉仍待后续轮次继续收口。",
          "`N14~N23` 的真实模型执行与正式产物固化仍待后续轮次展开。",
        ],
        scenarios: orchestratorAcceptanceScenarios,
      },
    ]

    return [roundOneTab, ...(dynamicTaskTabs.length > 0 ? dynamicTaskTabs : fallbackDynamicTabs)]
  }, [dynamicTaskTabs])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = "auto"
    document.documentElement.style.overflow = "auto"

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const loadDynamicTaskTabs = async () => {
      try {
        const response = await fetch("/api/orchestrator/acceptance", { cache: "no-store" })
        const payload = (await response.json()) as AcceptanceApiResponse & { error?: string }

        if (disposed) return

        if (payload.taskTabs?.length > 0) {
          setDynamicTaskTabs(payload.taskTabs)
          setNorthStarSummary(payload.north_star_summary ?? null)
          setAcceptanceError(null)
        } else {
          setAcceptanceError(payload.error ?? "真实数据库读侧未返回有效任务 Tab，已使用回退 mock。")
        }
      } catch (error) {
        if (disposed) return
        setAcceptanceError(error instanceof Error ? error.message : "真实数据库读侧请求失败")
      } finally {
        if (!disposed) {
          setIsAcceptanceLoading(false)
        }
      }
    }

    void loadDynamicTaskTabs()

    return () => {
      disposed = true
    }
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <AdminNavSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="flex min-h-12 items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">
                  <ArrowLeft className="h-4 w-4" />
                  返回剧集页
                </Link>
              </Button>
              <div>
                <h1 className="text-sm font-semibold text-foreground">最小编排验收页</h1>
                <p className="text-xs text-muted-foreground">
                  基于冻结合同字段展示验收场景，同时从技术交付与业务目标两个视角解释每一轮的实际推进。
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              weighted progress + business-aligned acceptance
            </Badge>
          </div>
        </header>

        <main className="flex-1 p-6 pb-10">
          <Tabs defaultValue="overall" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
              <TabsTrigger
                value="overall"
                className="h-auto rounded-lg border border-border/60 px-4 py-2 data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/10"
              >
                总体进度
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="h-auto rounded-lg border border-border/60 px-4 py-2 data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/10"
              >
                独立任务验收
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overall" className="space-y-6">
              <NorthStarSummaryPanel summary={northStarSummary} />
              <OverallRoadmapPanel
                overall={overall}
                mvp0={mvp0}
                mvp1={mvp1}
                mvp0Tasks={mvp0Tasks}
                mvp1Tasks={mvp1Tasks}
                activeTasks={activeTasks}
              />
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6">
              <NorthStarSummaryPanel summary={northStarSummary} />
              <TaskAcceptancePanel
                taskTabs={taskTabs}
                isLoading={isAcceptanceLoading}
                errorMessage={acceptanceError}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
