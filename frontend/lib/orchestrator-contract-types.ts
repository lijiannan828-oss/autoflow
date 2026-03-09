export type EpisodeVersionStatus =
  | "created"
  | "running"
  | "wait_review_stage_1"
  | "wait_review_stage_2"
  | "wait_review_stage_3"
  | "wait_review_stage_4"
  | "wait_review_stage_4_step_1"
  | "wait_review_stage_4_step_2"
  | "wait_review_stage_4_step_3"
  | "approved_stage_1"
  | "approved_stage_2"
  | "approved_stage_3"
  | "approved_stage_4"
  | "returned"
  | "patching"
  | "delivered"
  | "distributed"

export type RunStatus = "pending" | "running" | "succeeded" | "failed" | "canceled"

export type NodeRunStatus =
  | "pending"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "canceled"
  | "skipped"
  | "partial"
  | "auto_rejected"

export type ReviewTaskStatus = "pending" | "in_progress" | "approved" | "returned" | "skipped"

export type ReturnTicketStatus = "open" | "in_progress" | "resolved" | "wontfix"

export type GateNodeId = "N08" | "N18" | "N21" | "N24"

export type ReviewerRole = "qc_inspector" | "middle_platform" | "partner"

export type ReviewGranularity = "asset" | "shot" | "episode"

export type ReviewDecision = "approve" | "return"

export type ReturnSourceType = "human_review" | "auto_qc"

export interface ReviewTask {
  id: string
  episode_id: string
  episode_version_id: string
  stage_no: 1 | 2 | 3 | 4
  gate_node_id: GateNodeId
  review_step_no: 1 | 2 | 3
  reviewer_role: ReviewerRole
  review_granularity: ReviewGranularity
  anchor_type: string | null
  anchor_id: string | null
  status: ReviewTaskStatus
  assignee_id: string | null
  priority: string
  openclaw_session_id: string | null
  payload_json: Record<string, unknown>
  started_at: string | null
  finished_at: string | null
  decision: ReviewDecision | null
  decision_comment: string | null
  created_at: string
  updated_at: string
}

export interface ReturnTicket {
  id: string
  episode_id: string
  episode_version_id: string
  review_task_id: string | null
  source_type: ReturnSourceType
  source_node_id: string | null
  stage_no: 1 | 2 | 3 | 4
  anchor_type: string | null
  anchor_id: string | null
  timestamp_ms: number | null
  issue_type: string
  severity: string
  comment: string
  created_by_role: ReviewerRole
  suggested_stage_back: number
  system_root_cause_node_id: string | null
  rerun_plan_json: Record<string, unknown> | null
  status: ReturnTicketStatus
  resolved_version_id: string | null
  created_at: string
  updated_at: string
}

export interface Run {
  id: string
  episode_id: string
  episode_version_id: string
  status: RunStatus
  current_node_id: string | null
  plan_json: Record<string, unknown>
  is_rerun: boolean
  rerun_from_ticket_id: string | null
  langgraph_thread_id: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export interface NodeRun {
  id: string
  run_id: string
  episode_version_id: string
  node_id: string
  agent_role: string
  status: NodeRunStatus
  attempt_no: number
  retry_count: number
  auto_reject_count: number
  scope_hash: string
  input_ref: string | null
  output_ref: string | null
  model_provider: string | null
  model_endpoint: string | null
  comfyui_workflow_id: string | null
  api_calls: number
  token_in: number
  token_out: number
  gpu_seconds: number
  cost_cny: number
  rag_query_count: number
  quality_score: number | null
  error_code: string | null
  error_message: string | null
  tags: string[]
  started_at: string | null
  ended_at: string | null
  duration_s: number | null
  created_at: string
  updated_at: string
}

export interface Artifact {
  id: string
  episode_version_id: string
  node_run_id: string | null
  artifact_type: string
  anchor_type: string
  anchor_id: string | null
  time_range: Record<string, unknown> | null
  resource_url: string
  preview_url: string | null
  meta_json: Record<string, unknown>
  created_at: string
}

export interface ModelJob {
  id: string
  job_id: string
  request_id: string | null
  job_type: string
  episode_id: string | null
  stage_no: number | null
  status: string
  provider: string | null
  callback_url: string | null
  request_payload: Record<string, unknown>
  result_payload: Record<string, unknown> | null
  error_payload: Record<string, unknown> | null
  queued_at: string
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export interface GateListItem {
  review_task_id: string
  episode_id: string
  episode_version_id: string
  stage_no: 1 | 2 | 3 | 4
  gate_node_id: GateNodeId
  review_step_no: 1 | 2 | 3
  reviewer_role: ReviewerRole
  review_granularity: ReviewGranularity
  anchor_type: string | null
  anchor_id: string | null
  status: ReviewTaskStatus
  priority: string
  openclaw_session_id: string | null
  due_at: string | null
  payload: Record<string, unknown>
}

export interface GateListResponse {
  items: GateListItem[]
  total: number
}

export interface GateReviewPoint {
  timestamp_ms: number
  issue_type: string
  severity: string
  comment: string
}

export interface GateDetailResponse {
  review_task_id: string
  episode_id: string
  episode_version_id: string
  stage_no: 1 | 2 | 3 | 4
  gate_node_id: GateNodeId
  review_step_no: 1 | 2 | 3
  reviewer_role: ReviewerRole
  review_granularity: ReviewGranularity
  anchor_type: string | null
  anchor_id: string | null
  status: ReviewTaskStatus
  priority: string
  openclaw_session_id: string | null
  payload: Record<string, unknown>
  review_points: GateReviewPoint[]
  stage4_progress?: {
    current_step_no: 1 | 2 | 3
    total_steps: 3
    previous_steps: Array<{
      step_no: 1 | 2 | 3
      status: ReviewTaskStatus
    }>
  }
}

export interface GateApproveRequest {
  review_task_id: string
  decision: "approve"
  decision_comment: string
  review_points: GateReviewPoint[]
}

export interface GateApproveResponse {
  review_task_id: string
  status: "approved"
  decision: "approve"
  return_ticket_id: null
  next_action: "release_gate_or_create_next_step"
  gate_snapshot?: Stage2AggregationResponse | Stage4StepQueryResponse | Record<string, unknown>
}

export interface GateReturnRequest {
  review_task_id: string
  decision: "return"
  decision_comment: string
  review_points: GateReviewPoint[]
}

export interface GateReturnResponse {
  review_task_id: string
  status: "returned"
  decision: "return"
  return_ticket_id: string
  next_action: "create_return_ticket_and_stop_following_steps"
  gate_snapshot?: Stage2AggregationResponse | Stage4StepQueryResponse | Record<string, unknown>
  resolved_version_id?: string
}

export interface GateSkipRequest {
  review_task_id: string
  reason: "optional_step_skipped"
}

export interface GateSkipResponse {
  review_task_id: string
  status: "skipped"
  next_action: "create_next_step"
  gate_snapshot?: Stage4StepQueryResponse | Record<string, unknown>
}

export interface Stage2AggregationResponse {
  episode_version_id: string
  gate_node_id: "N18"
  approved_count: number
  returned_count: number
  pending_count: number
  total_count: number
  all_approved: boolean
}

export interface Stage3AggregationResponse {
  episode_version_id: string
  gate_node_id: "N21"
  approved_count: number
  returned_count: number
  pending_count: number
  total_count: number
  all_approved: boolean
}

export interface Stage4StepQueryResponse {
  episode_version_id: string
  gate_node_id: "N24"
  current_step_no: 1 | 2 | 3
  total_steps: 3
  steps: Array<{
    step_no: 1 | 2 | 3
    reviewer_role: ReviewerRole
    status: ReviewTaskStatus | null
  }>
}

export interface OrchestratorAcceptanceScenario {
  id: string
  label: string
  description: string
  focus_run_id: string
  runs: Run[]
  node_runs: NodeRun[]
  review_tasks: ReviewTask[]
  return_tickets: ReturnTicket[]
  artifacts?: Artifact[]
  model_jobs?: ModelJob[]
  gate_list: GateListResponse | null
  gate_detail: GateDetailResponse | null
  stage2_summary: Stage2AggregationResponse | null
  stage4_summary: Stage4StepQueryResponse | null
  version_patch?: Record<string, unknown>
}

export type AcceptanceTaskTabSource =
  | "mock"
  | "real-read"
  | "real-db"
  | "real-write"
  | "real-db-compat"
  | "fallback-mock"

export interface AcceptanceTaskTab {
  id: string
  label: string
  description: string
  source: AcceptanceTaskTabSource
  generated_at?: string
  technical_outcomes?: string[]
  business_outcomes?: string[]
  remaining_gaps?: string[]
  scenarios: OrchestratorAcceptanceScenario[]
}

export interface TruthSourceStatus {
  preferred_review_task_source: string
  core_truth_ready: boolean
  compat_projection_active: boolean
  core_counts: Record<string, number>
  summary: string
}

export interface NorthStarSummary {
  generated_at: string
  truth_source: TruthSourceStatus
  cost: {
    signal: "measured" | "missing"
    cost_redline_per_minute_cny: number
    total_cost_cny: number
    total_gpu_seconds: number
    costed_node_runs: number
    avg_cost_per_node_run: number | null
    note: string
  }
  quality: {
    signal: "measured" | "missing"
    avg_quality_score: number | null
    scored_node_runs: number
    low_quality_node_runs: number
    quality_coverage_rate: number | null
    unstable_node_runs: number
  }
  throughput: {
    signal: "measured" | "missing"
    total_runs: number
    rerun_runs: number
    active_runs: number
    version_count: number
    artifact_count: number
    model_job_count: number
    active_model_jobs: number
    avg_node_duration_seconds: number | null
    avg_review_queue_seconds: number | null
    avg_review_cycle_seconds: number | null
    pending_review_tasks: number
    in_progress_review_tasks: number
  }
  feedback: {
    signal: "measured" | "missing"
    total_review_tasks: number
    approved_review_tasks: number
    returned_review_tasks: number
    approval_rate: number | null
    total_return_tickets: number
    auto_qc_return_tickets: number
    open_return_tickets: number
    resolved_return_tickets: number
    review_points: number
    workflow_artifacts: number
    prompt_artifacts: number
  }
}

export interface AcceptanceApiResponse {
  taskTabs: AcceptanceTaskTab[]
  north_star_summary?: NorthStarSummary
}

// ─── Payload JSON Schemas (per-Stage contract) ────────────────────────
// These define the content fields that gates.py MUST populate and
// review-adapters.ts MAY consume.  Runtime metadata (source, run_id,
// thread_id, scope_id, upstream_node_run_id …) is always present but
// omitted here — adapters should ignore unknown keys.

/** Stage 1 / N08 — 美术资产审核 (per-asset granularity) */
export interface Stage1PayloadJson {
  // ── runtime (always present, written by production_review_task_creator)
  source: string
  run_id?: string
  gate_node_id: "N08"
  scope: "asset"
  scope_id: string
  upstream_node_run_id?: string

  // ── content (enriched from N07 output artifacts)
  asset_type?: "character" | "scene" | "prop"     // anchor classification
  name?: string                                    // display name
  description?: string                             // 资产描述
  prompt?: string                                  // generation prompt used by N06/N07
  art_style?: string                               // 影调/风格标签
  visual_description?: string                      // 视觉描述
  project_name?: string
  script_summary?: string
  highlights?: Array<{ title?: string; content?: string }>

  candidates?: Array<{
    id: string
    url?: string           // TOS or HTTP URL to candidate image
    prompt?: string        // prompt used for this candidate
    model?: string         // e.g. "FLUX.2", "FireRed-1.1"
    score?: number         // QC score if available
  }>

  // ── reviewer edits (written back via updateReviewTaskPayload)
  locked_image_id?: string | null
}

/** Stage 2 / N18 — 视觉素材审核 (per-shot granularity) */
export interface Stage2PayloadJson {
  source: string
  run_id?: string
  gate_node_id: "N18"
  scope: "shot"
  scope_id: string
  upstream_node_run_id?: string

  // ── content (enriched from N13 frozen keyframes + N14/N17 video output)
  shot_id?: string
  shot_title?: string
  scene_id?: string
  scene_number?: number
  shot_number?: number
  global_shot_index?: number
  duration?: number                  // seconds
  prompt?: string                    // visual prompt
  video_prompt?: string
  camera_movement?: string
  suggestions?: string[]

  keyframe_candidates?: Array<{
    id: string
    url?: string
    prompt?: string
    model?: string
    score?: number
  }>

  video_candidates?: Array<{
    id: string
    url?: string
    prompt?: string
    model?: string
    score?: number
    duration?: number
  }>

  // ── reviewer edits
  selected_keyframe_id?: string
  selected_video_id?: string
}

/** Stage 3 / N21 — 视听整合审核 (episode granularity) */
export interface Stage3PayloadJson {
  source: string
  run_id?: string
  gate_node_id: "N21"
  scope: "episode"
  upstream_node_run_id?: string

  // ── content (enriched from N20 av_tracks output)
  episode_title?: string
  project_name?: string
  total_shots?: number
  total_duration?: number

  video_clips?: Array<{
    id: string
    name?: string
    shot_id?: string
    start_time: number       // seconds on timeline
    duration: number
    in_point: number         // source in-point
    out_point: number        // source out-point
    url?: string
  }>

  audio_clips?: Array<{
    id: string
    type: "voiceover" | "sfx" | "bgm"
    name?: string
    character?: string
    dialogue_text?: string
    start_time: number
    duration: number
    track_index?: number
    volume?: number
    fade_in?: number
    fade_out?: number
    url?: string
  }>

  subtitle_clips?: Array<{
    id: string
    text: string
    speaker?: string
    start_time: number
    duration: number
  }>

  characters?: Array<{
    id: string
    name: string
    avatar_color?: string
    voice_model?: string
    language?: string
  }>

  // ── reviewer edits (written back via updateReviewTaskPayload)
  audio_adjustments?: Record<string, {
    volume?: number
    fade_in?: number
    fade_out?: number
  }>
  track_settings?: Record<string, {
    muted?: boolean
    locked?: boolean
  }>
}

/** Stage 4 / N24 — 成片审核 (episode granularity, serial 3-step) */
export interface Stage4PayloadJson {
  source: string
  run_id?: string
  gate_node_id: "N24"
  scope: "episode"
  upstream_node_run_id?: string

  // ── content (enriched from N23 final episode output)
  episode_title?: string
  duration?: number
  step_no?: 1 | 2 | 3
  reviewer_role?: ReviewerRole
  final_video_url?: string          // TOS URL to composed video
  final_video_http_url?: string     // presigned HTTP URL
  version_no?: number
  is_revision?: boolean
  revision_count?: number

  // ── reviewer edits
  review_points?: GateReviewPoint[]
}

/** Union type for payload_json discrimination */
export type StagePayloadJson =
  | Stage1PayloadJson
  | Stage2PayloadJson
  | Stage3PayloadJson
  | Stage4PayloadJson

export interface ReviewGatewayListApiResponse extends GateListResponse {
  source: string
}

export interface ReviewGatewayDetailApiResponse {
  source: string
  detail: GateDetailResponse
}

export interface NodeTraceCompatStep {
  stage_no: number
  gate_node_id: string
  status: string | null
  updated_at: string | null
}

export interface NodeTraceApiResponse {
  source: string
  core_counts: Record<string, number>
  focus_run_id?: string | null
  real_runs?: Run[]
  real_node_runs?: NodeRun[]
  real_return_tickets?: ReturnTicket[]
  north_star_summary?: NorthStarSummary
  compat_projection: {
    episode_id: string
    current_stage_no: number | null
    current_gate_node_id: string | null
    current_status: string | null
    timeline: NodeTraceCompatStep[]
  } | null
  registry_validation: {
    expected_node_count: number
    actual_node_count: number
    is_seeded: boolean
    blocking_issues: string[]
  }
}
