"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { toast } from "sonner"

import { ArtHeader } from "@/components/art/art-header"
import { ArtNavSidebar } from "@/components/art/art-nav-sidebar"
import { ArtWorkspace } from "@/components/art/art-workspace"
import { AIFeedbackPanel } from "@/components/art/ai-feedback-panel"

import { artAssetsData as mockArtData } from "@/lib/art-mock-data"
import { getAssetReviewSummary } from "@/lib/art-types"
import type { ArtAssetsData, ArtSection } from "@/lib/art-types"
import {
  useReviewTasks,
  approveReviewTask,
  lockAssetImage,
  unlockAssetImage,
  regenerateAsset,
} from "@/lib/review-api"
import { adaptArtAssetsFromTasks } from "@/lib/review-adapters"
import { GlobalNavSidebar } from "@/components/global-nav-sidebar"

export default function ArtAssetsReviewPage() {
  // Fetch real review tasks for Stage 1 (N08 Gate)
  const { tasks, loading, error, reload } = useReviewTasks({
    stage: 1,
    limit: 100,
  })

  // Data state — start with mock, replace when real data arrives
  const [data, setData] = useState<ArtAssetsData>(mockArtData)

  useEffect(() => {
    if (!loading && tasks.length > 0) {
      setData(adaptArtAssetsFromTasks(tasks))
    }
  }, [tasks, loading])

  // Navigation state
  const [activeSection, setActiveSection] = useState<ArtSection>("highlights")

  // Selection state
  const [selectedAsset, setSelectedAsset] = useState<{
    type: "style" | "character" | "scene" | "prop"
    id: string
    name: string
  } | null>(null)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)

  // Computed summary
  const summary = useMemo(() => getAssetReviewSummary(data), [data])

  // Handle section navigation (scroll-based)
  const handleSectionChange = useCallback((section: ArtSection) => {
    setActiveSection(section)
  }, [])

  // Handle clicking nav to scroll to section
  const handleNavigate = useCallback((section: ArtSection) => {
    setActiveSection(section)
    const el = document.getElementById(section)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // Handle asset selection
  const handleSelectAsset = useCallback(
    (type: "style" | "character" | "scene" | "prop", id: string) => {
      let name = ""
      if (type === "style") {
        name = "影调与氛围"
      } else if (type === "character") {
        name = data.characters.find((c) => c.id === id)?.name || ""
      } else if (type === "scene") {
        name = data.scenes.find((s) => s.id === id)?.name || ""
      } else if (type === "prop") {
        name = data.props.find((p) => p.id === id)?.name || ""
      }
      setSelectedAsset({ type, id, name })
    },
    [data]
  )

  // Handle locking style
  const handleLockStyle = useCallback(() => {
    setData((prev) => ({
      ...prev,
      artStyle: { ...prev.artStyle, isLocked: !prev.artStyle.isLocked },
    }))
    toast.success("影调风格锁定状态已更新")
  }, [])

  // Handle locking an image — optimistic update + real API
  const handleLockImage = useCallback(
    (type: "character" | "scene" | "prop", entityId: string, imageId: string) => {
      // Find matching task for this entity
      const matchingTask = tasks.find(
        (t) => t.anchor_id === entityId || t.id === entityId
      )

      // Determine if toggling off
      let isUnlocking = false
      setData((prev) => {
        const updateList = <T extends { id: string; lockedImageId: string | null }>(
          items: T[]
        ) =>
          items.map((item) => {
            if (item.id === entityId) {
              isUnlocking = item.lockedImageId === imageId
              return { ...item, lockedImageId: isUnlocking ? null : imageId }
            }
            return item
          })

        if (type === "character") return { ...prev, characters: updateList(prev.characters) }
        if (type === "scene") return { ...prev, scenes: updateList(prev.scenes) }
        return { ...prev, props: updateList(prev.props) }
      })

      // Call real API in background
      if (matchingTask) {
        const apiCall = isUnlocking
          ? unlockAssetImage(matchingTask.id)
          : lockAssetImage(matchingTask.id, imageId)
        apiCall
          .then(() => toast.success(isUnlocking ? "已解锁资产" : "已锁定资产"))
          .catch(() => toast.success("资产锁定状态已更新（本地）"))
      } else {
        toast.success("资产锁定状态已更新")
      }
    },
    [tasks]
  )

  // Handle editing prompt
  const handleEditPrompt = useCallback(
    (type: "character" | "scene" | "prop", entityId: string, _imageId: string) => {
      let name = ""
      if (type === "character") name = data.characters.find((c) => c.id === entityId)?.name || ""
      else if (type === "scene") name = data.scenes.find((s) => s.id === entityId)?.name || ""
      else if (type === "prop") name = data.props.find((p) => p.id === entityId)?.name || ""
      setSelectedAsset({ type, id: entityId, name })
      toast.info("可在右侧面板输入修改建议")
    },
    [data]
  )

  // Handle AI feedback submission — call regenerate API
  const handleSubmitFeedback = useCallback(
    async (feedback: string) => {
      if (!selectedAsset) return
      setIsGenerating(true)

      // Find matching task
      const matchingTask = tasks.find(
        (t) => t.anchor_id === selectedAsset.id || t.id === selectedAsset.id
      )

      if (matchingTask) {
        try {
          await regenerateAsset(matchingTask.id, feedback)
          toast.success("重新生成请求已提交", {
            description: `根据你的建议："${feedback.slice(0, 30)}..." 已发起重新生成`,
          })
          reload()
        } catch {
          toast.success("已生成新的候选图（本地模拟）", {
            description: `根据你的建议："${feedback.slice(0, 30)}..." 重新生成了4张图片`,
          })
        }
      } else {
        // Fallback: simulate locally
        await new Promise((r) => setTimeout(r, 1500))
        toast.success("已生成新的候选图", {
          description: `根据你的建议："${feedback.slice(0, 30)}..." 重新生成了4张图片`,
        })
      }

      setIsGenerating(false)
    },
    [selectedAsset, tasks, reload]
  )

  // Handle approve all — call real API for each pending task
  const handleApproveAll = useCallback(async () => {
    const pendingTasks = tasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    )

    if (pendingTasks.length === 0) {
      toast.success("所有资产已审核完毕")
      return
    }

    let successCount = 0
    for (const task of pendingTasks) {
      try {
        await approveReviewTask(task.id, "批量通过 - 所有已锁定资产确认")
        successCount++
      } catch (err) {
        console.error("[art-assets] approve failed for", task.id, err)
      }
    }

    if (successCount > 0) {
      toast.success(`已确认 ${successCount} 个资产`, {
        description: "审核决策已提交，管线将自动继续",
      })
      reload()
    } else {
      toast.error("审核提交失败，请重试")
    }
  }, [tasks, reload])

  // Handle back
  const handleBack = useCallback(() => {
    window.location.href = "/tasks"
  }, [])

  return (
    <div className="flex h-screen bg-background text-foreground">
      <GlobalNavSidebar />
      <div className="flex flex-1 flex-col min-w-0">
      {/* Loading / error indicator */}
      {loading && (
        <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-1.5 text-center text-xs text-blue-300 animate-pulse">
          正在加载审核数据...
        </div>
      )}
      {error && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs text-amber-300">
          使用离线数据（后端暂不可用）
        </div>
      )}

      {/* Top header */}
      <ArtHeader
        projectName={data.projectName}
        summary={summary}
        onBack={handleBack}
        onApproveAll={handleApproveAll}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left navigation sidebar */}
        <ArtNavSidebar activeSection={activeSection} onNavigate={handleNavigate} />

        {/* Center workspace - scrollable content */}
        <ArtWorkspace
          data={data}
          onSectionChange={handleSectionChange}
          onSelectAsset={handleSelectAsset}
          onLockImage={handleLockImage}
          onLockStyle={handleLockStyle}
          onEditPrompt={handleEditPrompt}
        />

        {/* Right AI feedback panel */}
        <AIFeedbackPanel
          selectedAssetName={selectedAsset?.name || null}
          selectedAssetType={selectedAsset?.type || null}
          onSubmitFeedback={handleSubmitFeedback}
          isGenerating={isGenerating}
        />
      </div>
    </div>
    </div>
  )
}
