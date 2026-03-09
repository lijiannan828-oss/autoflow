# 审核工作流完整性补足计划

> 日期：2026-03-10
> 触发：MVP-0 三日冲刺后 spec review，发现 9 项关键缺口

## 背景

MVP-0 冲刺完成了 26 节点 handler + 4 审核页面 + API 全栈，但 spec 到实现之间存在功能断层：
- 前端页面有 UI 但缺少交互能力（拖拽、裁切、并发锁）
- 后端有 API 但缺少业务规则（编辑持久化链路、版本追溯、归因）
- Spec 本身在多处颗粒度不足或有歧义

## 工作分层

### Layer 0：Spec 歧义消解（主控 Agent 负责）

在写代码之前，先修 spec 中的 3 个歧义和 5 个颗粒度不足。

| # | 目标文件 | 修改内容 | 预估 |
|---|---------|---------|------|
| S1 | `node-spec-sheet.md` N20/N21/N22 | 增加"编辑持久化链路"小节：明确 N22 读取 ReviewTask.payload_json.audio_adjustments 覆盖原始 av_tracks | 30min |
| S2 | `design.md` §3.4 | 细化 timeline 编辑语义：(1) clip 拖拽约束——不允许跨轨、不允许重叠、最小 clip 0.5s (2) 裁切与 fade 交互——fade 自动截断到 clip 时长 (3) replace_clip 时长策略——采用新素材时长，后续 clip 不 ripple | 30min |
| S3 | `data-structures.md` §5.5 | 增加并发语义声明：每个 (episode_version_id, stage_no) 独立 timeline_revision；Stage 4 各步共享；409 后前端重新加载全量 timeline | 20min |
| S4 | `requirements.md` §2 | 拆分 US-6"资产锁定"和 US-28"任务锁定"为独立 story；US-28 增加子任务：claim API、超时扫描、"由 XX 处理中"提示 | 20min |
| S5 | `design.md` §6 | 合作方脱敏清单：隐藏 reviewer 姓名、中间节点产物、成本数据、review_points 中的内部评论；仅暴露最终成片 + 打点 | 15min |
| S6 | `tasks.md` T6 | 拆解 T6.1~T6.4 验收标准，每项给出 pass/fail 判定条件 | 15min |

### Layer 1：后端核心逻辑补足

| # | 任务 | 负责 Agent | 依赖 | 预估 | 优先级 |
|---|------|-----------|------|------|--------|
| B1 | **N22 固化读取 Stage 3 审核编辑** | 编排运行时 Agent | S1 | 2h | P0 |
|    | N22 handler 在固化前读取 ReviewTask.payload_json.audio_adjustments，overlay 到 av_tracks 上再写入 frozen artifact | | | | |
| B2 | **任务 claim/lock/release API** | 编排运行时 Agent | S4 | 3h | P0 |
|    | write_side 增加 claim_review_task(task_id, user_id)、release_review_task(task_id)；DB 增加 locked_by/locked_at/lock_expire_at 字段；cron 扫描超时释放 | | | | |
| B3 | **打回归因推断 + 最小重跑计划** | 回炉与版本 Agent | — | 4h | P1 |
|    | return_review_task 时根据 issue_type → root_cause_node_id 映射表推断归因节点；_ensure_rerun_run() 生成最小重跑路径（从归因节点到当前 Gate） | | | | |
| B4 | **EpisodeVersion 版本创建** | 编排运行时 Agent | B3 | 2h | P1 |
|    | 每次 rerun 创建新 episode_version (v2/v3…) + RevisionLog 记录；N25 固化时更新 episode_versions.status = delivered | | | | |
| B5 | **timeline_revision 乐观并发控制** | 编排运行时 Agent | S3 | 2h | P1 |
|    | update_review_task_payload 增加 revision 参数；DB UPDATE 加 WHERE timeline_revision = expected；不匹配返回 409 + 最新快照 | | | | |
| B6 | **审计日志写入** | 编排运行时 Agent | — | 1.5h | P2 |
|    | 所有 write_side 操作写入 audit_logs（approve/return/skip/update_payload/regenerate）| | | | |
| B7 | **反馈结构化落库** | 编排运行时 Agent | — | 1.5h | P2 |
|    | approve/return 时将 review_points 写入 feedback_records 表，关联 task_id/episode_id/stage_no | | | | |

### Layer 2：前端交互能力补足

| # | 任务 | 负责 Agent | 依赖 | 预估 | 优先级 |
|---|------|-----------|------|------|--------|
| F1 | **NLE 时间轴 clip 拖拽 + 裁切** | 人审入口 Agent | S2 | 6h | P0 |
|    | nle-timeline.tsx 增加：(1) clip mousedown→mousemove→mouseup 拖拽，约束 track 内移动 (2) 左右边缘 trim handle，最小 0.5s (3) 拖拽/裁切后调用 updateAudioClip 持久化 (4) fade 自动截断逻辑 | | | | |
| F2 | **任务锁定 UI + "由 XX 处理中"** | 人审入口 Agent | B2 | 2h | P0 |
|    | 进入审核页时调用 claim API；显示锁定者和剩余时间；超时自动释放；其他用户看到只读提示 | | | | |
| F3 | **409 冲突恢复** | 人审入口 Agent | B5 | 1.5h | P1 |
|    | updateAudioClip/updateTrackSettings 捕获 409 响应；toast 提示"其他用户已修改"；自动重新加载 timeline 数据 | | | | |
| F4 | **review_point 多 category 支持** | 人审入口 Agent | — | 1h | P1 |
|    | Final 页 handleApprove 改为发送全部 categories（不只 [0]）；issue_type 用逗号分隔或改为数组 | | | | |
| F5 | **Stage 4 步骤隐藏** | 人审入口 Agent | — | 1h | P1 |
|    | 非当前步骤折叠显示，当前步骤展开；避免审核员误操作非当前步骤 | | | | |
| F6 | **错误恢复 + 乐观更新回滚** | 人审入口 Agent | — | 2h | P2 |
|    | 替换所有 .catch(() => {}) 为正确的状态回滚 + 用户提示 | | | | |
| F7 | **Undo/Redo 缓冲区** | 人审入口 Agent | F1 | 3h | P2 |
|    | 时间轴编辑操作加入 undo stack；Ctrl+Z / Ctrl+Shift+Z 快捷键 | | | | |

### Layer 3：集成与验证

| # | 任务 | 负责 Agent | 依赖 | 预估 | 优先级 |
|---|------|-----------|------|------|--------|
| I1 | **Stage 3 编辑 → N22 固化 E2E** | 全员 | B1, F1 | 2h | P0 |
|    | 端到端验证：Stage 3 审核员调整音量/fade → approve → N22 读取编辑并固化 → 产物包含调整后的音频 | | | | |
| I2 | **并发编辑 E2E** | 全员 | B2, B5, F2, F3 | 2h | P1 |
|    | 两个浏览器窗口同时编辑同一 ReviewTask → 第二个写入触发 409 → 正确恢复 | | | | |
| I3 | **打回→重跑→新版本 E2E** | 全员 | B3, B4 | 3h | P1 |
|    | 成片审核打回 → 归因到 N14 → 自动生成重跑计划 → 新 episode_version v2 → 审核页显示版本对比 | | | | |

## Agent 分工总览

| Agent | Layer 0 | Layer 1 | Layer 2 | Layer 3 |
|-------|---------|---------|---------|---------|
| **主控 Agent** | S1~S6 (spec 修正) | — | — | 验收 |
| **编排运行时 Agent** | — | B1, B2, B4, B5, B6, B7 | — | I1, I2 |
| **回炉与版本 Agent** | — | B3 | — | I3 |
| **人审入口 Agent** | — | — | F1~F7 | I1, I2, I3 |

## 工时估算

| 层级 | 任务数 | 总预估 |
|------|--------|--------|
| Layer 0 (Spec) | 6 | ~2.5h |
| Layer 1 (Backend) | 7 | ~16h |
| Layer 2 (Frontend) | 7 | ~16.5h |
| Layer 3 (Integration) | 3 | ~7h |
| **合计** | **23** | **~42h** |

## 执行顺序建议

```
Day 1: S1~S6 (主控) + B1 + B2 (编排) + F1 开始 (人审)
Day 2: B3 (回炉) + B4 + B5 (编排) + F1 完成 + F2 + F3 (人审)
Day 3: B6 + B7 (编排) + F4~F6 (人审) + I1 (集成)
Day 4: F7 (人审) + I2 + I3 (集成) + 全量回归
```

## 不在本轮范围

以下能力明确推迟到 MVP-1：
- T10 角色与权限（含合作方脱敏实现）
- T11 埋点与统计
- 双制式（横屏+竖屏）输出
- RAG/Reflection 闭环
- 真实 GPU ComfyUI 节点测试（N07/N10/N14）
