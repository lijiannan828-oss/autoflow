# AutoFlow v2.2 — 前端开发 Phase 计划

> **版本**：v1.0 | **日期**：2025-03-09
> **基于**：`docs/raw_doc/human-AI` 需求规格书
> **替代**：`03-new-work-agent-division.md` 中的 F1-F15 任务（已更新为 Phase 0-3 结构的 3 天冲刺）
> **原则**：现有页面（`/admin/*`、`/review/*`、`/tasks`）保持不动，新系统独立路由树
> **注意**：Phase 0-3 是优先级分层，非独立时间段。3 天冲刺安排见 `03-new-work-agent-division.md`

---

## 优先级分层（3天冲刺压入）

| Phase | 优先级 | 核心目标 | 3天冲刺安排 |
|-------|--------|----------|------------|
| **Phase 0** | 最高 | 看懂系统在干什么，验收每个 Agent | **Day 1** |
| **Phase 1** | 高 | 监控系统运行状况，调优 prompt | **Day 2** |
| **Phase 2** | 中 | 完整的审核工作流 | **Day 3 上半** |
| **Phase 3** | 后续 | 深度理解和持续优化 | **Day 3 下半（骨架）+ 后续迭代** |

---

## Phase 0 — 看懂系统（11天）

> **目标**：调试编码阶段，需要看到每个 Agent 的决策过程，快速调试节点

### P0-1. 登录骨架（2天）

**路由**：`/login`
**API 依赖**：`POST /api/auth/login` + `GET /api/auth/me` — 🆕 需新建

**功能清单**：
- [ ] 登录页 UI（飞书 SSO 按钮 + 合作方账号表单）
- [ ] JWT token 管理（存 cookie，httpOnly）
- [ ] 鉴权中间件 `middleware.ts`（路由守卫 + 角色权限矩阵）
- [ ] 全局 Layout（左侧导航栏 + 角色过滤可见项）
- [ ] 登出 + token 过期自动跳转

**新建文件**：
```
frontend/app/(auth)/login/page.tsx
frontend/app/(main)/layout.tsx            # 带侧边栏的主布局
frontend/middleware.ts                     # 鉴权中间件
frontend/lib/auth.ts                      # JWT 工具
frontend/app/api/auth/login/route.ts
frontend/app/api/auth/me/route.ts
```

**阻塞关系**：阻塞全部后续页面

---

### P0-2. E2E 单集追踪（4天）

**路由**：`/pipeline/trace/:episodeId`
**API 依赖**：`GET /api/pipeline/trace/:episodeId` — 🔧 需升级 node-trace

**功能清单**：
- [ ] 节点时间线可视化（N01→N26 横向/纵向流程图）
- [ ] 每个节点可展开查看 Agent 三层决策（策划 plan → 执行 execute → 复盘 review）
- [ ] 耗时/成本 waterfall 图
- [ ] 产物缩略图预览（点击放大 + TOS presigned URL）
- [ ] QC 分数标注（通过/未通过高亮）
- [ ] 节点间数据流向箭头（context 传递可视化）

**新建文件**：
```
frontend/app/(main)/pipeline/trace/[episodeId]/page.tsx
frontend/app/api/pipeline/trace/[episodeId]/route.ts
frontend/components/pipeline/node-timeline.tsx
frontend/components/pipeline/decision-chain.tsx
frontend/components/pipeline/cost-waterfall.tsx
```

**技术要点**：
- 流程图建议使用 `reactflow` 或自绘 SVG
- 三层决策用 Accordion 展开/收起（plan 展示全集计划，execute 按镜头列表，review 展示复盘分析）
- 可复用现有 `/admin/drama/[id]` 部分逻辑

---

### P0-3. 节点调试面板升级（2天）

**路由**：`/debug`（首页）
**API 依赖**：`POST /api/debug/run-node` — 已有，需确认功能完整性

**功能清单**：
- [ ] 快速场景测试：选择 node_id + 填入输入参数 → 直接运行单节点
- [ ] 对比运行：同一输入，两个 prompt 版本并行运行，结果对比展示
- [ ] 运行历史列表 + 结果缓存
- [ ] 输入模板（预设常用测试场景）

**新建文件**：
```
frontend/app/(main)/debug/page.tsx
frontend/components/debug/node-runner.tsx
frontend/components/debug/compare-view.tsx
```

**可复用**：现有 `/admin/debug` 的骨架

---

### P0-4. Agent 中心（3天）

**路由**：`/agents`（团队总览）+ `/agents/:agentName`（Profile）
**API 依赖**：
- `GET /api/agents` — 🔧 需升级
- `GET /api/agents/:name/profile` — 🆕 需新建
- `GET /api/agents/:name/decisions` — 🔧 需升级

**功能清单**：
- [ ] Agent 团队总览页：10 个 Agent 卡片网格（状态指示灯 + 核心指标）
- [ ] Agent Profile 详情页：
  - 能力画像（质量/速度/成本/成功率 四维趋势图）
  - 当前策略（active prompt 版本 + genre adapter 列表）
  - 记忆摘要（lessons + preferences 列表）
  - 最近决策时间线
- [ ] Agent 三层决策详情弹窗（按 plan/execute/review 分 Tab）

**新建文件**：
```
frontend/app/(main)/agents/page.tsx
frontend/app/(main)/agents/[agentName]/page.tsx
frontend/app/api/agents/route.ts
frontend/app/api/agents/[name]/profile/route.ts
frontend/app/api/agents/[name]/decisions/route.ts
frontend/components/agents/agent-card.tsx
frontend/components/agents/capability-radar.tsx
frontend/components/agents/decision-timeline.tsx
```

---

## Phase 1 — 监控运行（12天）

> **目标**：管线能跑了，需要实时监控运行状况，调优 prompt

### P1-1. 生产大盘（3天）

**路由**：`/pipeline`（首页即生产大盘）
**API 依赖**：
- `GET /api/pipeline/dashboard` — 🔧 需升级
- `WS /ws/activity-stream` 或 `GET /api/pipeline/activity` — 🆕 需新建

**功能清单**：
- [ ] 北极星指标卡片（产量、质量、成本、效率）
- [ ] 节点状态分布饼图/条形图
- [ ] 活跃流水线进度列表
- [ ] 实时活动流（SSE/WebSocket，事件卡片滚动）
- [ ] 成本红线仪表盘（当前 ¥/min vs 30¥/min 预算线）
- [ ] 项目卡片列表（点击进入项目总览）

**新建文件**：
```
frontend/app/(main)/pipeline/page.tsx
frontend/app/api/pipeline/dashboard/route.ts
frontend/app/api/pipeline/activity/route.ts
frontend/components/pipeline/north-star-cards.tsx
frontend/components/pipeline/activity-stream.tsx
frontend/components/pipeline/budget-gauge.tsx
```

### P1-2. 项目总览（含在 P1-1 中）

**路由**：`/pipeline/:projectId`
**API 依赖**：`GET /api/pipeline/:projectId` — 🆕 需新建

### P1-3. 成本仪表盘（2天）

**路由**：`/resources`（首页即成本仪表盘）
**API 依赖**：`GET /api/resources/cost-summary` — 🔧 需升级

**功能清单**：
- [ ] 总成本趋势折线图（日粒度）
- [ ] 按 Agent / 按节点 / 按剧集分组环形图
- [ ] 预算红线标注 + 超标预警列表
- [ ] 成本异常检测（spike 高亮）

**新建文件**：
```
frontend/app/(main)/resources/page.tsx
frontend/app/api/resources/cost-summary/route.ts
frontend/components/resources/cost-trend-chart.tsx
frontend/components/resources/cost-breakdown.tsx
```

### P1-4. GPU 资源监控（2天）

**路由**：`/resources/gpu`
**API 依赖**：`GET /api/resources/gpu-status` — 🆕 需新建

**功能清单**：
- [ ] 8 卡 GPU 状态网格（显存/利用率/温度/当前任务）
- [ ] 模型部署映射（每张卡上跑着哪些模型）
- [ ] 10 秒自动刷新
- [ ] 历史利用率曲线

**新建文件**：
```
frontend/app/(main)/resources/gpu/page.tsx
frontend/app/api/resources/gpu-status/route.ts
frontend/components/resources/gpu-card.tsx
frontend/components/resources/gpu-memory-bar.tsx
```

### P1-5. 异常与优秀发现（2天）

**路由**：`/pipeline/highlights`
**API 依赖**：`GET /api/pipeline/highlights` — 🆕 需新建

**功能清单**：
- [ ] 异常事件卡片流（超时、失败、QC异常低分、成本spike）
- [ ] 优秀案例卡片流（高分镜头、高效节点）
- [ ] 筛选器（类型、严重程度、时间范围）
- [ ] 点击跳转到 E2E 追踪对应节点

**新建文件**：
```
frontend/app/(main)/pipeline/highlights/page.tsx
frontend/app/api/pipeline/highlights/route.ts
frontend/components/pipeline/highlight-card.tsx
```

### P1-6. Prompt Playground（3天）

**路由**：`/debug/prompt-playground`
**API 依赖**：`POST /api/debug/prompt-playground` — 🆕 需新建

**功能清单**：
- [ ] 左右分栏：左侧 prompt 编辑器（system + user），右侧结果展示
- [ ] 模板变量替换（{{genre}}、{{scene_type}} 等）
- [ ] 参数调节（temperature、max_tokens）
- [ ] 运行历史 + 结果对比
- [ ] 一键导入现有 prompt_asset

**新建文件**：
```
frontend/app/(main)/debug/prompt-playground/page.tsx
frontend/app/api/debug/prompt-playground/route.ts
frontend/components/debug/prompt-editor.tsx
frontend/components/debug/result-viewer.tsx
```

---

## Phase 2 — 审核工作流（13天）

> **目标**：有内容需要人审了，需要完整的审核工作流

### P2-1. 我的任务（3天）

**路由**：`/tasks`
**API 依赖**：`GET /api/tasks` — 🔧 需升级（增加 role/status/gate 过滤）

**功能清单**：
- [ ] 个人统计条（待审核/生成中/已完成/今日审核时长）
- [ ] 任务卡片流（缩略图 + 剧名/集名 + Gate标签 + 状态）
- [ ] 左侧快速过滤（按 Gate、状态、优先级）
- [ ] 角色差异化：
  - 质检专员看 Gate2+Gate3+Gate4-Step1
  - 剪辑中台看 Gate1+Gate3+Gate4-Step2
  - 合作方看 Gate4-Step3
  - 管理员看全部（带角色筛选器）
- [ ] 点击任务卡 → 进入对应审核页面

**新建文件**：
```
frontend/app/(main)/tasks/page.tsx
frontend/app/api/tasks/route.ts
frontend/components/tasks/task-card.tsx
frontend/components/tasks/task-filters.tsx
frontend/components/tasks/personal-stats-bar.tsx
```

### P2-2. Gate1 美术资产审核（2天）

**路由**：`/tasks/:taskId/review`（当 gate_node_id=N08 时渲染 Gate1 组件）
**API 依赖**：已有 `review-task-detail` + `review-approve` + `review-return`

**功能清单**：
- [ ] 角色设计稿左右对比（参考图 vs AI 生成）
- [ ] 场景图网格浏览 + 放大查看
- [ ] 风格一致性检查清单
- [ ] 自然语言批注输入 → Dispatcher 解析（复用现有 dispatch-annotation）
- [ ] 通过/打回/跳过按钮组

**新建文件**：
```
frontend/app/(main)/tasks/[taskId]/review/page.tsx      # 动态路由，根据 gate 渲染不同组件
frontend/components/review/gate1-art-review.tsx
frontend/components/review/image-compare.tsx
frontend/components/review/annotation-input.tsx
```

### P2-3. Gate2 视觉素材审核（3天）

**路由**：`/tasks/:taskId/review`（当 gate_node_id=N18 时）
**API 依赖**：已有 + `review-stage2-summary`

**功能清单**：
- [ ] 镜头级聚合展示（多镜头网格 + 单镜头详情）
- [ ] 视频预览播放器 + 帧级截图
- [ ] 角色一致性对比（参考图 vs 镜头中人物）
- [ ] 批量通过/逐镜头标注
- [ ] QC 自动检测结果展示（来自 N15 QC 节点）

**新建文件**：
```
frontend/components/review/gate2-visual-review.tsx
frontend/components/review/shot-grid.tsx
frontend/components/review/video-player.tsx
frontend/components/review/character-compare.tsx
```

### P2-4. Gate3 视听整合审核（3天）

**路由**：`/tasks/:taskId/review`（当 gate_node_id=N21 时）
**API 依赖**：已有 + `review-stage3-summary`

**功能清单**：
- [ ] 多轨波形时间线（视频 + 对白 + BGM + SFX）
- [ ] 视频预览（同步字幕）
- [ ] 音画同步检查工具
- [ ] 对白 vs 原始剧本对照
- [ ] 各轨道单独静音/solo 控制

**新建文件**：
```
frontend/components/review/gate3-av-review.tsx
frontend/components/review/waveform-timeline.tsx
frontend/components/review/subtitle-sync.tsx
```

**技术要点**：波形渲染建议使用 `wavesurfer.js`

### P2-5. Gate4 成片终审（2天）

**路由**：`/tasks/:taskId/review`（当 gate_node_id=N24 时）
**API 依赖**：已有 + `review-stage4-summary`

**功能清单**：
- [ ] 三步串行审核流程指示器（Step 1→2→3，当前步骤高亮）
- [ ] 全集完整预览播放器
- [ ] Supervisor 合规检查清单（自动展示）
- [ ] 角色差异化：
  - Step 1 质检专员：技术质量 checklist
  - Step 2 剪辑中台：叙事节奏 + 剪辑评估
  - Step 3 合作方：脱敏版（隐藏技术参数），简化为"通过/打回+批注"
- [ ] 打回时自动生成 ReturnTicket

**新建文件**：
```
frontend/components/review/gate4-final-review.tsx
frontend/components/review/step-indicator.tsx
frontend/components/review/full-episode-player.tsx
frontend/components/review/compliance-checklist.tsx
```

---

## Phase 3 — 深度优化（21天）

> **目标**：系统稳定运行后，深度理解和持续优化

### P3-1. Evolution 日报（2天）

**路由**：`/evolution`（首页）
**API 依赖**：`GET /api/evolution/daily-report` — 🆕

### P3-2. Prompt 版本管理（3天）

**路由**：`/evolution/prompts` + `/evolution/prompts/:id`
**API 依赖**：`GET /api/evolution/prompts` (升级版) + `GET /api/evolution/prompts/:id` — 🆕

**功能清单**：
- [ ] 三级分类导航（System → Task → GenreAdapter）
- [ ] Prompt 列表（版本号、锁定状态、质量分数）
- [ ] Prompt 详情：当前文本 + 版本历史 Diff 视图
- [ ] Genre Adapter 管理

### P3-3. RAG 知识库浏览（2天）

**路由**：`/evolution/rag`
**API 依赖**：`GET /api/evolution/rag` — ✅ 已有

### P3-4. LoRA 训练日志（1天）

**路由**：`/evolution/lora`
**API 依赖**：`GET /api/evolution/lora-status` — 🆕（预留）

### P3-5. Agent 协作关系图（2天）

**路由**：`/agents/collaboration`
**API 依赖**：`GET /api/agents/collaboration` — 🆕

### P3-6. 模型对比评测（2天）

**路由**：`/debug/model-compare`
**API 依赖**：`POST /api/debug/model-compare` — 🆕

### P3-7. AI 助手（3天）

**路由**：全局浮动组件（所有页面可呼出）
**API 依赖**：`POST /api/assistant/chat` — 🆕

### P3-8. 审核效率排行（1天）

**路由**：`/pipeline` 子组件（嵌入生产大盘）
**API 依赖**：从 `review_tasks` 聚合

### P3-9. 健康度大屏（1天）

**路由**：`/health`（无需登录，内网访问）
**API 依赖**：`GET /api/health` — 🆕

### P3-10. API 用量（1天）

**路由**：`/resources/api`
**API 依赖**：`GET /api/resources/api-usage` — 🆕

### P3-11. 系统设置（3天）

**路由**：`/settings/projects` + `/settings/users` + `/settings/notifications`
**API 依赖**：`/api/settings/*` — 🆕（6个端点）

---

## 前端目录结构总览

```
frontend/app/
├── (auth)/                            # 无侧边栏的鉴权路由组
│   └── login/page.tsx                 # Phase 0
│
├── (main)/                            # 带侧边栏的主路由组
│   ├── layout.tsx                     # 全局 Layout（导航+角色过滤）
│   │
│   ├── tasks/                         # Phase 2
│   │   ├── page.tsx                   # 我的任务
│   │   └── [taskId]/
│   │       └── review/page.tsx        # 动态审核页（Gate1/2/3/4）
│   │
│   ├── pipeline/                      # Phase 0-1
│   │   ├── page.tsx                   # 生产大盘 (Phase 1)
│   │   ├── [projectId]/page.tsx       # 项目总览 (Phase 1)
│   │   ├── trace/[episodeId]/page.tsx # E2E追踪 (Phase 0)
│   │   └── highlights/page.tsx        # 异常发现 (Phase 1)
│   │
│   ├── agents/                        # Phase 0
│   │   ├── page.tsx                   # Agent团队总览
│   │   ├── [agentName]/page.tsx       # Agent Profile
│   │   └── collaboration/page.tsx     # 协作图 (Phase 3)
│   │
│   ├── evolution/                     # Phase 3
│   │   ├── page.tsx                   # Evolution日报
│   │   ├── prompts/
│   │   │   ├── page.tsx               # Prompt列表
│   │   │   └── [id]/page.tsx          # Prompt详情+Diff
│   │   ├── rag/page.tsx               # RAG知识库
│   │   └── lora/page.tsx              # LoRA日志
│   │
│   ├── resources/                     # Phase 1
│   │   ├── page.tsx                   # 成本仪表盘
│   │   ├── gpu/page.tsx               # GPU监控
│   │   └── api/page.tsx               # API用量 (Phase 3)
│   │
│   ├── debug/                         # Phase 0-1
│   │   ├── page.tsx                   # 节点调试面板 (Phase 0)
│   │   ├── prompt-playground/page.tsx # Prompt Playground (Phase 1)
│   │   └── model-compare/page.tsx     # 模型对比 (Phase 3)
│   │
│   └── settings/                      # Phase 3
│       ├── projects/page.tsx
│       ├── users/page.tsx
│       └── notifications/page.tsx
│
├── health/page.tsx                    # Phase 3（无需登录）
│
├── api/                               # API Route Handlers
│   ├── auth/...                       # Phase 0
│   ├── tasks/...                      # Phase 2
│   ├── pipeline/...                   # Phase 0-1
│   ├── agents/...                     # Phase 0
│   ├── evolution/...                  # Phase 3
│   ├── resources/...                  # Phase 1
│   ├── debug/...                      # Phase 0-1
│   ├── settings/...                   # Phase 3
│   ├── assistant/...                  # Phase 3
│   ├── health/...                     # Phase 3
│   └── orchestrator/...               # ← 现有 API，保持不动
│
├── admin/...                          # ← 现有页面，保持不动
├── review/...                         # ← 现有页面，保持不动
└── tasks/...                          # ← 现有任务看板，保持不动
```

---

## 与主控 Agent 的协作依赖

| 前端 Phase | 主控需提前完成的后端工作 | 状态 |
|---|---|---|
| Phase 0 | `users` + `sessions` 表迁移、auth_api.py、agent-profile/decisions 升级 | ⏳ 待做 |
| Phase 1 | pipeline_api.py（dashboard/trace 升级）、gpu-status 代理、SSE 活动流 | ⏳ 待做 |
| Phase 2 | review-tasks 增加 role 过滤、prompt-assets 升级 | ⏳ 待做 |
| Phase 3 | settings_api.py、assistant_api.py、lora-status、collaboration 数据 | ⏳ 待做 |

**注意**：前端每个 Phase 可先用 mock 数据开发 UI，后端 API 就绪后切换为真实数据。API 合同详见 `docs/v2.2-frontend-api-contract.md`。
