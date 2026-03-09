import { redirect } from "next/navigation"

// 首页重定向到员工效能管理页
// 改为 "/admin" 可查看超管全局生产大盘
// 改为 "/admin/drama/drama-1" 可查看剧集详情页
// 改为 "/admin/data" 可查看数据中心页
// 改为 "/tasks" 可查看我的任务页（质检员）
// 改为 "/review/art-assets" 可查看美术资产页 (第1步)
// 改为 "/review/visual" 可查看视觉素材页 (第2步)
// 改为 "/review/audiovisual" 可查看视听整合页 (第3步)
// 改为 "/review/final" 可查看成片合成页 (第4步)
export default function Home() {
  redirect("/admin/employees")
}
