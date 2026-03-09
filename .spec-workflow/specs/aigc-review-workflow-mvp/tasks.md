# AIGC短剧生产线（MVP）— 审核工作流 · 实现任务

## 文档信息

- **Spec 名称**：aigc-review-workflow-mvp
- **依赖**：requirements.md, design.md

以下任务按实现顺序排列，可在实施时勾选并拆分为更细的子任务。

---

## 任务列表

> 范围说明：
> 本任务列表仅覆盖审核工作流消费层，不覆盖 core orchestrator 的编排、运行态、回炉、成本、质量、吞吐与 Reflection 主线。
> 任何涉及核心真相源的改动，应先回到 `aigc-core-orchestrator-platform` 更新，再由本 spec 消费其 DTO/API。

- [x] **T1 基础结构与数据模型**  
  - 创建 Project/Series、Episode、StageTask、Asset、Variant、Shot、Timeline、ReviewPoint、ReviewDecision、RevisionLog、AuditLog 的持久化模型与迁移（或对接现有库表）。  
  - 子任务拆解：  
    1) 定义枚举（stage/task_status/priority_group/severity/attribution_stage）。  
    2) 建立主干表（projects/series/episodes/stage_tasks）与唯一约束。  
    3) 建立内容表（assets/variants/shots/timelines/timeline_clips）。  
    4) 建立审阅追溯表（review_points/review_decisions/revision_logs/audit_logs）。  
    5) 增加关键索引（任务排序、锁定扫描、版本检索、审计检索）。  
    6) 输出 ER 图与字段字典（供前后端联调）。  
    7) 提供最小接口桩：任务面板查询、节点基础详情查询。  
  - 交付物：  
    - `migrations/*`：建表与索引迁移脚本  
    - `schema/*`：实体定义与枚举  
    - `docs/data-dictionary.md`：字段字典与约束说明  
    - `docs/er-diagram.md`：ER 关系图  
    - `tests/*`：约束与锁机制基础测试  
  - _Requirements_: US-29, §5 数据对象  
  - _Leverage_: design.md §2, §9; data-structures.md 全文  
  - 完成说明：  
    - 已完成数据库 `autoflow` 创建与 schema 落地（`sql/init_autoflow_schema.sql`）。  
    - 已补齐迁移入口（`migrations/001_init_autoflow_schema.sql`）。  
    - 已补齐 schema 枚举定义（`schema/enums.sql`）。  
    - 已补齐字段字典与 ER 图（`docs/data-dictionary.md`、`docs/er-diagram.md`）。  
    - 已补齐最小接口桩文档（`docs/api-stubs.md`）。  
    - 已补齐并执行基础约束测试（`tests/t1_constraints.sql`，执行通过）。  

- [x] **T2 任务面板与优先级**  
  - 实现首页任务面板：分组（紧急驳回/质检中/新剧待检/生成中）、全局摘要、任务卡片列表、排序规则（MVP 写死）、「处理/继续」入口。  
  - _Requirements_: US-1～US-5  
  - _Leverage_: design.md §3.1, §4
  - 完成说明（截至 2026-03-09）：  
    - 任务面板已接通真实任务数据（`frontend/app/tasks/page.tsx` + `frontend/lib/review-api.ts`）。  
    - 已实现泳道分组、全局摘要、搜索/排序、处理入口与 30s 自动刷新。  
    - 后端消费路径统一通过 review gateway BFF 路由。  

- [ ] **T3 任务锁定与释放**  
  - 实现领取/锁定（claim）、超时自动释放、只读与「由 XX 处理中」提示。  
  - _Requirements_: US-28  
  - _Leverage_: design.md §2.2, §3.1
  - 当前主阻塞（截至 2026-03-09）：  
    - review_tasks 维度尚未形成 claim/lock/release 的完整后端接口闭环。  
    - 前端“由 XX 处理中”提示与超时自动释放策略未完成端到端联动。  

- [ ] **T4 节点1 — 美术资产审核页（进行中，高完成）**  
  - 流程步进条、左侧导航、资产 4 版候选与定稿、右侧自然语言反馈（调接口）、配音音色确认（调接口）、全部确认校验与提交。  
  - _Requirements_: US-6～US-11, DoD 节点1  
  - _Leverage_: design.md §3.2, §4
  - 进展说明（截至 2026-03-09）：  
    - 页面已接真实 API，支持锁图、反馈再生成、批量通过（`frontend/app/review/art-assets/page.tsx`）。  
    - 当前缺口：配音音色确认等节点1扩展能力尚未形成完整闭环。  

- [ ] **T5 节点2 — 视觉素材审核页（进行中，高完成）**  
  - 分镜/镜头列表、关键帧与视频候选、时间轴默认、修改建议与作用范围、通过/打回（镜头级与分集级）、低分「需关注」与备注。  
  - _Requirements_: US-12～US-17, DoD 节点2  
  - _Leverage_: design.md §3.3, §4；模型相关调现有接口
  - 进展说明（截至 2026-03-09）：  
    - 已完成 shot 级任务消费、候选应用、逐镜头/批量审批、时间轴联动（`frontend/app/review/visual/page.tsx`）。  
    - 当前缺口：低分“需关注”规则与归因细则仍需补强。  

- [ ] **T6 节点3 — 视听整合审核页（进行中，高完成）**  
  - 多轨时间轴（配音/音效/音乐）、素材库、替换/微调/音量/淡入淡出、自动提示、本集通过与打回（归属+理由必填）。  
  - _Requirements_: US-18～US-21, DoD 节点3  
  - _Leverage_: design.md §3.4, §4
  - 进展说明（截至 2026-03-09）：  
    - 已支持多轨时间轴、音量/淡入淡出、素材替换与通过动作（`frontend/app/review/audiovisual/page.tsx`）。  
    - 当前缺口：打回时“归属+理由必填”的强校验与后端约束尚需补齐。  
  - 收口子任务（新增）：  
    - [ ] T6.1 时间轴命令白名单（move/trim/replace/volume/fade/delete）与参数边界校验。  
    - [ ] T6.2 时间轴保存持久化与刷新回显一致性验收。  
    - [ ] T6.3 `timeline_revision` 冲突检测（409）与前端冲突提示。  
    - [ ] T6.4 打回时“归属+理由”前后端双重必填校验。

- [ ] **T7 节点4 — 成片合成审核页（进行中，高完成）**  
  - 成片播放、修订记录与历史版本、时间戳审阅打点与问题归属、驳回修改（至少 1 打点或说明）、多方审核顺序与状态展示；合作方脱敏。  
  - _Requirements_: US-22～US-27, DoD 节点4  
  - _Leverage_: design.md §3.5, §4, §5
  - 进展说明（截至 2026-03-09）：  
    - 已支持 N24 串行步骤展示、时间戳打点、通过/驳回与 stage4 汇总联动（`frontend/app/review/final/page.tsx`）。  
    - 当前缺口：历史版本对比与合作方脱敏策略仍需继续收口。  

- [ ] **T8 打回归因与版本**  
  - 节点4 打回选归属并触发回炉；节点2/3 打回与可选上游归因；新版本号与 RevisionLog、历史版本回放/对比。  
  - _Requirements_: US-24, US-29, US-31  
  - _Leverage_: design.md §2.2, §5

- [ ] **T9 自然语言反馈结构化**  
  - 全节点统一：scope、severity、anchor、note 落库并驱动重生成/修订接口。  
  - _Requirements_: US-30  
  - _Leverage_: design.md §2.3

- [ ] **T10 角色与权限**  
  - 质检员/剪辑中台/合作方权限与可见范围；合作方仅节点4 且脱敏；操作前校验。  
  - _Requirements_: §2, US-27  
  - _Leverage_: design.md §6
  - 收口子任务（新增）：  
    - [ ] T10.1 节点3编辑权限矩阵落库（按角色+任务态控制）。  
    - [ ] T10.2 合作方接口脱敏字段清单与契约测试。

- [ ] **T11 埋点与统计**  
  - 任务维度、内容质量维度、交付维度埋点与统计（MVP 必须）。  
  - _Requirements_: §6  
  - _Leverage_: design.md §3.6

- [ ] **T12 Review Gateway DTO/API 对齐（进行中，高完成）**  
  - 对齐 core orchestrator 的 `ReviewTask / ReviewPoint / ReturnTicket / RevisionLog / Stage Summary` 派生 DTO。
  - 清理审核页面对底层表结构的直接假设，统一通过 Gateway/BFF 消费。
  - 明确 `StageTask` 是页面态/兼容态，不再反向要求 core 以它为唯一真相源。
  - _Requirements_: §1.3, §5  
  - _Leverage_: design.md §1.1, §7, §8
  - 进展说明（截至 2026-03-09）：  
    - 已形成统一消费层：`frontend/lib/review-api.ts` + `frontend/lib/review-adapters.ts` + `frontend/app/api/orchestrator/review/*`。  
    - 审核页面已优先消费 gateway DTO，不再直接依赖底层表结构。  
    - 当前缺口：部分 payload 假设与 fallback 分支仍待进一步收敛。  
  - 收口子任务（新增）：  
    - [ ] T12.1 节点3时间轴 DTO 增加 `timeline_revision` 并前后端贯通。  
    - [ ] T12.2 节点3冲突错误码规范（409 + latest snapshot）与文档示例。  

---

*完成 T1～T12 并满足 requirements 中 DoD，即视为审核工作流消费层 MVP 验收通过。*
