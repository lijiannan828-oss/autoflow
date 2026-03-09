# 02 — 已实现模块调整清单

> 逐个列出当前已实现的模块需要的具体改动

---

## 1. 后端 — LangGraph 流水线核心

### 1.1 `backend/orchestrator/graph/topology.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| 新增 N07b 节点定义 | order=7.5, stage=2, 与 N07 并行 | 编排运行时 |
| 新增 N16b 节点定义 | order=16.5, stage=4, N16→N16b→N17 | 编排运行时 |
| 更新 NODE_AGENT_ROLE | 全部 26+2 节点映射到 10 Agent (9+1框架) | 编排运行时 |
| 更新 NODE_DEPENDS_ON | N07b 依赖 N06；N16b 依赖 N16；N17 依赖改为 N16b | 编排运行时 |

### 1.2 `backend/orchestrator/graph/state.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| 增加 `agent_traces` 字段 | `list[dict]` — 记录当前 run 的 Agent 决策 trace | 编排运行时 |
| 增加 `cost_budget` 字段 | `dict` — Supervisor 的预算跟踪（spent/remaining/alerts） | 编排运行时 |
| 增加 `project_group_constraints` 字段 | `dict` — Supervisor 读取的项目集约束缓存 | 编排运行时 |

### 1.3 `backend/orchestrator/graph/supervisor.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| 支持并行节点 N07/N07b | supervisor dispatch 时识别并行组，同时推进 | 编排运行时 |
| Supervisor 横切检查 | N02/N05/N09/N14/N17/N23 完成后自动触发 Supervisor 校验（成本+合规+项目需求） | 编排运行时 |

### 1.4 `backend/orchestrator/graph/workers.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| worker 工厂升级 | handler 函数改为 `Agent.execute(context)` 三层决策调用（按 context.mode 分流 plan/shot/review） | 编排运行时 |
| 新增 N07b worker | 音色生成 worker | 编排运行时 |
| 新增 N16b worker | 影调节奏调整 worker | 编排运行时 |

### 1.5 `backend/orchestrator/graph/gates.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| N08 Gate 扩展 | 增加音色候选（来自 N07b）到审核 payload | 编排运行时 |
| Review Dispatcher 集成 | Gate resume 时解析自然语言批注 → 拆分执行任务 | 编排运行时 |

### 1.6 `backend/orchestrator/graph/runtime_hooks.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| `_enrich_payload_for_gate` 扩展 | N08 payload 增加 voice_candidates 字段 | 编排运行时 |
| `_resolve_scope_records` 扩展 | N07b 的 scope record 合并到 N08 Gate | 编排运行时 |

### 1.7 `backend/orchestrator/graph/builder.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| 注册 N07b/N16b 节点 | add_node + 条件边 | 编排运行时 |
| N07/N07b 并行边 | N06 → [N07, N07b]（两条边），N07+N07b → N08 | 编排运行时 |

### 1.8 `backend/orchestrator/graph/context.py`

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| N07b 输入/输出 envelope | 新增音色生成的 envelope builder | 编排运行时 |
| N16b 输入/输出 envelope | 新增影调调整的 envelope builder | 编排运行时 |

---

## 2. 后端 — Handler 模块

### 2.1 所有现有 handler 文件

**共性改动**：每个 handler 函数需要被拆分为对应 Agent 类的三层方法（`plan_episode()` / `execute_shot()` / `review_batch()`），按节点角色映射到相应层级。

具体路径：
- `backend/orchestrator/handlers/script_stage.py` → `ScriptAnalystAgent` / `ShotDesignerAgent`
- `backend/orchestrator/handlers/qc_handlers.py` → `QualityInspectorAgent`
- `backend/orchestrator/handlers/comfyui_gen.py` → `VisualDirectorAgent`
- `backend/orchestrator/handlers/freeze_handlers.py` → `VisualDirectorAgent` / `AudioDirectorAgent` / `CompositorAgent`
- `backend/orchestrator/handlers/av_handlers.py` → `AudioDirectorAgent` / `CompositorAgent`
- `backend/orchestrator/handlers/analysis_handlers.py` → `QualityInspectorAgent` / `ShotDesignerAgent`

**改动模式**（三层决策模型，以 ShotDesigner 为例）：
```python
# 旧模式（每镜头完整 LLM 推理）：
def handle_N02(state: PipelineState) -> dict:
    ...

# 新模式（三层决策）：
class ShotDesignerAgent(BaseAgent):
    agent_name = "shot_designer"

    def plan_episode(self, context: AgentContext) -> dict:
        """第一层：集级策划（N02 触发，1 次 LLM 覆盖全集）"""
        memories = self.read_memory(scope="project", key_prefix="episode_pacing")
        cases = self.search_rag(tags={"genre": context.genre}, top_k=3)
        plan = self._llm_plan(context.episode_script, memories, cases)
        return {"episode_plan": plan, "shot_params": plan["shots"]}

    def execute_shot(self, context: AgentContext, plan: dict) -> dict:
        """第二层：镜头级执行（零 LLM，纯规则+记忆快查）"""
        shot_spec = plan["shots"][context.shot_index]
        params = self._apply_rules(shot_spec, context)
        if params.get("confidence", 1.0) < 0.6:
            params = self._llm_fallback(context, shot_spec)
        return params

    def review_batch(self, context: AgentContext, results: list) -> dict:
        """第三层：批后复盘（1 次多模态 LLM 分析连续性）"""
        review = self._llm_review(results)
        if review["lessons"]:
            self.save_memory(key="pacing_pattern", value=review["lessons"])
        return review
```

### 2.2 新增 handler

| Handler | 节点 | Agent | 说明 |
|---------|------|-------|------|
| `handle_N07b` | N07b | AudioDirectorAgent | CosyVoice/ElevenLabs 音色候选生成 |
| `handle_N16b` | N16b | ShotDesignerAgent + CompositorAgent | FFmpeg 影调调整 + Gemini 决策 |

---

## 3. 后端 — 公共模块

### 3.1 `backend/common/contracts/payload_schemas.py`

| 改动 | 详情 |
|------|------|
| Stage1Payload 扩展 | 增加 `voice_candidates: list[VoiceSampleItem]` |
| 新增 VoiceSampleItem | TypedDict: id, character_id, voice_model, sample_url, duration |
| enrich_stage1_payload 扩展 | 合并 N07b 的音色候选到 Stage1 payload |

### 3.2 `backend/common/contracts/orchestrator_write_api.py`

| 改动 | 详情 |
|------|------|
| 新增 `dispatch_review_annotation` | Review Dispatcher 入口：解析自然语言批注 → 返回任务列表 |
| 新增 `save_agent_memory` | Agent 记忆写入 API |
| 新增 `query_agent_memory` | Agent 记忆查询 API |

### 3.3 `backend/common/contracts/orchestrator_read_api.py`

| 改动 | 详情 |
|------|------|
| 新增 `get_agent_traces` | 读取 Agent 决策 trace |
| 新增 `get_evolution_dashboard` | 进化看板数据（反思报告、A/B 结果、RAG 统计） |
| 新增 `get_project_groups` | 项目集列表 |
| 新增 `get_cost_summary` | 成本汇总（按 run/episode/agent） |

---

## 4. 前端

### 4.1 审核页面

| 页面 | 改动 | 负责 Agent |
|------|------|-----------|
| `/review/art-assets` | 增加音色候选选择卡片（N07b 产物） | 人审入口 |
| `/review/art-assets` | 自然语言批注提交 → 展示 Review Dispatcher 拆解结果 | 人审入口 |
| `/review/visual` | 支持「全部接受 AI 推荐」快速通过按钮 | 人审入口 |
| `/review/audiovisual` | 展示「由 XX Agent 自动调整」提示 | 人审入口 |
| 所有审核页 | 批注提交后展示 dispatcher_tasks JSON 预览 | 人审入口 |

### 4.2 管理后台

| 页面 | 改动 | 负责 Agent |
|------|------|-----------|
| `/admin/` | 新增项目集管理入口 | 人审入口 |
| `/admin/agents/` | **新页面**：Agent 状态面板（10 Agent 运行状态 + trace 查看） | 人审入口 |
| `/admin/evolution/` | **新页面**：进化看板（Reflection 报告、A/B 测试、RAG 统计） | 人审入口 |
| `/admin/costs/` | **新页面**：成本看板（实时成本、预算预警、Agent 维度成本） | 人审入口 |
| `/admin/project-groups/` | **新页面**：项目集 CRUD + 约束配置 | 人审入口 |
| `/admin/drama/[id]` | 节点 trace 升级为 Agent 决策 trace | 人审入口 |

### 4.3 Sprint 看板

| 改动 | 详情 |
|------|------|
| `frontend/lib/sprint-data.ts` | 替换 MVP-0 任务为 v2.2 新任务和进度 |

---

## 5. 配置文件

### 5.1 `.env.local`

新增环境变量：
```
# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=autoflow_rag

# RocketMQ
ROCKETMQ_NAMESRV=localhost:9876
ROCKETMQ_GROUP=autoflow

# CosyVoice（N07b 音色生成）
COSYVOICE_API_URL=http://localhost:8080
```

### 5.2 `backend/common/env.py`

新增上述环境变量的读取。

---

## 6. GPU 依赖模块阻塞说明

> GPU（A800×8）于 03-09 刚到位，ComfyUI 和开源模型均未部署。以下 handler 在运维 Agent 完成 O7/O8/O9（ComfyUI 部署 + 模型下载 + workflow 验证）之前，**只能以 stub 模式运行**。

| Handler 文件 | 节点 | GPU 依赖模型 | 解除阻塞条件 |
|-------------|------|------------|-------------|
| `comfyui_gen.py` | N07 美术生成 | FLUX.2 (txt2img) | 运维 O7+O8 完成 |
| `comfyui_gen.py` | N10 关键帧生成 | FLUX.2 (img2img) | 运维 O7+O8 完成 |
| `comfyui_gen.py` | N14 视频生成 | LTX-2.3 (img2vid) | 运维 O7+O8 完成 |
| 新增 `handle_N07b` | N07b 音色生成 | CosyVoice | 运维 O8 完成 |
| `av_handlers.py` | N20 BGM/SFX | ACE-Step 1.5 + HunyuanFoley | 运维 O8 完成 |

**影响**：编排运行时 Agent 在 Day 1-2 可以完成 handler 代码编写和 Agent 类封装，但真实 GPU 推理测试需等运维 Agent Day 2 完成模型部署后方可进行。Day 3 E2E 验证时应确保 GPU 服务已就绪。

---

## 7. 运维 Agent 对现有基础设施的改动

| 改动 | 详情 | 负责 Agent |
|------|------|-----------|
| GPU 节点网络配置 | 跨子网路由/安全组打通 GPU 节点（10.1.11.110）↔ VKE worker（10.0.0.116/117） | 运维 |
| csi-ebs-node 修复 | GPU 节点上存储驱动 CrashLoopBackOff 修复 | 运维 |
| Helm 安装 | K8s 集群安装 Helm 包管理器 | 运维 |
| Ingress controller | 部署 nginx-ingress 或替代方案 | 运维 |
| PVC 配置 | 为 ComfyUI 模型存储、Qdrant 数据配置持久化卷 | 运维 |
| Docker 镜像构建 | backend + frontend 镜像构建并推送到 CR | 运维 |
| K8s Deployment 更新 | aigc-backend / aigc-front 现有 Deployment 升级 | 运维 |
| `.env.local` 基础设施变量 | 添加 Qdrant/RocketMQ/ComfyUI 连接信息 | 运维 |

---

## 8. 测试 Agent 对现有模块的测试补充

| 测试类型 | 覆盖范围 | 负责 Agent |
|---------|---------|-----------|
| Graph 编译测试升级 | 28 节点（含 N07b/N16b）拓扑验证 + 并行边验证 | 测试 |
| Handler 单元测试 | 每个 handler 函数的输入/输出 mock 测试 | 测试 |
| Agent 基类测试 | BaseAgent.execute / read_memory / save_memory / search_rag / log_trace | 测试 |
| Supervisor 测试 | 横切守卫校验逻辑（成本超限/合规拦截/项目约束） | 测试 |
| Gate 流程测试 | gate_enter → interrupt → update_state → gate_resume 完整流程 | 测试 |
| 前端 E2E 测试 | 审核页面操作流程、Agent 面板数据展示 | 测试 |
