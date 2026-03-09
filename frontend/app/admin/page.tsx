"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

import { AdminNavSidebar } from "@/components/admin/admin-nav-sidebar"
import { GlobalMetricsHeader } from "@/components/admin/global-metrics-header"
import { FilterPills } from "@/components/admin/filter-pills"
import { EpisodeTaskCard } from "@/components/admin/episode-task-card"
import { DAGPipelineDrawer } from "@/components/admin/dag-pipeline-drawer"

import { episodeTasks as mockEpisodeTasks, globalMetrics, filterCounts } from "@/lib/admin-mock-data"
import type { FilterType, EpisodeTask } from "@/lib/admin-types"

// Map list-dramas API response to EpisodeTask shape
interface DramaListItem {
  episode_id: string
  version_no: number
  version_status: string | null
  episode_version_id: string | null
  run_count: number
  node_run_count: number
  total_cost_cny: number
  current_node_id: string | null
  latest_run_status: string | null
  pending_review_count: number
}

const STATUS_COLORS = ["bg-red-500/20", "bg-blue-500/20", "bg-emerald-500/20", "bg-amber-500/20", "bg-violet-500/20", "bg-pink-500/20"]

function mapDramaToTask(d: DramaListItem, idx: number): EpisodeTask {
  const nodeNum = d.current_node_id ? parseInt(d.current_node_id.replace("N", ""), 10) || 1 : 1
  const isRunning = d.latest_run_status === "running"
  const hasFailed = d.latest_run_status === "failed"
  const isWaitingHuman = d.pending_review_count > 0
  return {
    id: d.episode_id,
    dramaTitle: `剧集 ${d.episode_id.slice(0, 8)}`,
    episodeNumber: d.version_no,
    coverColor: STATUS_COLORS[idx % STATUS_COLORS.length],
    currentNodeId: nodeNum,
    nodeStates: [],
    totalDuration: 0,
    computeCost: d.total_cost_cny,
    humanTime: 0,
    isWaitingHuman,
    isRunning,
    hasFailed,
    isCostOverrun: d.total_cost_cny > 30,
  }
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTask, setSelectedTask] = useState<EpisodeTask | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [dataSource, setDataSource] = useState<"loading" | "real" | "mock">("loading")
  const [episodeTasks, setEpisodeTasks] = useState<EpisodeTask[]>(mockEpisodeTasks)

  // Fetch real dramas from API, fall back to mock
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const res = await fetch("/api/orchestrator/dramas?limit=50", { cache: "no-store" })
        const data = await res.json()
        if (disposed) return
        if (data.source === "real-db" && data.items?.length > 0) {
          setEpisodeTasks(data.items.map((d: DramaListItem, i: number) => mapDramaToTask(d, i)))
          setDataSource("real")
        } else {
          setEpisodeTasks(mockEpisodeTasks)
          setDataSource("mock")
        }
      } catch {
        if (!disposed) { setEpisodeTasks(mockEpisodeTasks); setDataSource("mock") }
      }
    }
    load()
    return () => { disposed = true }
  }, [])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let tasks = episodeTasks

    // Apply status filter
    switch (activeFilter) {
      case "waiting-human":
        tasks = tasks.filter(t => t.isWaitingHuman)
        break
      case "running":
        tasks = tasks.filter(t => t.isRunning)
        break
      case "failed":
        tasks = tasks.filter(t => t.hasFailed)
        break
      case "cost-overrun":
        tasks = tasks.filter(t => t.isCostOverrun)
        break
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      tasks = tasks.filter(t => 
        t.dramaTitle.toLowerCase().includes(query) ||
        `第${t.episodeNumber}集`.includes(query)
      )
    }

    return tasks
  }, [activeFilter, searchQuery])

  // Handle card click - navigate to detail page
  const handleCardClick = useCallback((task: EpisodeTask) => {
    router.push(`/admin/drama/${task.id}`)
  }, [router])

  // Handle card double click - open drawer for quick view
  const handleCardDoubleClick = useCallback((task: EpisodeTask) => {
    setSelectedTask(task)
    setIsDrawerOpen(true)
  }, [])

  // Handle drawer close
  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Navigation Sidebar */}
      <AdminNavSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="flex h-12 items-center justify-between px-6">
            <span className="text-sm font-medium text-foreground">
              Auto Growth生产中心
              {dataSource !== "loading" && (
                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${dataSource === "real" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                  {dataSource === "real" ? "real-db" : "mock"}
                </span>
              )}
            </span>

            <div className="flex items-center gap-2">
              {/* User identity badge */}
              <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-2.5 py-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-bold text-red-400">
                  A
                </div>
                <span className="text-[11px] font-medium text-foreground">超级管理员</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Global Metrics Header */}
          <GlobalMetricsHeader metrics={globalMetrics} />

          {/* Filters & Search */}
          <div className="flex items-center justify-between gap-4">
            <FilterPills
              activeFilter={activeFilter}
              counts={filterCounts}
              onFilterChange={setActiveFilter}
            />
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索剧名或集数..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Task Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTasks.map((task) => (
              <EpisodeTaskCard
                key={task.id}
                task={task}
                onClick={() => handleCardClick(task)}
              />
            ))}
          </div>

          {/* Empty state */}
          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">没有符合条件的任务</p>
            </div>
          )}
        </main>

        {/* DAG Pipeline Drawer */}
        <DAGPipelineDrawer
          task={selectedTask}
          isOpen={isDrawerOpen}
          onClose={handleDrawerClose}
        />
      </div>
    </div>
  )
}
