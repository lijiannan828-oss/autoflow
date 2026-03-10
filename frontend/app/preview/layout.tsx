import type { ReactNode } from "react"

/**
 * Preview Layout - 独立于主应用的预览环境
 * 无需登录，直接访问
 */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  )
}
