/**
 * Admin API 统一调用层。
 * 剧集列表、节点详情、TOS 预签名、产物查询等管理后台专用 API。
 */

import type {
  Artifact,
  NodeRun,
  Run,
} from "./orchestrator-contract-types"

// ─── Drama List ─────────────────────────────────────────

export interface DramaListItem {
  episode_id: string
  version_no: number
  version_status: string | null
  episode_version_id: string | null
  version_created_at: string | null
  version_updated_at: string | null
  run_count: number
  node_run_count: number
  total_cost_cny: number
  current_node_id: string | null
  latest_run_status: string | null
  pending_review_count: number
}

export interface DramaListResponse {
  source: string
  items: DramaListItem[]
  total: number
  error?: string
}

export async function fetchDramas(limit = 50): Promise<DramaListResponse> {
  try {
    const res = await fetch(`/api/orchestrator/dramas?limit=${limit}`, {
      cache: "no-store",
    })
    return (await res.json()) as DramaListResponse
  } catch (err) {
    console.error("[admin-api] fetchDramas failed:", err)
    return { source: "error", items: [], total: 0, error: String(err) }
  }
}

// ─── Episode Detail (versions + runs + node_runs) ───────

export interface EpisodeVersion {
  episode_version_id: string
  episode_id: string
  version_no: number
  status: string
  created_at: string
  updated_at: string
}

export interface EpisodeDetailResponse {
  source: string
  episode_id: string
  versions: EpisodeVersion[]
  runs: Run[]
  node_runs: NodeRun[]
  error?: string
}

export async function fetchEpisodeDetail(
  episodeId: string
): Promise<EpisodeDetailResponse> {
  try {
    const res = await fetch(`/api/orchestrator/dramas/${episodeId}`, {
      cache: "no-store",
    })
    return (await res.json()) as EpisodeDetailResponse
  } catch (err) {
    console.error("[admin-api] fetchEpisodeDetail failed:", err)
    return {
      source: "error",
      episode_id: episodeId,
      versions: [],
      runs: [],
      node_runs: [],
      error: String(err),
    }
  }
}

// ─── Artifacts by Node Run ──────────────────────────────

export interface ArtifactListResponse {
  source: string
  items: Artifact[]
  total: number
  error?: string
}

export async function fetchArtifactsByNodeRun(
  nodeRunId: string
): Promise<ArtifactListResponse> {
  try {
    const res = await fetch(
      `/api/orchestrator/artifacts/by-node-run?node_run_id=${nodeRunId}`,
      { cache: "no-store" }
    )
    return (await res.json()) as ArtifactListResponse
  } catch (err) {
    console.error("[admin-api] fetchArtifactsByNodeRun failed:", err)
    return { source: "error", items: [], total: 0, error: String(err) }
  }
}

// ─── TOS Presigned URL ──────────────────────────────────

export interface TosPresignedUrlResponse {
  tos_url: string
  http_url: string | null
  expires_in?: number
  error?: string
}

export async function fetchTosPresignedUrl(
  tosUrl: string
): Promise<TosPresignedUrlResponse> {
  try {
    const res = await fetch(
      `/api/orchestrator/tos/presigned-url?tos_url=${encodeURIComponent(tosUrl)}`,
      { cache: "no-store" }
    )
    return (await res.json()) as TosPresignedUrlResponse
  } catch (err) {
    console.error("[admin-api] fetchTosPresignedUrl failed:", err)
    return { tos_url: tosUrl, http_url: null, error: String(err) }
  }
}
