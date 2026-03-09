/** Types for the E2E episode trace page */

export type NodeStatus = "completed" | "running" | "pending" | "failed" | "skipped" | "gate_waiting" | "gate_approved" | "gate_rejected"

export type DecisionLevel = "planning" | "execution" | "review" | "gate" | "freeze" | "compose"

export interface TraceNode {
  node_id: string
  node_name: string
  stage: number
  category: string
  agent_name: string
  status: NodeStatus
  decision_level: DecisionLevel
  duration_seconds: number | null
  cost_cny: number
  quality_score: number | null
  model: string | null
  is_gate: boolean
  version_no: number
  batch_stats?: {
    total_shots: number
    completed: number
    running: number
    failed: number
    retried: number
    one_pass_rate: number
  }
  gate_reviewer_name?: string
  gate_decision?: string
  gate_feedback?: string
}

export interface TraceEdge {
  from: string
  to: string
  type: "normal" | "parallel" | "return"
}

export interface StageInfo {
  stage: number
  label: string
  nodes: string[]
}

export interface TraceSummary {
  total_duration_seconds: number
  total_cost_cny: number
  avg_quality_score: number
  completed_nodes: number
  total_nodes: number
  return_ticket_count: number
}

export interface EpisodeTrace {
  episode_id: string
  project_name: string
  episode_number: number
  versions: { version_no: number; status: string; is_current: boolean; created_at: string }[]
  summary: TraceSummary
  nodes: TraceNode[]
  edges: TraceEdge[]
  stages: StageInfo[]
}
