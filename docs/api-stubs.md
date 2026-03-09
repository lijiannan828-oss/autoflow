# API 接口桩（T1 最小集）

用于在完整业务实现前，先打通前后端联调的最小后端契约。

## 1）任务面板

- `GET /api/tasks/panel`
  - 目的：返回任务分组卡片与顶部摘要
  - 数据来源：`stage_tasks` + `episodes` + `series`
  - 必备字段：
    - `summary`：待审剧集/集数、超时数量、生成中数量
    - `groups`：`urgent_rejected` / `in_qc` / `new_pending` / `generating`
    - `items`：按优先级规则排序后的任务卡片列表

## 2）任务领取/锁定

- `POST /api/tasks/:taskId/claim`
  - 目的：锁定任务并置为处理中
  - 数据来源：`stage_tasks`
  - 冲突规则：若任务已被他人锁定且未过期，返回 `409`

## 3）节点详情（基础壳接口）

- `GET /api/episodes/:episodeId/stage/:stageNo/detail`
  - 目的：提供页面顶层结构和锁状态
  - 最小返回：
    - 集信息上下文
    - 流程步骤
    - 锁状态
    - 节点专属空区块（`assets` / `shots` / `timeline` / `review`）

## 4）健康检查/数据库检查

- `GET /api/health/db`
  - 目的：验证数据库连通性和迁移就绪状态
  - 检查 SQL：`select 1`
