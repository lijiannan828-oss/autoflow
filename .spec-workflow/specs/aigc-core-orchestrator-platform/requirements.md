# AIGC 短剧生产线（V1）— 核心产线与超管系统 · 需求规格

## 文档信息

| 项 | 值 |
|---|---|
| Spec 名称 | aigc-core-orchestrator-platform |
| 文档版本 | v2.2（对齐 Pipeline v2.2 多智能体架构） |
| 产品范围 | 自研：28 执行节点编排（LangGraph + Multi-Agent，含 N07b/N16b）、回炉归因、数据中心、绩效、大盘、调试、网关 |
| 非范围 | 员工端 4 审核页实现（外包），但自研需提供 Review Gateway DTO/API |
| 核心目标 | 90% 自动化，人只做审核；系统可自动归因并最小重跑 |

---

## 1. 背景与目标

### 1.1 背景

- 现有 specs 主要覆盖员工审核端（任务面板 + 4 审核关卡）。
- 系统真正核心是自动化生产管线：多智能体协作执行 + 人工 Gate 放行 + 打回回炉。
- 当前需要补齐"可运行、可追溯、可统计、可观测"的自研主系统 specs。

### 1.2 业务目标

1. 以剧/集为单位，构建 LangGraph 驱动的多智能体编排流水线。
2. 任意打回都能定位"节点 + 对象锚点（资产/镜头/时间戳）"，并自动生成最小重跑计划。
3. 每次回炉都产生新版本，并沉淀修订总结。
4. 成本/效率/质量全链路可归因、可预警、可复盘。
5. 整个 20+ 节点生产链路中，仅保留 4 个关键人工审核节点，其余环节尽量自动化执行。
6. 系统必须支持横屏与竖屏双制式输出，且双制式约束应在产线内被显式建模，而不是依赖最终人工兜底。
7. 每一次人类反馈都必须进入 RAG / Reflection 进化闭环，持续优化提示词、工作流、路由与质检阈值。
8. 系统需要从 MVP 期就为规模化产能做准备：初期支持单日 300 分钟，最终目标单日 2000+ 分钟。

### 1.3 北极星指标（系统内必须可计算）

| 指标 | 目标 |
|---|---|
| 单集（50~60s）端到端平均耗时（含回炉） | 持续下降 |
| 平均回炉轮次（按节点、按原因） | 持续下降 |
| 单分钟综合成本（模型/API/GPU/人力估算） | 红线 30 元/分钟 |
| 单日产能（分钟） | MVP 起步 300，最终 2000+ |
| 节点瓶颈 Top3 分布 | 可视化 |
| 节点4合作方驳回率 | 持续下降 |
| 人工介入时长占比 | ≤10% |
| Stage2 shot 一次通过率 | 持续上升 |
| 角色一致性 / 音画同步 / 连续性质量分 | 可量化、可追踪 |
| 人类反馈沉淀率（进入知识库/Reflection 的比例） | 持续上升 |

### 1.4 核心约束

1. `aigc-core-orchestrator-platform` 是核心业务真相源，负责定义编排、运行态、回炉、版本、成本、质量、调度与运营核心对象。
2. `aigc-review-workflow-mvp` 仅负责审核人员工作流、审核页面、审核 DTO/API 交互与权限边界；若两套 spec 冲突，以 core spec 为准。
3. 当前阶段允许受控保留部分闭源模型/API 调用，但必须明确用途、输入数据边界、替代计划，且不得成为不可替代的核心真相源。
4. 成本、质量、吞吐、审核团队运营、双制式输出、RAG/Reflection 不是可永久后置项；即便不在 MVP-0 全量实现，也必须在 spec 与任务规划中有明确主线。

---

## 2. 范围定义

### 2.1 自研范围（In Scope）

1. **Orchestrator（LangGraph + Multi-Agent）**：Supervisor（横切守卫，合并原 Cost Controller + PM Agent）中央调度 + 7 生产 Agent + 1 Evolution Engine + 28 节点编排（含 N07b、N16b）。
2. **RCA + Retry**：ReturnTicket、归因规则、最小重跑计划、自动重跑。
3. **RAG 知识库**：**Qdrant** 向量库（替代 Chroma）+ 链路级 RAG 知识检索服务，为各 Agent 提供上下文（导演参考、历史案例、风格基线等）。
3b. **Agent 记忆系统**：三层记忆（工作记忆 → LangGraph State；项目记忆 → PostgreSQL `agent_memory` 表；长期记忆 → RAG Qdrant + Prompt 资产库）。
3c. **Prompt 资产库**：三层 Prompt 架构（母版 Master Template → 题材适配器 Genre Adapter → 实例适配层 Instance Adapter），支持版本管理与 A/B 测试。
3d. **项目集管理**：`ProjectGroup`（发行平台约束）+ `ProjectRequirements`（项目特殊需求），Supervisor 在关键 checkpoint 校验合规与成本。
4. **ComfyUI 生成集群**：4-8 卡 GPU，模型路由器，图像/视频生成引擎。
5. **Reflection / Feedback Learning**：人类反馈结构化沉淀、好坏案例入库、规则/提示词/工作流回写。
6. **Quality Evaluation**：角色一致性、连贯性、音画同步、最终片综合质量评分体系。
7. **Dual-Format Delivery**：横屏/竖屏双制式约束、出片 profile、safe area、字幕布局与重构图策略。
8. **Reviewer Operations**：审核任务池、SLA、负载均衡、绩效与团队运营能力。
9. **Data Center**：成本/效率/质量采集与分析、AI 诊断。
10. **Performance**：员工质检绩效管理页面及指标。
11. **Ops / Production Board**：全局生产大盘与剧级抽屉。
12. **Node Trace & Runbook**：节点级调试与可观测。
13. **Review Gateway**：脱敏网关，向外包员工端/合作方端暴露 DTO 与接口。
14. **OpenClaw**：人类审核入口与审核任务管理（聊天界面 + Web 时间轴 + 最小干预交互）。

### 2.2 非范围（Out of Scope）

- 外包员工端页面实现（首页任务面板、4 节点审核页面 UI）
- 模型底层训练与微调

### 2.3 设计参考（实现约束）

- 超管类页面以现有设计图和 `frontend/app/admin` 实际页面结构为参考基线。
- specs 的字段与交互定义优先于视觉细节；若视觉稿与 specs 冲突，以 specs 为准并记录差异。

---

## 3. 多智能体架构要求

### 3.1 Agent 角色定义（v2.2 — 10 Agent + 1 框架）

> **精简原则（v2.2）**：消除悬空 Agent、合并串行进化链路（4→1）、统一横切守卫（Cost Controller + PM Agent → Supervisor）。Orchestrator（LangGraph）降级为框架，不调 LLM、不做决策。

#### 3.1.1 生产线 Agent（7 个）

| # | Agent 角色 | 职责 | 主导节点 |
|---|---|---|---|
| 1 | **Script Analyst** | 剧本理解、结构化提取、分集骨架 | N01 |
| 2 | **Shot Designer** | 拆集拆镜、分镜定稿、镜头分级、节奏分析与调整 | N02/N04/N05/N16/N16b |
| 3 | **Visual Director** | 视觉策划 + prompt 工程 + 关键帧/视频生成全链路 | N06/N07/N09/N10/N13/N14/N17/N19 |
| 4 | **Audio Director** | 美术阶段：核心角色音色生成；定稿后：TTS/唇同步/BGM/SFX | N07b/N20/N22 |
| 5 | **Quality Inspector** | 多模型交叉评审、连续性分析、自动打回判定 | N03/N11/N12/N15 |
| 6 | **Compositor** | 时间轴编排、多轨混音、成片合成、分发 | N16b(协作)/N23/N25/N26 |
| 7 | **Review Dispatcher** | 解析人类审核批注，拆分为可执行任务并调度 | N08/N18/N21/N24 |

#### 3.1.2 监督 Agent（1 个）— 横切守卫

| # | Agent 角色 | 职责 | 介入方式 |
|---|---|---|---|
| 8 | **Supervisor** | 成本监控 + 项目需求校验 + 预算分配 + 降级触发 + 合规检查（合并原 Cost Controller + PM Agent） | 横切：每个关键 checkpoint 自动触发（N02/N05/N09/N14/N17/N23） |

#### 3.1.3 进化 Agent（1 个）— 自我进化全链路

| # | Agent 角色 | 职责 | 运行模式 |
|---|---|---|---|
| 9 | **Evolution Engine** | 反思分析 → prompt 进化 → A/B 测试 → RAG 管理 → LoRA 训练（合并原 Reflection + Prompt Evolver + RAG Curator + Style Trainer 四合一） | 每日反思 / 每周进化 / 持续入库 / 按条件训练 |

#### 3.1.4 框架（不计入 Agent）

| 组件 | 职责 |
|---|---|
| **LangGraph Orchestrator** | 状态机调度，纯代码逻辑，不调 LLM，不做决策 |

### 3.2 编排框架

- 采用 **LangGraph** 作为多智能体编排框架（替代纯 Celery DAG）。
- Supervisor Agent 负责任务分发、状态追踪、Gate 挂起/放行、异常处理。
- Worker Agent 接收任务后调用对应模型/工具，返回结构化结果。
- **RocketMQ**（火山引擎托管版）用于异步任务调度（模型回调、重跑触发、Agent 间通信）。所有 Agent 通过 RocketMQ 异步通信。

### 3.3 知识库/RAG 要求

每个 Agent 执行时可检索 RAG 知识库获取上下文：

| 节点 | RAG 输入 |
|---|---|
| N01 剧本提取 | 导演助力方案 + 多段落分析模板 |
| N03 分镜质检 | 穿插题名单 + 历史案例参考 |
| N05 镜头分级 | 导演模板 + 方案参考 |
| N06 视觉元素生成 | 电影级前置规范 + 等级关联元素 |
| N07 美术图生成 | 风格参考图像 + 人物一致性策略 |
| N11 关键帧质检 | 跨帧对比校验规则 |
| N12 连续性检查 | 主剧情上下文联连解读 |
| N14 视频生成 | 动感性映射规则 |
| N16 节奏连续性 | 节奏解码 + 方案参考 |

### 3.4 Agent 即时决策机制（v2.2 新增）

每个 Agent 接到任务时经历五步微型决策循环：
1. **理解上下文** — 读取 ShotSpec/场景/角色 + 项目集约束 + 叙事位置
2. **检索经验** — RAG 召回同类成功案例 + 读取 Agent 记忆（同角色/同场景历史处理经验）
3. **选择策略** — 选 prompt 模板、题材适配器、候选数量、模型切换、成本预算
4. **执行+自检** — 执行生成/分析 → 对输出做 self-check（格式、一致性、上下游衔接）
5. **记录+沉淀** — 完整决策 trace → 高分结果沉淀为记忆

### 3.5 Agent 记忆机制（v2.2 新增）

| 记忆层 | 存储位置 | 生命周期 | 用途 |
|---|---|---|---|
| **工作记忆** | LangGraph State | 单次任务执行期间 | 当前镜头上下文、中间计算结果 |
| **项目记忆** | PostgreSQL `agent_memory` 表 | 项目周期 | "太后角色 ip_adapter 最佳值 0.78"、"本剧夜景需加暖光约束" |
| **长期记忆** | RAG Qdrant + Prompt 资产库 | 永久（跨项目） | 全链路成功案例、prompt 版本历史、风格模式 |

### 3.6 Supervisor 横切守卫 checkpoint（v2.2 新增）

Supervisor 在以下关键 checkpoint 同时校验成本和项目需求：

| 检查点 | 成本校验 | 项目需求校验 |
|---|---|---|
| N02 完成后 | 镜头数→估算总成本 | 时长在平台约束范围内？节奏符合偏好？ |
| N05 完成后 | S2 占比→成本风险评估 | 是否有违反合规红线的内容描述？ |
| N09 完成后 | 美术候选数→成本 | 画风是否符合平台调性？品牌色匹配？ |
| N14/N17 | 实时累计成本 vs 预算 | 分辨率/画幅/编码/时长符合硬约束？ |
| N23 完成后 | 单集总成本结算 | 所有 platform_constraints 满足？水印/disclaimer 正确？ |

---

## 4. 核心对象与状态机要求

### 4.1 顶层对象（必须落库）

| 对象 | 说明 |
|---|---|
| `Project` | 项目（合作方、预算、规则） |
| `Series` | 剧（剧名、题材、风格基线） |
| `Episode` | 集（EP01…，目标时长，版本号） |
| `EpisodeVersion` | 每次回炉/重生成生成新版本（v1/v2/v3…） |
| `NodeRegistry` | 节点定义（编排依据），含 Agent 角色映射 |
| `Run` | 一次"集版本"的流水线运行实例 |
| `NodeRun` | 某次 Run 里某个 Node 的执行实例（含输入输出、耗时、成本、日志） |
| `Artifact` | 产物（资产图、关键帧、视频片段、多轨工程、成片、字幕、音乐台账） |
| `ReviewTask` | 给人看的审核任务（外包端消费） |
| `ReviewPoint` | 时间戳打点（节点 21/24 核心） |
| `ReturnTicket` | 打回单（归因到节点/对象/原因） |
| `RevisionLog` | 修订总结（脱敏后给人看） |

### 4.2 状态机（EpisodeVersion）

```text
CREATED → RUNNING → WAIT_REVIEW_STAGE_X → APPROVED_STAGE_X → … → DELIVERED
任意阶段：RETURNED（打回）→ PATCHING（回炉中）→ 回到对应阶段
```

关键规则：
- 仅当前活跃版本可被推进。
- 打回总是创建新版本执行回炉（不可覆写旧版本）。

### 4.3 状态机（NodeRun）

```text
PENDING → RUNNING → SUCCEEDED | FAILED | CANCELED | SKIPPED
```
- 支持 `RETRYING`（重试中）
- 支持 `PARTIAL`（部分成功，留待人工）

---

## 5. 节点体系（V2 — 对齐实际选型表）

### 5.1 Node Registry 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `node_id` | text | 如 `N01_SCRIPT_EXTRACT` |
| `name` | text | 节点显示名 |
| `stage_group` | text | SCRIPT / STORYBOARD / ART / KEYFRAME / VIDEO / AV / FINAL |
| `agent_role` | text | 主导 Agent 角色 |
| `is_human_gate` | bool | 是否人审关卡 |
| `depends_on` | jsonb | 节点依赖列表 |
| `inputs_schema` | jsonb | 输入 JSON Schema |
| `outputs_schema` | jsonb | 输出 JSON Schema |
| `retry_policy` | jsonb | max_retries / backoff |
| `timeout_s` | int | 超时秒数 |
| `cost_tags` | jsonb | 成本标签 |
| `produces_artifacts` | jsonb | 产物类型列表 |
| `review_mapping` | text | 映射到 Stage1~4 |
| `model_config` | jsonb | 模型端点 / 主备路由 / ComfyUI workflow |
| `rag_sources` | jsonb | RAG 知识库检索配置 |
| `quality_threshold` | jsonb | 质检阈值（如 {min_score: 8.0}） |
| `estimated_duration_s` | int | 预估执行时长 |
| `comfyui_nodes` | jsonb | 使用的 ComfyUI 节点列表 |

### 5.2 节点清单（V2.2 完整 28 节点 — 含 N07b、N16b）

> v2.2 模型策略对齐：v1 阶段以闭源模型为主力（Gemini/Claude/GPT）；自部署开源模型仅作为兜底或后续替换路径，不作为当前主力口径。

#### SCRIPT（剧本阶段）

| # | ID | 名称 | Agent | 模型/工具 | 质检阈值 | 预估时间 |
|---|---|---|---|---|---|---|
| 1 | N01_SCRIPT_EXTRACT | 主剧本提取 | Script Analyst Agent | Gemini 3.1（主）/ Claude Opus 4.6（备） | 完整性 >95% | ~3 min |
| 2 | N02_EPISODE_SHOT_SPLIT | LLM拆集拆镜 | Shot Designer Agent | Gemini 3.1（主）/ Claude Opus 4.6（备） | JSON格式100%正确 | ~4 min |

#### STORYBOARD（分镜阶段）

| # | ID | 名称 | Agent | 模型/工具 | 质检阈值 | 预估时间 |
|---|---|---|---|---|---|---|
| 3 | N03_STORYBOARD_QC | 分镜质量检验 | Quality Inspector Agent | GPT 5.4 + Gemini 3.1 + Claude（多模型） | <8.0 自动打回 N02 | ~4 min |
| 4 | N04_STORYBOARD_FREEZE | 分镜定稿 | Shot Designer Agent | Gemini 3.1（主）/ Claude Opus 4.6（备） | 100%满足 N03 标准 | — |
| 5 | N05_SHOT_LEVELING | 镜头分级&编号标注 | Shot Designer Agent | Gemini 3.1（主）/ Claude Opus 4.6（备） | — | — |

#### VISUAL ELEMENT & ART（视觉元素与美术阶段）

| # | ID | 名称 | Agent | 模型/工具 | ComfyUI 节点 | 质检阈值 | 预估时间 |
|---|---|---|---|---|---|---|---|
| 6 | N06_VISUAL_ELEMENT_GEN | 视觉元素生成 | Visual Director Agent | Qwen3-72B | Text Concat / Prompt Builder | **不产出图，仅输出 Prompt + ComfyUI 工作流 JSON** | — |
| 7 | N07_ART_ASSET_GEN | 美术产品图生成 | Visual Director Agent | FLUX.2 Dev / Z-Image-Turbo + FireRed-1.1 | I-image, Turbo, FireRed MultiRef + 全面资源 | 风格一致性 | ~25 min |
| 7b | N07b_VOICE_GEN | 核心角色音色生成 | Audio Director Agent | CosyVoice / ElevenLabs | — | — | ~10 min |
| 8 | N08_ART_HUMAN_GATE | 美术产品人类检确 | **Gate: Stage1 — 仅剪辑中台审核（资产级 + 音色选定）** | — | Image Preview + Voice Preview | 人工确认 | +人工时间 |
| 9 | N09_ART_FREEZE | 美术产品定稿 | Visual Director Agent | FireRed-1.1 | FireRed + BatchRun | — | — |

#### KEYFRAME（关键帧阶段）

| # | ID | 名称 | Agent | 模型/工具 | ComfyUI 节点 | 质检阈值 | 预估时间 |
|---|---|---|---|---|---|---|---|
| 10 | N10_KEYFRAME_GEN | 关键帧生成 | Visual Director Agent | FireRed + LTX-2.3 | LTXVividGuide, Multi, NAG, ControlNet, OpenPose | — | ~15 min |
| 11 | N11_KEYFRAME_QC | 关键帧质检 | Quality Guardian Agent | Gemini + Claude + GPT | ReActor + FaceID Checker | 加权总分 < 7.5 → 打回 N10 | ~15 min |
| 12 | N12_KEYFRAME_CONTINUITY | 剧情连续性检查 | Storyboard Planner Agent | Gemini 3.1 | — | — | ~10 min |
| 13 | N13_KEYFRAME_FREEZE | 关键帧定稿 | Visual Director Agent | FireRed | FireRed Edit | — | — |

#### VIDEO（视频阶段）

| # | ID | 名称 | Agent | 模型/工具 | ComfyUI 节点 | 质检阈值 | 预估时间 |
|---|---|---|---|---|---|---|---|
| 14 | N14_VIDEO_GEN | 视频素材生成 | Visual Director Agent | LTX-2.3 / Wan2.2 / SkyReels / ViVi+Mochi | LTXVividGuide Multi, HuMo+Embeds, 模型路由 | 1080p 评估 | ~80 min |
| 15 | N15_VIDEO_QC | 视频素材质检 | Quality Guardian Agent | 多模型（Gemini等） | ReActor + Physics Checker | 多维度打分 | ~20 min |
| 16 | N16_VIDEO_CONTINUITY_PACE | 剧情&节奏连续性 | Shot Designer Agent | Gemini 3.1 | — | — | ~15 min |
| 16b | N16b_TONE_RHYTHM_ADJUST | 影调与节奏调整 | Shot Designer + Compositor（协作） | FFmpeg（剪辑）+ Gemini 3.1（决策） | — | — | ~10 min |
| 17 | N17_VIDEO_FREEZE | 视频素材定稿 | Visual Director Agent | RealESRGAN/Topaz(超分) + FFmpeg | — | — | ~10 min |
| 18 | N18_VISUAL_HUMAN_GATE | 视觉素材人类检确 | **Gate: Stage2 — 仅质检员审核（分镜/shot级）** | — | Timeline Preview | 人工确认 | ~10 min |
| 19 | N19_VISUAL_FREEZE | 视觉素材定稿 | — | — | — | — | — |

#### AV（视听整合阶段）

| # | ID | 名称 | Agent | 模型/工具 | ComfyUI 节点 | 质检阈值 | 预估时间 |
|---|---|---|---|---|---|---|---|
| 20 | N20_AV_INTEGRATE | 视听整合 | Audio Director Agent | CosyVoice + LatentSync + Stable Audio 2.5 | LatentSync, Geek_AudioMixer, SFX/BGM候选器 | — | ~25 min |
| 21 | N21_AV_HUMAN_GATE | 视听整合人类检确 | **Gate: Stage3 — 仅质检员审核（集/episode级）** | — | Audio Timeline Preview | 人工试听确认 | ~10 min |
| 22 | N22_AV_FREEZE | 视听整合全定稿 | Audio Director Agent | — | — | STT校验 | ~10 min |

#### FINAL（成片阶段）

| # | ID | 名称 | Agent | 模型/工具 | ComfyUI 节点 | 质检阈值 | 预估时间 |
|---|---|---|---|---|---|---|---|
| 23 | N23_FINAL_COMPOSE | 成片整合 | Compositor Agent | FFmpeg（主）+ VHS_VideoCombine（辅） | VHS_VideoCombine | — | ~15 min |
| 24 | N24_FINAL_HUMAN_GATE | 成片人类检确查 | **Gate: Stage4 — 串行3步：质检员(可选)→剪辑中台→合作方（集/episode级）** | — | Video Player + Timeline | 3角色均通过 | ~15 min×3 |
| 25 | N25_FINAL_FREEZE | 成片定稿 | Compositor Agent | — | — | — | ~5 min |
| 26 | N26_DISTRIBUTION | TikTok/飞书推送 | Compositor Agent | — | Feishu + TikTok | — | — |

### 5.3 回溯链（打回路径映射）

| 源节点 | 打回目标 | 场景 |
|---|---|---|
| N03 | → N02 | 分镜质量不达标 |
| N05 | → N03 | 镜头分级异常 |
| N07 | → N06 | 美术风格不一致 |
| N10 | → N06 | 关键帧质量/风格问题 |
| N11 | → N10 | 关键帧质检不通过 |
| N12 | → N10 | 跨镜头连续性问题 |
| N14 | → N10~N13 | 视频生成基础素材问题 |
| N15 | → N14 | 视频质检不通过 |

---

## 6. 端到端时序要求

### 6.1 正常流程（无打回）

```text
1. 创建 EpisodeVersion v1
2. Supervisor Agent 按 Node Registry 依赖拓扑调度 Worker Agent
3. N01(Script Analyst) → N02(Shot Designer) → N03(Quality Inspector) → N04 → N05
4. N06(Visual Director) → N07 ∥ N07b(Audio Director, 并行) → N08(Gate Stage1: 剪辑中台审核，资产级 + 音色选定) → N09
5. N10 → N11(Quality Inspector) → N12(Quality Inspector) → N13
6. N14 → N15(Quality Inspector) → N16(Shot Designer) → N16b(影调节奏调整) → N17 → N18(Gate Stage2: 质检员审核，shot级) → N19
7. N20(Audio Director) → N21(Gate Stage3: 质检员审核，episode级) → N22
8. N23 → N24(Gate Stage4: 质检员→剪辑中台→合作方 串行3步，episode级) → N25 → N26(推送)
```

### 6.2 打回流程（以 Stage4 为例）

Stage4 为串行 3 步审核，打回可能发生在任一步骤：

```text
1. Stage4 到达 → 创建 Step1 ReviewTask（质检员，可选）
2a. 质检员通过（或跳过） → 创建 Step2 ReviewTask（剪辑中台）
2b. 质检员打回 → 终止后续步骤 → 生成 ReturnTicket → 跳到步骤 6
3a. 剪辑中台通过 → 创建 Step3 ReviewTask（合作方）
3b. 剪辑中台打回 → 终止后续步骤 → 生成 ReturnTicket → 跳到步骤 6
4a. 合作方通过 → Stage4 整体放行 → N25
4b. 合作方打回 → 生成 ReturnTicket → 跳到步骤 6
5. （正常结束）

--- 打回路径 ---
6. RCA 归因：从 ReviewPoint (timestamp + issue_type + comment) 映射到 node_id（例如 SUBTITLE → N23）
7. 生成 rerun_plan：只重跑 N23→N24→N25→N26
8. 创建 EpisodeVersion v2
9. 新版本自动从归因节点开始执行
10. 产出修订总结（RevisionLog），写回审核页左侧
```

---

## 7. 关键功能需求（EARS）

### 7.1 Orchestrator（LangGraph）

- **US-O1**
  **WHEN** 新集版本创建 **THE SYSTEM SHALL** 由 Supervisor Agent 按 Node Registry 与依赖关系启动 Run，将任务分发给对应 Worker Agent。

- **US-O2**
  **WHEN** 执行到 Gate 节点 **THE SYSTEM SHALL** 按以下规则创建 `ReviewTask` 并挂起：

  | Gate | 审核角色 | 审核层级 | 步数 | 规则 |
  |---|---|---|---|---|
  | Stage1 / N08 | 仅剪辑中台 | 资产级 | 1 步 | 中台通过 → 放行 |
  | Stage2 / N18 | 仅质检员 | 分镜/shot级（逐 shot 确认） | N 步（N=shot数） | 全部 shot 通过 → 集级放行 |
  | Stage3 / N21 | 仅质检员 | 集/episode级 | 1 步 | 质检员通过 → 放行 |
  | Stage4 / N24 | 质检员(可选) → 剪辑中台 → 合作方 | 集/episode级 | **3 步串行** | 任一步打回 → ReturnTicket |

  累计 **6 次人工检查**（Stage2 按集计 1 次）。Stage4 的 3 步为严格串行：上一角色通过后才流转到下一角色。

- **US-O2a（Stage2 shot 级聚合）**
  **WHEN** Stage2 到达 **THE SYSTEM SHALL** 为该集的每个 shot 创建独立的 `ReviewTask`（`review_granularity=shot`，`anchor_id=shot_id`）。
  **WHEN** 某 shot 的 ReviewTask 被打回 **THE SYSTEM SHALL** 仅针对该 shot 生成 ReturnTicket，其他 shot 审核不受影响。
  **WHEN** 该集所有 shot 的 ReviewTask 均为 `approved` **THE SYSTEM SHALL** 判定该集 Stage2 整体通过，放行进入下游。

- **US-O2b（多集并行流水线）**
  多个集可同时处于不同 Stage。集通过某一 Stage 后立即进入下一 Stage 的审核池，无需等待其他集：
  - 集 A 通过 Stage2 → 立即进入质检员的 Stage3 审核池
  - 集 B 仍在 Stage2 的 shot 级审核中 — 不阻塞集 A
  - Stage4 同理：质检员审完集 A → 集 A 进入中台审核池；质检员可继续审集 B
  - 同一审核员在不同集、不同 Stage 间可自由切换

- **US-O3**
  **WHEN** Gate 所有审核步骤全部通过 **THE SYSTEM SHALL** 放行下游节点并继续执行。

- **US-O4**
  **WHEN** 质检节点（N03/N11/N15）评分低于阈值 **THE SYSTEM SHALL** 自动打回到上游节点。

- **US-O5**
  **WHEN** Gate 任意审核步骤打回 **THE SYSTEM SHALL** 立即终止当前 Gate 后续步骤，生成 ReturnTicket 并触发回炉。Stage2 例外：仅打回该 shot，其他 shot 继续审核。

### 7.2 RAG 知识库

- **US-K1**
  **WHEN** Worker Agent 开始执行 **THE SYSTEM SHALL** 从 Qdrant 检索对应的知识上下文（导演参考、风格基线、历史案例）作为 prompt 输入。

### 7.3 回炉归因与最小重跑

- **US-R1**
  **WHEN** 任意阶段发起驳回 **THE SYSTEM SHALL** 生成 `ReturnTicket`，包含 stage、anchor、issue_type、severity、comment。

- **US-R2**
  **WHEN** ReturnTicket 创建 **THE SYSTEM SHALL** 先执行规则化 RCA，输出 `system_root_cause(node_id)` 与 `rerun_plan`。

- **US-R3**
  **WHEN** rerun_plan 确认 **THE SYSTEM SHALL** 创建新 `EpisodeVersion(v+1)`，仅重跑必要节点链与必要对象范围。

### 7.4 Data Center

- **US-D1** NodeRun 完成后采集耗时/成本/错误/重试/模型调用。
- **US-D2** 数据中心展示规模/效率/成本/质量四象限及趋势。
- **US-D3** 异常时生成诊断文本和结构化建议。

### 7.5 Performance

- **US-P1** 展示超时告警、资源池概览、周期损耗拆解、员工绩效表格。
- **US-P2** drill-down 个人：处理任务、驳回原因 Top5、时长分布、通过率趋势。

### 7.6 Production Board

- **US-B1** 以剧/集卡片展示实时状态、当前节点、耗时、成本。
- **US-B2** 右侧抽屉展示节点级状态、耗时、日志与运维操作。

### 7.7 Node Trace & Runbook

- **US-T1** 展示 NodeRun 输入/候选/输出/评分/日志。
- **US-T2** 超管重试或参数覆盖，记录审计并触发再执行。

### 7.8 Review Gateway（脱敏）

- **US-G1** 外包端拉取任务时仅返回脱敏 DTO。
- **US-G2** 外部端提交决策时完整落审计并回写编排系统。

### 7.9 OpenClaw（人类审核入口）

- **US-C1**
  **WHEN** 人类需要审核 **THE SYSTEM SHALL** 通过 OpenClaw 提供聊天界面 + Web 时间轴进行最小干预交互。

### 7.10 角色权限矩阵

| 功能 | 质检员 | 剪辑中台 | 合作方 |
|---|---|---|---|
| 首页任务面板 | ✅ | ✅ | ✅（仅 Stage4） |
| 领取/处理任务 | ✅ | ✅ | ✅（仅查看待审） |
| Stage1（资产）通过/打回 | ❌ | ✅ | ❌ |
| Stage2（视觉）通过/打回 | ✅ | ❌ | ❌ |
| Stage3（视听）通过/打回 | ✅ | ❌ | ❌ |
| Stage4（成片）通过/打回 | ✅（可选） | ✅ | ✅ |
| 时间戳评论/打点 | ✅ | ✅ | ✅ |
| 轻微时间轴微调 | ✅（仅 Stage3） | ✅（Stage3/4 可选） | ❌ |
| 查看修订总结/历史版本 | ✅ | ✅ | ✅（仅本集、脱敏） |
| 导出/下载 | ✅（可控） | ✅ | ❌ |

---

## 8. 超管页面 PRD（自研，仅内部可见）

### 8A. 员工质检绩效管理

#### 8A.1 页面结构
1. 顶部告警条（红底）— 超期 >7 天的剧列表
2. 资源池概览卡 — 近7日活跃人数、待审总量
3. 周期损耗拆解卡 — 拆解条：生产→质检→中台→合作方
4. 员工表格（质检员 tab / 剪辑中台 tab）

#### 8A.2 员工表格列
| 列 | 说明 |
|---|---|
| 员工名 / 组别 | 基本信息 |
| 当前负荷 | 待审集数 + 状态（超负荷/繁忙/正常/空闲） |
| 产出量 | 部/集 |
| 效率指标 | 分钟/成片分钟 |
| AI驳回次数 / 人类驳回次数 | 分别统计 |
| 严重问题率 | S1 占比 |

#### 8A.3 drill-down 员工详情
- 最近处理任务列表、驳回原因 Top5、时长分布、通过率趋势

### 8B. 全局生产数据中心

1. AI 诊断横幅（自然语言 + 关键数字）
2. 4 张指标卡：规模/效率/成本/质量
3. 趋势图：每日效率与成本
4. 五阶段成本分布（脚本&分镜 / 美术&视觉元素 / 关键帧&视频 / 视听整合 / 成片）
5. 剧/集明细表

| 象限 | 指标 | 计算方式 |
|---|---|---|
| 规模 | 部剧数/集数/总分钟 | count/sum |
| 效率 | 分钟/成片分钟 | 全链路耗时/成片时长 |
| 成本 | 元/分钟 | total_cost_cny / 成片分钟（红线200） |
| 质量 | AI拦截次数 / 人工修改次数 | NodeRun(FAILED) + ReturnTicket count |

### 8C. 全局生产大盘

1. 全局统计与筛选标签
2. 剧集卡片矩阵（状态badge + 进度条 + 当前节点 + 耗时/成本）
3. 右侧抽屉（分组节点列表 + 状态 + 耗时 + 日志 + 运维操作）

### 8D. 节点详情/调试页

- 左侧节点树 / 中间 Input·Candidates·Output / 右侧运行面板
- 运维动作：刷新/重试/导出日志/替换模型/调整参数
- **此页面不外包**

---

## 9. 非功能要求

| 维度 | 要求 |
|---|---|
| 可用性 | 核心编排与回调链路具备重试与幂等 |
| 一致性 | 关键状态推进与版本切换必须事务化 |
| 安全 | 外部接口不暴露模型供应商、成本、prompt |
| 观测 | 每个 NodeRun 必须可检索日志、指标、错误码和重试轨迹 |
| 可扩展 | Node Registry 可配置，不依赖硬编码流程 |

---

## 10. 验收标准（DoD）

1. 能跑通 N01→N26 全链路（含 N07b、N16b 共 28 节点 + 4 Gate + TikTok 推送）。
2. 任意打回可自动生成 ReturnTicket + rerun plan + 新版本。
3. 质检节点（N03/N11/N15）低于阈值可自动打回。
4. Data Center 能计算并展示北极星指标。
5. Performance / Production Board / Node Trace 页面能展示真实数据。
6. Review Gateway + OpenClaw 可供外包端完成审核闭环。
7. RAG 知识库可被 Agent 检索并注入上下文。
8. 全流程具备审计与幂等保障。
