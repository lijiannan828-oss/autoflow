"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { AdminNavSidebar } from "@/components/admin/admin-nav-sidebar"
import { OvertimeAlertBanner } from "@/components/employee/overtime-alert-banner"
import { ResourcePoolCard } from "@/components/employee/resource-pool-card"
import { CycleBreakdownCard } from "@/components/employee/cycle-breakdown-card"
import { EmployeePerformanceTable } from "@/components/employee/employee-performance-table"

import { employeeMetrics } from "@/lib/employee-mock-data"
import type { OvertimeAlert, EmployeeData } from "@/lib/employee-types"

export default function EmployeesPage() {
  // Handle drill down on overtime alert
  const handleAlertDrillDown = useCallback((alert: OvertimeAlert) => {
    toast.info(`正在追溯「${alert.dramaTitle}」的延误节点，当前卡在：${alert.currentHolder}`)
  }, [])

  // Handle view logs
  const handleViewLogs = useCallback((employee: EmployeeData) => {
    toast.info(`正在打开「${employee.name}」的详细日志...`)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Global left navigation sidebar */}
      <AdminNavSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="flex h-12 items-center justify-between px-6">
            <span className="text-sm font-medium text-foreground">员工质检效能管理</span>

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
          {/* Global alert banner */}
          <OvertimeAlertBanner 
            alerts={employeeMetrics.alerts}
            onDrillDown={handleAlertDrillDown}
          />

          {/* Core metrics row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResourcePoolCard data={employeeMetrics.resourcePool} />
            <CycleBreakdownCard data={employeeMetrics.cycleMetrics} />
          </div>

          {/* Employee performance table */}
          <EmployeePerformanceTable
            qaEmployees={employeeMetrics.qaEmployees}
            hubEditors={employeeMetrics.hubEditors}
            onViewLogs={handleViewLogs}
          />
        </main>
      </div>
    </div>
  )
}
