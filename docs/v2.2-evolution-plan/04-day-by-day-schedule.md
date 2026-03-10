# 04 — 三天逐日执行计划（目标：可上线）

> 本计划以 **生产上线** 为最终目标，不是 demo 级别验证。Day 3 结束时所有服务部署在 K8s 上，GPU 真实出图出视频，前后端全部接通真实 API，CI/CD 和监控就位。

---

## Day 1（03-10）：基础设施 + 核心骨架 + 中间件部署

### 目标
- DB 迁移就位，BaseAgent 可用
- N07b/N16b 节点加入拓扑并有 handler
- 前端 Agent 面板 + 音色审核 UI（mock 数据先行）
- Review Dispatcher 核心逻辑
- **⚡ Qdrant + RocketMQ 部署完成 → 解锁 Day 2 真实连接**
- **⚡ GPU 网络打通 + 存储修复 + ComfyUI Pod 就绪 → 解锁 Day 2 模型部署**
- 测试基础架构 + 单元测试框架就位

### 上午（4h）

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 09:00-11:00 | M1 DB迁移 + M2 枚举 | R1 topology升级 | F5 API桥接 | V1 Dispatcher开始 | O1 资源盘点+架构设计 | T1 pytest配置+目录结构 |
| 11:00-13:00 | M3 BaseAgent基类 | R2 state升级 + R3 builder | F1 Agent面板(mock) | V1 Dispatcher继续 | O2 GPU节点网络打通 | T2 后端单元测试开始 |

### 下午（4h）

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 14:00-16:00 | M4 注册表 + M5 agent_memory | R4 N07b handler | F1 Agent面板完成 | V2 任务执行器 | O3 csi-ebs修复 + O4 Helm/Ingress | T2 单元测试 + T3 Graph测试 |
| 16:00-18:00 | M6 rag.py(**mock模式**) + M7 mq.py(**mock模式**) | R5 N16b handler | F2 音色审核UI | V3 dispatch API | **⚡ O5 Qdrant部署** + **⚡ O6 RocketMQ部署** | T3 Graph编译(等R1/R3) |

### 晚上（4h）

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 19:00-21:00 | M8 CLAUDE.md | R6 workers升级 | F3 Dispatcher UI | V4 回炉票据升级 | O7 ComfyUI镜像+GPU Pod | T4 Handler单元测试框架 |
| 21:00-23:00 | 缓冲/自测 | R7 context升级 | F4 快速通过按钮 | 缓冲/自测 | O7 续（确认GPU Pod调度成功） | T4 续+缓冲 |

### Day 1 验收检查点（⚡ = 阻塞 Day 2）

- [ ] `python3 -m backend.orchestrator.graph.test_graph_build` — 含 N07b/N16b 测试通过
- [ ] `from backend.agents.base import BaseAgent` — 可导入
- [ ] `from backend.common.agent_memory import read_memory, save_memory` — 可导入
- [ ] `from backend.common.rag import RagClient` — mock 模式可导入可用
- [ ] `from backend.common.mq import MQClient` — mock 模式可导入可用
- [ ] 前端 `/admin/agents/` 页面可渲染（mock 数据）
- [ ] 前端 `/review/art-assets` 显示音色候选卡片
- [ ] ReviewDispatcherAgent 可解析测试批注
- [ ] **⚡ 运维** GPU 节点网络互通（worker Pod → GPU 节点 ping 成功）
- [ ] **⚡ 运维** csi-ebs-node 不再 CrashLoopBackOff
- [ ] **⚡ 运维** Qdrant Pod Running + health check 200 → **通知主控/回炉解锁 M6b/V5**
- [ ] **⚡ 运维** RocketMQ Running + topic 创建成功 → **通知主控解锁 M7b**
- [ ] **⚡ 运维** ComfyUI GPU Pod 调度成功（nvidia.com/gpu 分配）
- [ ] **测试** `pytest tests/ --co` 可收集所有测试用例
- [ ] **测试** 至少 5 个单元测试通过

---

## Day 2（03-11）：真实基础设施对接 + Agent 集成 + GPU 模型调试

### 目标
- **⚡ 上午第一件事**：M6b/M7b 切换为真实 Qdrant/RocketMQ 连接（依赖 Day 1 运维部署）
- Supervisor/EvolutionEngine 就位，7 生产 Agent 类壳完成
- RAG Qdrant 入库/检索真实可用
- **🔬 开源模型下载 + 逐模型调试 — 确保 N07/N10/N14/N07b handler 真实 GPU 出图/出视频/出音色**
- 前端新页面 + M17 后端 API + F15 前后端联调
- Agent/Dispatcher/RAG 集成测试

### 上午（4h）— 真实连接 + 模型下载启动

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 09:00-11:00 | **M6b Qdrant真实连接** + **M7b RocketMQ真实连接** + M9 payload | R8 并行组dispatch | F6 进化看板开始 | **V5 Qdrant集成**(等M6b) | **O8 模型下载(FLUX.2+LTX-2.3优先)** | T5 Agent集成测试 |
| 11:00-13:00 | M10 Prompt资产库 + M11 cost_events | R9 Supervisor横切检查 | F6 进化看板完成 | V6 RAG入库 | O8 模型下载(续:FireRed+CosyVoice+ACE-Step+HunyuanFoley) | T5 续+T6 Dispatcher测试 |

### 下午（4h）— Agent 核心 + GPU 模型调试

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 14:00-16:00 | M12 SupervisorAgent | R10 预算降级 + R11 N08 Gate扩展 | F7 项目集管理 | V6 RAG入库完成 + V7 检索 | **O9 ComfyUI基线验证** → **O9a FLUX.2+N07调试** | T6 续+T7 RAG集成测试 |
| 16:00-18:00 | M12(续) + M13 EvolutionEngine | R12 runtime_hooks | F8 成本看板 | V7 检索完成 + V8 统计 | **O9b FireRed+N10调试** + **O9c LTX+N14调试** | T7(真实Qdrant)+T8 E2E骨架 |

### 晚上（4h）— 后端 API + 前端联调 + 音色调试

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 19:00-21:00 | **M17 后端API(12命令)** | R12 7个Agent类壳 | F8 成本完成 + F9 drama升级 | 缓冲/自测 | **O9d CosyVoice+N07b调试** + O10 全服务连通性 | T8 前端E2E骨架 |
| 21:00-23:00 | M17 完成 | R13 图编译测试 | **F15 mock→真实API切换** | 缓冲/自测 | O11 Docker镜像+CR推送 | 缓冲/自测 |

### Day 2 验收检查点（⚡ = 阻塞 Day 3 上线）

- [ ] **⚡ 真实基础设施** rag.py 真实 Qdrant 读写成功（M6b）
- [ ] **⚡ 真实基础设施** mq.py 真实 RocketMQ 收发成功（M7b）
- [ ] N07/N07b 并行 dispatch → N08 合并：supervisor 测试通过
- [ ] Supervisor N02 后自动校验（成本+合规+项目需求）：集成测试通过
- [ ] 7 个生产 Agent 类全部可实例化 + execute() 可调用
- [ ] Qdrant 真实写入 → 向量检索 → 返回结果：集成测试通过
- [ ] 前端 `/admin/evolution/` 可渲染
- [ ] 前端 `/admin/project-groups/` CRUD 可操作
- [ ] 前端 `/admin/costs/` 可渲染
- [ ] **前后端联调** M17 全部 12 个 API 实现，F15 mock→真实 API 切换完成
- [ ] **🔬 GPU** FLUX.2 txt2img **通过 N07 handler** 真实出图（非仅 ComfyUI API）
- [ ] **🔬 GPU** N10 两阶段验证: Phase1 LLM prompt编排 + Phase2 FLUX+FireRed 多参考关键帧出图
- [ ] **🔬 GPU** LTX-2.3 **通过 N14 handler** 真实出视频
- [ ] **🔬 GPU** CosyVoice **通过 N07b handler** 真实出音色候选
- [ ] **⚡ 运维** 全服务连通性报告：PG/Redis/TOS/Qdrant/RocketMQ/ComfyUI 全部 VKE Pod 内可达
- [ ] **⚡ 运维** backend + frontend Docker 镜像推送到 CR 成功
- [ ] **测试** Agent 集成测试通过（BaseAgent → execute → memory → trace）
- [ ] **测试** Dispatcher 集成测试通过（批注解析 → 任务拆分）
- [ ] **测试** 前端 E2E 测试框架可运行

---

## Day 3（03-12）：🚀 生产部署 + E2E 贯通 + 上线签核

### 目标
- **K8s 生产部署**：全部服务（backend/frontend/comfyui）部署到 K8s，非本地运行
- N01→N26（含 N07b/N16b）全链路冒烟（**真实 GPU 模式**）
- Dispatcher + RAG E2E 真实验证
- **CI/CD pipeline 可自动触发部署**
- 监控仪表盘可观测 GPU 利用率
- 全链路冒烟测试自动化 + 性能基准
- **上线 checklist 签核**

### 上午（4h）— 生产部署 + E2E 测试

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 09:00-11:00 | M14 合同文档 | R14 图编译测试更新 | F12 前端类型同步 | V9 Dispatcher E2E | **O12 K8s manifests** → **O12b 生产部署** | T9 全链路冒烟(GPU真实模式) |
| 11:00-13:00 | M15 集成验收(真实基础设施) | R15 E2E验证 | F13 前端联通验证 | V10 RAG E2E | **O13 CI/CD pipeline** | T9 续+T10 Gate E2E |

### 下午（4h）— 监控 + 性能 + 上线准备

| 时段 | 主控 | 编排运行时 | 人审入口 | 回炉与版本 | 运维 | 测试 |
|------|------|-----------|---------|-----------|------|------|
| 14:00-16:00 | M15b 生产配置 | R15 E2E(续) | F14 UI打磨 | V11 负向案例 | **O14 监控+GPU仪表盘** | T10 续+T11 性能基准 |
| 16:00-18:00 | M16 sprint更新 | R16 handler注册 | F14 续 | V12 corrective案例 | **O15 弹性伸缩** + **O16 上线checklist** | T11 续+T12 报告+CI集成 |

### 晚上（2-4h）— 🚀 上线签核

| 时段 | 全员 |
|------|------|
| 19:00-21:00 | **全链路回归**：N01→N26（真实GPU）完整跑通 + 前端全页面操作验证 + 生产环境健康检查 |
| 21:00-23:00 | **上线签核**：O16 checklist 逐项确认 + 测试报告汇总 + 文档收尾 + 缓冲修复 |

### Day 3 最终验收 — 🚀 上线标准

**核心功能（必须全部通过才能上线）：**
- [ ] **全链路** N01→N07+N07b→N08→N09→N10→...→N14→...→N16→N16b→N17→N18→...→N26 真实 GPU 模式冒烟通过
- [ ] **GPU 出图** N07 FLUX.2 真实出图 + N10 FireRed 关键帧 + N14 LTX-2.3 出视频 — 全部 K8s Pod 内执行
- [ ] **GPU 音色** N07b CosyVoice 真实出音色候选 — K8s Pod 内执行
- [ ] **Agent 记忆** 至少 1 个 Agent 写入 agent_memory 并可查询（真实 PG）
- [ ] **RAG** 高分 shot 入库 Qdrant → 检索返回（真实 Qdrant）
- [ ] **Dispatcher** 批注 → 解析 → Agent 执行 → 结果回写 review_tasks
- [ ] **Supervisor** 横切守卫生效（成本+合规+项目需求校验）
- [ ] **前端** Agent/进化/成本/项目集 4 新页面 + 4 审核页全部可操作（接真实 API）
- [ ] **前后端联调** M17 全部 12 个 API + F15 真实切换完成

**生产部署（必须全部通过）：**
- [ ] **K8s 部署** backend/frontend/comfyui 全部 Pod Running（非本地 dev server）
- [ ] **服务可达** 外部可通过 LoadBalancer/Ingress 访问前端 + 后端 API
- [ ] **CI/CD** GitHub Actions pipeline 可触发：push → build → test → CR → K8s deploy
- [ ] **监控** Prometheus + Grafana 仪表盘可访问，GPU VRAM/温度/推理延迟可观测
- [ ] **生产配置** .env.production 所有连接串正确，Secret 已注入 K8s

**测试体系（必须全部通过）：**
- [ ] **覆盖率** 关键路径测试覆盖率 >80%
- [ ] **冒烟** 全链路冒烟测试一键自动化（stub + GPU 真实双模式）
- [ ] **E2E** Gate 审核流程 E2E 测试通过
- [ ] **CI** 测试套件集成到 CI/CD pipeline，push 自动触发

**文档与交付：**
- [ ] **合同文档** v2.2-agent-architecture.md + memory-rag-contract.md 完成
- [ ] **sprint-data.ts** 反映 v2.2 全部任务完成状态
- [ ] **O16 上线 checklist** 全项确认签核

---

## 风险缓冲策略

| 风险 | 概率 | 影响 | 缓冲方案 |
|------|:----:|:----:|---------|
| **Day 1 Qdrant/RocketMQ 部署延迟** | **中** | **高**（阻塞 M6b/M7b/V5） | Day 1 M6/M7 已写 mock 模式不阻塞；O5/O6 即使延到 Day 2 上午，M6b/M7b 仅需 1h 切换，不影响 Day 2 整体进度 |
| **Day 1 GPU 网络不通** | **中高** | **高**（阻塞 O7→O8→O9→所有GPU handler） | O2 优先处理；若 VPC peering 受阻，ComfyUI 通过 NodePort/公网 LB 暴露；极端情况 GPU handler 保持 stub 模式上线，后续热更新 |
| **模型下载耗时超预期** | **中** | **中**（延迟 O9a-d GPU 调试） | 优先下载 FLUX.2 + LTX-2.3（核心路径），FireRed/CosyVoice 次之；ACE-Step/HunyuanFoley 可 Day 3 补齐或上线后补 |
| **GPU 模型推理质量不达标** | **中** | **中** | O9a-d 调试时记录基线指标；质量不达标的模型标记为 "需调参"，不阻塞上线，生产环境走降级路径 |
| csi-ebs 无法修复 | 低中 | 中 | hostPath 或 NFS 挂载模型目录，绕过 EBS CSI 驱动 |
| N07b CosyVoice 不可用 | 中 | 低 | N07b handler 走 ElevenLabs API 降级 |
| 前端页面做不完 | 低 | 低 | P0: Agent面板+音色审核；P1: 进化/成本看板可简化为表格；P2: 项目集页延后 |
| BaseAgent 设计返工 | 低 | 中 | 保持极简 5 方法接口，不过度设计 |
| CI/CD pipeline 配置复杂 | 低 | 低 | 先手动 docker build + kubectl apply 上线，CI/CD Day 3 后补 |
| **K8s 生产部署失败** | **低中** | **高** | O12b 前先在 dev namespace 验证，确认后再部署 prod；保留回滚方案 |

---

## 成功标准 — 「可上线」定义

> 以下全部通过 = 系统可上线。按优先级分为 P0（必须）/ P1（强烈建议）/ P2（上线后补齐）。

### P0 — 上线硬性要求（全部必须通过）

| # | 标准 | 验证方式 |
|---|------|---------|
| 1 | 28 节点 LangGraph 流水线可编译和执行 | `test_graph_build` 全部通过 |
| 2 | 10 Agent 全部注册，execute() 可调用 | 单元测试验证 |
| 3 | 三层记忆可读写（State / PG agent_memory / **真实 Qdrant**） | 集成测试 + 真实 Qdrant 连接 |
| 4 | N07/N10/N14 handler **真实 GPU 出图出视频** | O9a/O9b/O9c 验证记录 |
| 5 | N07b handler **真实 GPU 出音色候选** | O9d 验证记录 |
| 6 | Review Dispatcher 可解析批注并派发任务 | V9 E2E 测试 |
| 7 | Supervisor 横切守卫生效（成本+合规） | R9/R10 集成测试 |
| 8 | 前端 4 审核页 + 4 新页面接通**真实 API** | F15 联调验证 |
| 9 | **全部服务部署在 K8s**（非本地 dev server） | O12b 部署验证 |
| 10 | PG/Redis/TOS/Qdrant/RocketMQ/ComfyUI **VKE Pod 内全部可达** | O10 连通性报告 |
| 11 | N01→N26 全链路冒烟通过（真实 GPU 模式） | T9 自动化测试 |

### P1 — 强烈建议上线前完成

| # | 标准 | 验证方式 |
|---|------|---------|
| 12 | CI/CD pipeline 可自动触发 build → deploy | O13 pipeline 运行 |
| 13 | 监控仪表盘可访问，GPU VRAM/推理延迟可观测 | O14 Grafana 截图 |
| 14 | 关键路径测试覆盖率 >80% | T12 coverage 报告 |
| 15 | Prompt 资产库三层架构可加载 | M10 单元测试 |
| 16 | Evolution Engine 每日反思可运行 | M13 验证 |
| 17 | .env.production 全部配置正确 + K8s Secret 注入 | M15b 验证 |

### P2 — 上线后可补齐

| # | 标准 |
|---|------|
| 18 | ACE-Step 1.5 BGM + HunyuanFoley SFX 模型真实推理 |
| 19 | 弹性伸缩 HPA 策略调优 |
| 20 | RAG 负向/corrective 案例入库 |
| 21 | 性能基准测试完整报告 |
| 22 | 灾备恢复演练 |
