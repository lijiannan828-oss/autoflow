"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { TaskDashboardHeader } from "@/components/tasks/task-dashboard-header"
import { TaskNavSidebar } from "@/components/tasks/task-nav-sidebar"
import { TaskSwimlane } from "@/components/tasks/task-swimlane"
import { taskSwimlanes as mockSwimlanes, taskDashboardSummary as mockSummary } from "@/lib/task-mock-data"
import { useReviewTasks, getCurrentUser, setCurrentUser, type UserContext } from "@/lib/review-api"
import { adaptTasksFromReviewTasks } from "@/lib/review-adapters"
import type { TaskSwimlane as TaskSwimlaneType } from "@/lib/task-types"
import type { ReviewerRole } from "@/lib/orchestrator-contract-types"
import { GlobalNavSidebar } from "@/components/global-nav-sidebar"

const ROLE_LABELS: Record<ReviewerRole, string> = {
  qc_inspector: "质检专员",
  middle_platform: "剪辑中台",
  partner: "合作方",
}

export default function MyTasksPage() {
  const router = useRouter()

  // State — initialise with SSR-safe default, sync from localStorage in useEffect
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"priority" | "deadline">("priority")
  const [activeSection, setActiveSection] = useState("")
  const [currentRole, setCurrentRole] = useState<ReviewerRole>("qc_inspector")

  // Hydration-safe: read persisted role from localStorage after mount
  useEffect(() => {
    const user = getCurrentUser()
    setCurrentRole(user.role)
  }, [])

  // Fetch real review tasks filtered by current role
  const { tasks: reviewTasks, loading, error, reload } = useReviewTasks({
    role: currentRole,
    limit: 200,
    autoRefreshMs: 30_000, // 30s auto-refresh
  })

  // Adapt backend data to swimlane format, fallback to mock
  const { swimlanes: realSwimlanes, summary: realSummary } = useMemo(() => {
    if (loading || error || reviewTasks.length === 0) {
      return { swimlanes: mockSwimlanes, summary: mockSummary }
    }
    return adaptTasksFromReviewTasks(reviewTasks, currentRole)
  }, [reviewTasks, loading, error, currentRole])

  const taskSwimlanes = realSwimlanes
  const taskDashboardSummary = realSummary

  // Set initial active section
  useEffect(() => {
    if (taskSwimlanes.length > 0 && !activeSection) {
      setActiveSection(taskSwimlanes[0].id)
    }
  }, [taskSwimlanes, activeSection])

  // Refs for scroll detection
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Filter swimlanes based on search
  const filteredSwimlanes = useMemo(() => {
    if (!searchQuery.trim()) return taskSwimlanes
    const query = searchQuery.toLowerCase()
    return taskSwimlanes
      .map((swimlane) => ({
        ...swimlane,
        tasks: swimlane.tasks.filter((task) =>
          task.title.toLowerCase().includes(query)
        ),
      }))
      .filter((swimlane) => swimlane.tasks.length > 0)
  }, [searchQuery, taskSwimlanes])

  // Sort swimlanes if needed
  const sortedSwimlanes = useMemo(() => {
    if (sortBy === "priority") return filteredSwimlanes
    const allTasks = filteredSwimlanes.flatMap((s) => s.tasks)
    const sortedTasks = [...allTasks].sort(
      (a, b) => a.deadline.getTime() - b.deadline.getTime()
    )
    return [
      {
        id: "by-deadline",
        title: "按截止日期排序",
        icon: "clock",
        badgeColor: "blue",
        tasks: sortedTasks,
      },
    ] as TaskSwimlaneType[]
  }, [filteredSwimlanes, sortBy])

  // Handle scroll to update active section
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const handleScroll = () => {
      const scrollTop = container.scrollTop
      let currentSection = sortedSwimlanes[0]?.id || ""
      sectionRefs.current.forEach((element, id) => {
        if (element.offsetTop - 100 <= scrollTop) {
          currentSection = id
        }
      })
      setActiveSection(currentSection)
    }
    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [sortedSwimlanes])

  // Handle navigation click
  const handleNavigate = useCallback((sectionId: string) => {
    const element = sectionRefs.current.get(sectionId)
    if (element && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: element.offsetTop - 20,
        behavior: "smooth",
      })
    }
  }, [])

  // Handle role switch
  const handleRoleSwitch = useCallback((role: ReviewerRole) => {
    setCurrentRole(role)
    const current = getCurrentUser()
    const newUser: UserContext = { ...current, role, displayName: ROLE_LABELS[role] }
    setCurrentUser(newUser)
    toast.success(`已切换角色为「${ROLE_LABELS[role]}」`)
  }, [])

  // Handle start review — navigate to correct review page based on task stage
  const handleStartReview = useCallback(
    (taskId: string) => {
      const task = taskSwimlanes.flatMap((s) => s.tasks).find((t) => t.id === taskId)
      if (!task) return
      if (task.status === "generating") {
        toast.error("该剧集正在生成中，请稍后再试")
        return
      }

      // 根据当前角色和任务状态决定跳转到哪个审核页
      const pendingStages = [
        task.qaStageProgress.visual,
        task.qaStageProgress.audiovisual,
        task.qaStageProgress.final,
      ]
      // 找到第一个未完成的阶段
      let targetPage = "/review/visual"
      if (pendingStages[0].current < pendingStages[0].total) {
        targetPage = "/review/visual"
      } else if (pendingStages[1].current < pendingStages[1].total) {
        targetPage = "/review/audiovisual"
      } else if (pendingStages[2].current < pendingStages[2].total) {
        targetPage = "/review/final"
      }

      // 对中台角色，优先跳美术审核或成片审核
      if (currentRole === "middle_platform") {
        targetPage = "/review/art-assets"
      } else if (currentRole === "partner") {
        targetPage = "/review/final"
      }

      toast.success(`正在进入《${task.title}》的审核流程...`)
      router.push(targetPage)
    },
    [router, taskSwimlanes, currentRole]
  )

  // Set section ref callback
  const setSectionRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) sectionRefs.current.set(id, el)
      else sectionRefs.current.delete(id)
    },
    []
  )

  return (
    <div className="flex h-screen bg-background">
      <GlobalNavSidebar />
      <div className="flex flex-1 flex-col min-w-0">
      {/* Dashboard header */}
      <TaskDashboardHeader
        summary={taskDashboardSummary}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Role switcher bar */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-2 bg-card/50">
        <span className="text-xs text-muted-foreground mr-2">当前角色:</span>
        {(Object.entries(ROLE_LABELS) as [ReviewerRole, string][]).map(([role, label]) => (
          <button
            key={role}
            onClick={() => handleRoleSwitch(role)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currentRole === role
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            {label}
          </button>
        ))}
        {loading && (
          <span className="ml-auto text-xs text-muted-foreground animate-pulse">加载中...</span>
        )}
        {error && (
          <span className="ml-auto text-xs text-amber-400">使用离线数据</span>
        )}
        <button
          onClick={() => reload()}
          className="ml-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
        >
          刷新
        </button>
      </div>

      {/* Main content with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left navigation sidebar */}
        <TaskNavSidebar
          swimlanes={sortedSwimlanes}
          activeSection={activeSection}
          onNavigate={handleNavigate}
        />

        {/* Swimlanes content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto p-6">
          <div className="flex flex-col gap-8 max-w-4xl">
            {sortedSwimlanes.map((swimlane) => (
              <TaskSwimlane
                key={swimlane.id}
                ref={setSectionRef(swimlane.id)}
                swimlane={swimlane}
                onStartReview={handleStartReview}
              />
            ))}

            {sortedSwimlanes.length === 0 && searchQuery && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-lg">没有找到匹配的剧集</p>
                <p className="text-sm mt-1">请尝试其他搜索关键词</p>
              </div>
            )}

            {sortedSwimlanes.length === 0 && !searchQuery && !loading && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-lg">当前角色暂无待办任务</p>
                <p className="text-sm mt-1">试试切换到其他角色查看</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
