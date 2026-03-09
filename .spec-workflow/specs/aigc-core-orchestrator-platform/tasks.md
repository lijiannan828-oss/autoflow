# AIGC 核心产线与超管系统（V2.0）· 实现任务

## 文档信息

- Spec：`aigc-core-orchestrator-platform`
- 依赖：`requirements.md`, `design.md`, `data-structures.md`
- 状态标记约定：`[x]` 已完成；`[ ]` 未完成（含进行中与未开始）

---

## [ ] T0 基础设施开通与配置（进行中）

### [x] T0.1 已完成（截至 2026-03-06）

| 服务 | 实例/标识 | 备注 |
|---|---|---|
| VKE（Kubernetes） | `autoflow-vke-dev` / `cd6lemn5hkhgsuq13lmbg` | 2 节点，cn-shanghai |
| ECS 跳板机 | `i-yeh7aj5k3kay8n8456sq` / 10.0.0.109 | 同 VPC 内网运维入口 |
| CR（镜像仓库） | `autoflow-cn-shanghai.cr.volces.com/autoflow` | api + web 仓库 |
| RDS PostgreSQL | `postgres-478f3e94ee1a` | autoflow 库 |
| Redis | `redis-shzlsorkckr13iz1a` | outsource 账号 |

### [ ] T0.2 待开通 — MVP-0 必需（进行中）

- [x] ~~MQ~~ → **MVP-0 使用 Redis 作为 Celery broker**（已部署），无需额外开通 MQ 服务
  - Topics 通过 Celery queue name 实现：`node-run-events`, `model-callbacks`, `return-tickets`
  - _MVP-1 可选_：如需 DLQ/消息优先级，迁移至 RabbitMQ
- [x] **TOS（对象存储）**：Bucket `autoflow-media-2102718571-cn-shanghai`（已可用），生命周期规则，CORS
  - _阻塞_：T5（产物存储）、TM.2（模型产物）
- [ ] **CLB/ALB**：VKE Ingress 外部入口
- [ ] **MinIO（本地开发）**：本地素材存储（与云端 TOS 对齐接口）

### [ ] T0.3 待开通 — MVP-1

- [ ] TLS（日志服务）、Cloud Monitor、NAT 网关（视需求）、APIG（可后置）

### [ ] T0.4 环境配置联调（进行中）

- [ ] 全链路连通性验证 + 凭据统一管理
- _交付物_：连通性验证脚本 + 环境变量完整填充

---

## [ ] TM 模型部署与推理服务

### [ ] TM.1 VKE GPU 节点池

- [ ] 创建 GPU 节点池（A100/A800 或 4090/L40S）
- [ ] 安装 NVIDIA Device Plugin，配置标签与污点
- [ ] MVP 最少 2 节点（ComfyUI + 音频各 1），理想 4-8 节点
- _交付物_：GPU 节点在线 + nvidia-smi 通过

### [ ] TM.2 ComfyUI 集群部署

- [ ] 构建 ComfyUI Docker 镜像（含自定义节点插件）
- [ ] 下载模型权重：
  - 图像：FLUX.2 Dev, Z-Image-Turbo, FireRed-1.1
  - 视频：LTX-2.3, Wan2.2, SkyReels, ViVi, Mochi
  - 增强：HuMo（运动映射）, ReActor（人脸一致性）, FaceID Checker, Physics Checker
- [ ] 部署 ComfyUI 工作流模板：
  - 美术资产生成（N07）：I-image, Turbo, FireRed MultiRef
  - 美术定稿（N09）：FireRed + BatchRun
  - 关键帧生成（N10）：LTXVividGuide, Multi, NAG, ControlNet, OpenPose
  - 关键帧质检（N11）：ReActor + FaceID Checker
  - 关键帧定稿（N13）：FireRed Edit
  - 视频生成（N14）：LTXVividGuide Multi, HuMo+Embeds, 模型路由
  - 视频质检（N15）：ReActor + Physics Checker
  - 视听整合（N20）：LatentSync, Geek_AudioMixer, SFX/BGM候选器
  - 成片合成（N23）：VHS_VideoCombine
- [ ] 模型路由器：按镜头分级（S0/S1/S2）选择不同模型
- [ ] 暴露 HTTP API + 配置 HPA
- _交付物_：ComfyUI 集群在线 + 各 workflow 冒烟通过

### [ ] TM.3 LLM 推理服务

- [ ] 方案 A（自部署 vLLM）：Qwen3-72B / DeepSeek-R1 / Llama-3.3-70B
- [ ] 方案 B（API）：火山方舟 / 第三方
- [ ] 外部 API 配置：Claude / GPT / Gemini（质检多模型投票）
- _交付物_：LLM API 可调用

### [ ] TM.4 音频模型部署

- [ ] CosyVoice（TTS）
- [ ] LatentSync（唇形同步）— 必须自部署
- [ ] Stable Audio 2.5（BGM/SFX）
- [ ] Geek_AudioMixer（音频混合）
- _交付物_：音频服务 API 可调用

### [ ] TM.5 模型端点注册与健康监控

- [ ] K8s 探针 + Redis 健康上报 + 冒烟脚本
- [ ] `node_registry.model_config` 填充各端点
- _交付物_：端点路由表 + 监控

---

## 任务列表（建议顺序）

### [ ] T1 LangGraph Orchestrator 骨架（进行中）

- 搭建 LangGraph Supervisor Agent 框架
- 实现 Supervisor → Worker Agent 任务分发机制
- 定义 6 类 Worker Agent 接口规范
- 集成 Celery + Redis broker 用于异步回调
- _交付物_：LangGraph 骨架 + Agent 接口定义 + 最小可运行 demo

### [x] T2 Node Registry 与 DAG 校验（已完成）

- 建立 `node_registry` 表与 **26 节点种子数据**（对齐选型表）
- 每节点配置：agent_role、model_config、comfyui_nodes、rag_sources、quality_threshold
- DAG 拓扑排序与依赖校验
- _交付物_：Registry 表 + 种子数据 + 拓扑校验通过
- 完成说明（截至 2026-03-08）：
  - `seed_node_registry()` 已落地并维护 26 节点幂等种子（N01~N26）
  - graph 拓扑与依赖约束已固化到 `topology.py` 并有 `test_topology_sanity()` 覆盖
  - `compile_pipeline()` 与运行时接线已持续通过 smoke（受本地 `langgraph` 安装状态影响完整编译测试）

### [ ] T3 Run / NodeRun 状态机（进行中）

- 实现 `runs`、`node_runs` 状态推进
- 新增 `AUTO_REJECTED` 状态（质检自动打回）
- 幂等键：`episode_version_id + node_id + scope_hash`
- 失败重试与超时取消
- `langgraph_thread_id` 关联
- _交付物_：状态机服务 + 单测

### [x] T4 Gate 节点挂起与放行（含 shot 聚合 + 多步串行 + 多集并行）（已完成）

- N08/N18/N21/N24 到达时，依据 `node_registry.review_steps` 配置创建 `review_tasks`
- Gate 审核角色与层级规则：
  - **Stage1 / N08**：仅**剪辑中台**审核（资产级），1 ReviewTask/集
  - **Stage2 / N18**：仅**质检员**审核（分镜/shot级），**N ReviewTask/集**（每个 shot 独立一条）
  - **Stage3 / N21**：仅**质检员**审核（集/episode级），1 ReviewTask/集
  - **Stage4 / N24**：**串行 3 步** — 质检员(可选) → 剪辑中台 → 合作方（集/episode级）
- **Stage2 shot 级聚合**：
  - Gate 到达时读取该集所有 shot，为每个 shot 创建 ReviewTask（`anchor_type=shot`, `anchor_id=shot_id`）
  - 质检员逐 shot 审核；打回某 shot 仅影响该 shot，不阻塞其他 shot 审核
  - 监听 ReviewTask 状态变更 → 查询该集全部 shot 是否 approved → 是则触发集级放行
- **Stage4 串行流转**：
  - 按 `review_step_no` 升序依次创建/激活 ReviewTask
  - 上一步 `approved` 后才创建下一步；任一步 `returned` 立即终止后续步骤
  - 质检员步骤可跳过（`skippable=true`），跳过时 status 设为 `skipped`
- **多集并行审核池**：
  - 审核池按 `reviewer_role` + `status` 聚合，不同集、不同 Stage 的待审任务混合呈现
  - 集通过某 Stage → 立即进入下一 Stage 的角色审核池，不阻塞其他集
  - 审核员可自由在不同集/Stage 间切换
- 累计 **6 次人工检查**，任何一次打回均生成 ReturnTicket 触发回炉
- 关联 OpenClaw 会话（`openclaw_session_id`）
- _交付物_：Gate 控制器 + shot 聚合引擎 + 串行步骤引擎 + 并行审核池 + 放行/打回机制
- 完成说明（截至 2026-03-08 第十二轮）：
  - Stage1 `N08`：资产级单步 Gate 真闭环
  - Stage2 `N18`：shot 级聚合 Gate 真闭环（多任务聚合放行）
  - Stage3 `N21`：episode 级单步 Gate 真闭环
  - Stage4 `N24`：串行 3 步 Gate 真闭环（Step1/2/3 串行放行至 N25）

### [ ] T5 Artifact 索引与版本固化

- 每个 NodeRun 完成后写入 `artifacts`（含 ComfyUI 工作流 JSON 产物）
- N09/N13/N17/N19/N22/N25 定稿固化
- 新增 artifact_type: `prompt_json`, `comfyui_workflow`
- _交付物_：产物写入器 + 固化流程

### [x] T6 质检自动打回机制（已完成）

- N03：<8.0 分 → 自动打回 N02
- N11：加权总分 < 7.5 → 自动打回 N10
- N15：多维度不通过 → 自动打回 N14
- 限制最大打回次数（`max_auto_rejects` 默认 3 防死循环）
- 打回时创建 ReturnTicket（source_type = auto_qc）
- _交付物_：自动打回服务 + 阈值配置
- 完成说明（截至 2026-03-08）：
  - `qc_handlers.py` 已实现 N03/N11/N15 阈值与 `auto_rejected` 状态产出
  - `workers.py` 在收到 `auto_rejected` 后会触发 `auto_reject_node_run()`
  - `write_side.py` 已实现 `max_auto_rejects` 防死循环、回写状态、并创建 `source_type=auto_qc` 的 ReturnTicket

### [ ] T7 RAG 知识库服务

- 部署 Chroma 向量库（VKE Pod 或独立实例）
- 建立 `rag_collections` 元数据表
- 实现知识入库：人工上传 + 系统自动沉淀
- 实现检索接口：按 `node_registry.rag_sources` 配置检索
- Worker Agent 调用前自动注入 RAG 上下文
- _交付物_：Chroma 服务 + 入库/检索 API + 初始知识库

### [ ] T8 Worker Agent 实现（按管线阶段拆解）

每个子任务包含：Agent 逻辑实现 + 模型/工具调用接通（依赖 T9 适配器）+ Artifact 产出 + 阶段内联调。
子任务可并行开发，但建议按 T8.1→T8.6 顺序优先验证。

#### [ ] T8.1 脚本阶段（N01~N05）

| 节点 | Agent | 实现内容 | 依赖 |
|---|---|---|---|
| N01 | Script Analyst | 剧本结构化解析：角色/场景/情感/对白/动作提取 | TM.3（LLM） |
| N02 | Director | 拆集拆镜 + 拍摄指令生成 | TM.3（LLM），T13（出场索引） |
| N03 | Quality Guardian | 分镜质检：多模型投票评分，<8.0 自动打回→N02 | TM.3（LLM 多模型），T6 |
| N04 | Director | 视觉元素提取（角色外观/场景/道具描述） | TM.3（LLM） |
| N05 | Director | 镜头分级（S0/S1/S2）→ 决定下游模型选择 | TM.3（LLM） |

- _验收_：输入一段剧本 → N01~N05 全部执行成功 → 产出结构化 shot 列表 + 视觉元素 + 镜头分级
- _交付物_：Script Analyst Agent + Director Agent（脚本子集）+ Quality Guardian Agent（N03）

#### [ ] T8.2 美术阶段（N06~N09）

| 节点 | Agent | 实现内容 | 依赖 |
|---|---|---|---|
| N06 | Visual Director | 视觉元素生成（参考图 + 风格提取） | TM.2（ComfyUI），T7（RAG 风格基线） |
| N07 | Visual Director | 美术产品图生成：FLUX.2 Dev / Z-Image-Turbo + FireRed-1.1 | TM.2（ComfyUI） |
| N08 | **Gate Stage1** | 剪辑中台审核（资产级）→ 已在 T4 实现 | T4 |
| N09 | Visual Director | 美术定稿固化：FireRed + BatchRun → 高保真基线 | TM.2（ComfyUI），T5 |

- _验收_：输入视觉元素描述 → N06~N09 全部执行 → 产出风格一致的美术资产图 + 定稿基线
- _交付物_：Visual Director Agent（美术子集）

#### [ ] T8.3 关键帧阶段（N10~N13）

| 节点 | Agent | 实现内容 | 依赖 |
|---|---|---|---|
| N10 | Visual Director | 关键帧生成：LTXVividGuide + ControlNet + OpenPose | TM.2（ComfyUI） |
| N11 | Quality Guardian | 关键帧质检：ReActor + FaceID Checker，加权总分<7.5→打回 N10 | TM.2（ComfyUI），T6 |
| N12 | Storyboard Planner | 跨镜头连续性检查（角色/场景/光影一致性） | TM.3（LLM） |
| N13 | Visual Director | 关键帧定稿固化：FireRed Edit | TM.2（ComfyUI），T5 |

- _验收_：输入美术基线 + shot 列表 → N10~N13 全部执行 → 产出质检通过的连续关键帧序列
- _交付物_：Visual Director Agent（关键帧子集）+ Quality Guardian Agent（N11）+ Storyboard Planner Agent（N12）

#### [ ] T8.4 视频阶段（N14~N19）

| 节点 | Agent | 实现内容 | 依赖 |
|---|---|---|---|
| N14 | Visual Director | 视频生成：LTXVividGuide Multi + HuMo + 模型路由（按 S0/S1/S2） | TM.2（ComfyUI） |
| N15 | Quality Guardian | 视频质检：ReActor + Physics Checker，多维度不通过→打回 N14 | TM.2（ComfyUI），T6 |
| N16 | Storyboard Planner | 节奏连续性分析（转场节拍/时长合理性） | TM.3（LLM） |
| N17 | Visual Director | 视频定稿固化 | T5 |
| N18 | **Gate Stage2** | 质检员逐 shot 审核 → 已在 T4 实现 | T4 |
| N19 | — | 视觉整体定稿固化 | T5 |

- _验收_：输入关键帧序列 → N14~N19 全部执行 → 产出质检通过的视频片段 + 通过 shot 级审核
- _交付物_：Visual Director Agent（视频子集）+ Quality Guardian Agent（N15）+ Storyboard Planner Agent（N16）

#### [ ] T8.5 视听阶段（N20~N22）

| 节点 | Agent | 实现内容 | 依赖 |
|---|---|---|---|
| N20 | Audio Director | 视听整合：CosyVoice TTS + LatentSync 唇形同步 + Stable Audio BGM/SFX + Geek_AudioMixer | TM.2 + TM.4（音频模型） |
| N21 | **Gate Stage3** | 质检员审核（episode 级）→ 已在 T4 实现 | T4 |
| N22 | Audio Director | 视听定稿固化 + STT 校验 | T5 |

- _验收_：输入视频片段 → N20~N22 全部执行 → 产出声画同步的视听产物 + STT 校验通过
- _交付物_：Audio Director Agent

#### [ ] T8.6 成片阶段（N23~N26）

| 节点 | Agent | 实现内容 | 依赖 |
|---|---|---|---|
| N23 | Director | 成片合成：VHS_VideoCombine（字幕 + 多轨合成） | TM.2（ComfyUI） |
| N24 | **Gate Stage4** | 串行 3 步审核 → 已在 T4 实现 | T4 |
| N25 | Director | 成片定稿固化 → 入资产池 | T5 |
| N26 | Director | TikTok/飞书推送 | — |

- _验收_：输入视听产物 → N23~N26 全部执行 → 产出可发布成片 + 推送成功
- _交付物_：Director Agent（成片子集）

### [ ] T9 Model Gateway Adapter

- LLM 适配器：OpenAI 兼容接口（vLLM / 方舟 / 第三方）
- ComfyUI 适配器：workflow 提交 + 轮询 + 产物下载
- 音频适配器：TTS + 唇形 + BGM
- 异步回调 + job_id 追踪 + 超时补偿
- _交付物_：三类适配器 + 回调处理器

### [ ] T10 ReturnTicket 与 RCA 规则引擎（进行中）

- 实现 `return_tickets` + `review_points`
- 区分 `source_type`：human_review / auto_qc
- issue_type → node_id 归因映射（V2 新节点编号）
- _交付物_：RCA 服务 + 映射表

### [ ] T11 Minimal Rerun Planner（进行中）

- 输入 ReturnTicket + 产物索引 → 输出 rerun_plan_json
- 资产基线变更 → character_appearance_index 扩散
- _交付物_：Planner + 案例测试

### [ ] T12 回炉与新版本自动创建（进行中）

- RETURNED → PATCHING → RUNNING(v+1)
- 非重跑节点 SKIPPED + 复用上版本产物
- 修订总结回写
- _交付物_：版本切换服务

### [ ] T13 角色出场索引

- `character_appearance_index` 表 + 写入逻辑
- N02（拆集拆镜）执行后自动填充
- _交付物_：索引服务

### [ ] T14 OpenClaw 集成（进行中）

- 部署 OpenClaw 服务（聊天界面 + Web 时间轴）
- 4 Gate 节点对接 OpenClaw 交互：
  - N08: Image Preview（美术资产图预览，剪辑中台使用）
  - N18: Timeline Preview（关键帧+视频时间轴，质检员使用，shot 粒度）
  - N21: Audio Timeline Preview（多轨音频试听，质检员使用，episode 粒度）
  - N24: Video Player + Timeline（成片播放审视，3 角色串行，episode 粒度）
- 角色权限控制：
  - 根据 `reviewer_role` 过滤可操作功能（通过/打回、时间轴微调、导出等）
  - Stage4 时间轴微调仅剪辑中台可选
  - 合作方查看修订总结仅限本集 + 脱敏
- review_tasks 关联 openclaw_session_id
- _交付物_：OpenClaw 部署 + 4 Gate 对接 + 角色权限矩阵

### [ ] T15 NodeRun 采集与成本归集

- 采集耗时/调用/GPU/token/cost/RAG查询次数
- 汇总 EpisodeVersion 指标 + stage_wait_time
- _交付物_：采集中间件 + 汇总任务

### [ ] T16 Data Center 指标 API

- overview / cost_breakdown / cycle_breakdown
- 五阶段：脚本&分镜 / 美术&视觉元素 / 关键帧&视频 / 视听整合 / 成片
- _交付物_：Admin Analytics API

### [ ] T17 AI 诊断

- 规则 + 模板生成
- _交付物_：诊断服务

### [ ] T18 员工质检绩效页后端

- 超期告警 / 资源池 / 周期拆解 / 员工表 / drill-down
- _交付物_：`/admin/staff/*` 接口

### [ ] T19 全局生产大盘后端

- 卡片矩阵 / 过滤 / 抽屉
- _交付物_：`/admin/production-board/*` 接口

### [ ] T20 节点调试页后端（进行中）

- NodeRun 详情 / Agent 角色 / ComfyUI workflow / RAG 查询 / 质检评分
- 运维操作（超管权限）
- _交付物_：`/noderuns/*` API

### [ ] T21 Review Gateway（进行中）

- 任务列表/详情/决策/打点/替换/微调
- 基于 `reviewer_role` 的接口鉴权：不同角色只能操作授权的 Gate 和功能
- Stage4 串行步骤查询接口：返回当前处于哪一步、哪个角色待审
- DTO 脱敏 + OpenClaw 会话关联
- 合作方接口额外脱敏（仅本集、无导出）
- _交付物_：Gateway API + 角色鉴权中间件

### [ ] T22 安全、审计与幂等

- 关键操作审计 + 幂等键 + 回调防重
- _交付物_：审计策略 + 幂等组件

### [ ] T23 可观测与告警

- 结构化日志 + 错误码看板 + SLA 告警
- _交付物_：监控面板 + 告警策略

### [ ] T24 Reflection / Feedback Learning

- 建立人类反馈、自动打回、最终通过案例的统一沉淀通道
- 将 `review_points`、`return_tickets`、`revision_logs`、质检结果转为可检索经验
- 支持经验回写到 RAG、提示词模板、`node_registry.model_config`、`quality_threshold`
- 建立反馈采纳率、经验命中率、回写版本追踪
- _交付物_：Reflection 管道 + 经验入库/回写机制 + 指标看板

### [ ] T25 质量评测体系

- 定义节点级与成片级质量指标：角色一致性、连续性、音画同步、表演自然度、成片综合质量
- 建立质量评分采集、聚合与回查能力
- 让质量指标可驱动自动打回阈值、模型路由与 rerun planner
- _交付物_：质量评测服务 + 指标字典 + 质量 API

### [ ] T26 双制式交付

- 建立横屏/竖屏输出 profile 与约束
- 在分镜、镜头分级、字幕布局、最终合成、分发阶段携带双制式参数
- 支持安全构图区、裁切/重构图策略、双制式产物索引
- _交付物_：dual-format profile + 双制式出片链路

### [ ] T27 审核团队运营

- 建立 reviewer pool、任务池优先级、SLA、锁超时、负载均衡
- 支持 15-20 人审核团队的任务分配、超时告警、绩效统计
- 支持紧急驳回优先与合作方驳回优先回流
- _交付物_：reviewer ops 服务 + 运营 API + 指标面板

### [ ] T28 真相源统一与 Review Gateway 收口（进行中）

- 明确 core orchestrator 为核心业务真相源，review-workflow 仅消费 DTO/API
- 清理 `stage_tasks` / `review_tasks` / core truth objects 的边界
- 收口 Review Gateway DTO，避免审核层反向定义核心状态机
- _交付物_：真相源边界说明 + 收口后的 DTO/API 契约

### [ ] T29 成本与吞吐控制

- 建立单分钟预算器、shot 难度路由、模型选择与降级策略
- 建立多集并发调度、GPU 配额、队列优先级与拥塞控制
- 以单日 300 分钟起步、2000+ 分钟为目标设计容量演进路线
- _交付物_：预算/路由/并发调度方案 + 吞吐压测基线

---

## MVP 切分

### MVP-0（先跑通 — 最小可跑闭环）

| 阶段 | 任务 | 目标 |
|---|---|---|
| 基础设施 | T0.2 | TOS + CLB + MinIO（MQ 已用 Redis 替代） |
| 基础设施 | T0.4 | 连通性验证 |
| 模型部署 | TM.1~TM.5 | GPU 节点 + ComfyUI + LLM + 音频 + 监控 |
| 编排核心 | T1 | LangGraph Orchestrator 骨架 |
| 编排核心 | T2 | Node Registry（26 节点种子） |
| 编排核心 | T3 | Run/NodeRun 状态机 |
| 编排核心 | T4 | 4 Gate 挂起/放行 |
| 编排核心 | T5 | Artifact 索引与固化 |
| 编排核心 | T6 | 质检自动打回 |
| 智能体 | T7 | RAG 知识库（Chroma） |
| 智能体 | T8.1~T8.6 | 6 阶段 Worker Agent（脚本→美术→关键帧→视频→视听→成片） |
| 智能体 | T9 | Model Gateway Adapter |
| 回炉 | T10 | ReturnTicket + RCA |
| 回炉 | T11 | Minimal Rerun Planner |
| 回炉 | T12 | 回炉与新版本 |
| 网关 | T14 | OpenClaw |
| 网关 | T21 | Review Gateway |
| 治理 | T28 | 真相源统一与 Gateway 收口 |

**验收**：能跑通 N01→N26 全链路 + 一次打回重跑 + 质检自动打回生效。

### MVP-1（可运营 — 可观测与管理）

| 阶段 | 任务 | 目标 |
|---|---|---|
| 基础设施 | T0.3 | TLS + Monitor |
| 索引 | T13 | 角色出场索引 |
| 数据 | T15 | 采集与成本归集 |
| 数据 | T16 | Data Center API |
| 数据 | T17 | AI 诊断 |
| 管理页面 | T18 | 绩效后端 |
| 管理页面 | T19 | 大盘后端 |
| 管理页面 | T20 | 节点调试后端 |
| 稳定性 | T22 | 审计与幂等 |
| 稳定性 | T23 | 可观测与告警 |
| 质量 | T25 | 质量评测体系 |
| 交付 | T26 | 双制式交付 |
| 运营 | T27 | 审核团队运营 |
| 成本与吞吐 | T29 | 预算、路由与扩展控制 |
| 进化 | T24 | Reflection / Feedback Learning |

**验收**：管理端展示效率/成本/质量 + 绩效 + 节点调试。

---

## 完成定义（DoD）

1. N01→N26 全链路可跑通（含 4 Gate + TikTok/飞书推送），每阶段（T8.1~T8.6）独立可验收。
2. 6 类 Worker Agent 均可被 Supervisor 调度执行，每阶段验收标准见各 T8.x。
3. RAG 知识库可被 Agent 检索并注入上下文。
4. 质检节点（N03/N11/N15）低于阈值自动打回生效。
5. 任意人工打回可生成 ReturnTicket → rerun plan → v+1。
6. OpenClaw 4 Gate 交互可用。
7. Data Center 展示北极星指标。
8. Performance / Board / Trace 页面展示真实数据。
9. 全流程审计与幂等。
10. 后续主线明确覆盖 Reflection、质量评测、双制式交付、审核团队运营、成本与吞吐控制。
