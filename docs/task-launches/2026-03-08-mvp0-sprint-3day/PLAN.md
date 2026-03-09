# MVP-0 三日冲刺：全管线真实接通

## 元信息

| 项 | 值 |
|---|---|
| 启动日期 | 2026-03-08 |
| 目标 | 26 节点管线端到端真实运行（非 mock） |
| 前提 | 第八轮已完成 LangGraph 骨架 + N01-N03 确定性 handler |
| GPU | 1×A100 80G（采购中，预计 Day 2 到位） |
| LLM API | dmxapi.cn OpenAI 兼容代理（key 已有） |

---

## 一、Agent 分工总览

共 **8 个 Agent**，按文件所有权严格隔离。

```
Agent-α (Infra)        ──── Day1 上午优先完成，其余 Agent 依赖它
  │
  ├── Agent-β (Script)  ──── N01 N02 N04 N05 N06
  ├── Agent-γ (QC)      ──── N03 N11 N15
  ├── Agent-δ (ComfyUI) ──── N07 N10 N14 + ComfyUI 适配器  ⚠️ 阻塞于 GPU
  ├── Agent-ε (Freeze)  ──── N09 N13 N17 N19 N22 N25 N26
  ├── Agent-ζ (AV)      ──── N12 N16 N20 N23
  ├── Agent-η (Node Inspect) ─── 节点流转可视化 + 调试页（给制片人看质量/调参）
  └── Agent-θ (Review)  ──── 4 审核工作流页接真实 API（给质检人员用）
```

---

## 二、文件所有权矩阵（核心防撞规则）

### Agent-α：基础设施与布线

**创建（新文件）：**

| 文件路径 | 用途 |
|---------|------|
| `backend/common/llm_client.py` | LLM 统一调用客户端（OpenAI 兼容） |
| `backend/common/tos_client.py` | TOS 上传/下载/URL 生成 |
| `backend/common/docx_parser.py` | .docx 预处理（N01 输入） |
| `backend/orchestrator/handlers/__init__.py` | Handler 注册入口（导入所有 handler 模块） |
| `backend/orchestrator/comfyui_client.py` | ComfyUI HTTP API 客户端 |

**修改（已有文件）：**

| 文件路径 | 修改内容 |
|---------|---------|
| `.env.local` | 新增 `LLM_API_KEY`, `LLM_BASE_URL`, `COMFYUI_BASE_URL`, `AUDIO_API_BASE_URL`, `AUDIO_API_KEY` |
| `backend/common/env.py` | 新增 LLM/ComfyUI/Audio 环境变量读取函数 |
| `backend/orchestrator/graph/__init__.py` | 添加 `from backend.orchestrator.handlers import register_all_handlers` |

**禁止其他 Agent 触碰以上文件。**

---

### Agent-β：脚本阶段（LLM 节点）

**创建（新文件）：**

| 文件路径 | 节点 |
|---------|------|
| `backend/orchestrator/handlers/script_stage.py` | N01, N02, N04, N05, N06 |

**不得修改** `backend/orchestrator/graph/script_handlers.py`（已有旧 handler，保留作为回退参考）。

---

### Agent-γ：质检投票

**创建（新文件）：**

| 文件路径 | 节点 |
|---------|------|
| `backend/orchestrator/handlers/qc_handlers.py` | N03, N11, N15 |

---

### Agent-δ：ComfyUI 生成

**创建（新文件）：**

| 文件路径 | 节点 |
|---------|------|
| `backend/orchestrator/handlers/comfyui_gen.py` | N07, N10, N14 |

**依赖** Agent-α 的 `comfyui_client.py`。Day 2 GPU 到位后启动。

---

### Agent-ε：固化与分发

**创建（新文件）：**

| 文件路径 | 节点 |
|---------|------|
| `backend/orchestrator/handlers/freeze_handlers.py` | N09, N13, N17, N19, N22, N25, N26 |

---

### Agent-ζ：分析与视听

**创建（新文件）：**

| 文件路径 | 节点 |
|---------|------|
| `backend/orchestrator/handlers/analysis_handlers.py` | N12, N16 |
| `backend/orchestrator/handlers/av_handlers.py` | N20, N23 |

---

### Agent-η：节点检视与调试（Node Inspection & Debug）

**修改范围限定为 `frontend/` 目录**，不得触碰 `backend/`。

**职责**：节点流转可视化 + 节点参数调试页。面向管线开发者/制片人，用于观察各环节输出质量和调优参数。

| 修改文件 | 内容 |
|---------|------|
| `frontend/app/admin/drama/[id]/page.tsx` | 增强节点详情页：分 Tab 展示每个节点的输入/输出/提示词/过程产物 |
| `frontend/app/admin/debug/page.tsx` | 新建节点调试页：26 节点参数平铺，支持手动输入测试 |
| `frontend/components/node-*.tsx` | 节点相关新组件 |
| `frontend/lib/node-debug-types.ts` | 调试页类型定义 |
| `frontend/app/api/orchestrator/node-debug/**` | 节点单步执行 API route |

---

### Agent-θ：审核工作流（Review Workflow）

**修改范围限定为 `frontend/` 目录**，不得触碰 `backend/`。

**职责**：4 个审核页面从 mock 切换到真实数据。面向质检人员/审核员，用于执行 Gate 审核决策。

| 修改文件 | 内容 |
|---------|------|
| `frontend/app/review/art-assets/page.tsx` | 接真实 review-tasks + 候选图 URL |
| `frontend/app/review/visual/page.tsx` | 接真实 shot 级 review-tasks |
| `frontend/app/review/audiovisual/page.tsx` | 接真实视听审核数据 |
| `frontend/app/review/final/page.tsx` | 接真实成片视频 URL |
| `frontend/app/admin/orchestrator/acceptance/page.tsx` | 接真实 north-star-summary API |
| `frontend/lib/python-read-api.ts` | 确保 API 调用指向真实后端 |
| `frontend/app/api/orchestrator/**` | 路由确保返回真实数据 |

---

## 2.5、模型选型策略（2026-03-09 确认）

> **此节为所有 Agent 的模型选择唯一真相源。Handler 不得自行硬编码模型名称。**

### 脚本阶段（Agent-β：N01 N02 N04 N05 N06）

| 优先级 | 模型 | 角色 |
|:------:|------|------|
| 1 | `gemini-3.1-pro-preview` | 主力模型 — 推理能力强，适合复杂剧本结构化 |
| 2 | `claude-opus-4-6` | 首选降级 — gemini 失败或超时(>90s)时启用 |
| 3 | `gemini-2.5-pro` / `claude-sonnet-4-6` | 二梯队降级 |

**用法**：`call_llm(SCRIPT_STAGE_MODEL, ...)` — 内置重试 3 次 + 自动降级。
常量 `SCRIPT_STAGE_MODEL` 已定义在 `llm_client.py`。

### 分镜质检（Agent-γ：N03 N11 N15）

三模型同时投票，每个模型独立重试→降级：

| 模型 | 降级链 |
|------|--------|
| `gemini-3.1-pro-preview` | → `claude-opus-4-6` → `gemini-2.5-pro` |
| `claude-opus-4-6` | → `gemini-3.1-pro-preview` → `claude-sonnet-4-6` |
| `gpt-5.4` | → `gpt-5` → `gpt-4o` |

**用法**：`call_llm_multi_vote(QC_VOTE_MODELS, ...)` — 常量已定义在 `llm_client.py`。
至少 2/3 模型返回即可投票；全失败才报错。

### 分析与视听（Agent-ζ：N12 N16）

多模态分析（传图/视频帧）用 `gemini-3.1-pro-preview`（视觉推理能力最强）。

### 降级机制（llm_client.py 已内置）

1. **重试**：每个模型最多 3 次，指数退避 1s→2s→4s + jitter
2. **可重试错误**：429/500/502/503/504 + 网络超时
3. **降级**：主模型 3 次均失败 → 自动切到 `MODEL_FALLBACKS` 链中的下一个模型
4. **日志**：每次降级都写 WARNING 日志，便于事后分析

### 成本预估（单次调用，~400 字输入 → 分镜 JSON 输出）

| 模型 | 延迟 | 费用/次 | 备注 |
|------|------|---------|------|
| gemini-3.1-pro-preview | ~86s | ~0.18¥ | 推理 token 多，质量高 |
| claude-opus-4-6 | ~49s | ~0.33¥ | 最贵，质量极高 |
| gpt-5.4 | ~44s | ~0.09¥ | 性价比好 |
| gpt-4o | ~5s | ~0.04¥ | 最快，适合低优先级 |
| gemini-2.0-flash | ~9s | ~0.002¥ | 最便宜，适合预处理/降级 |

---

## 三、接口契约（Agent 间依赖的函数签名）

### 3.1 `backend/common/llm_client.py`（Agent-α 创建，β/γ/ζ 消费）

```python
"""OpenAI 兼容的 LLM 统一客户端。含重试、降级、成本追踪。"""

from dataclasses import dataclass

@dataclass
class LLMResponse:
    content: str                    # 原始文本响应
    parsed: dict | None             # 如果请求了 JSON 模式，自动解析
    model: str                      # 实际使用的模型（可能是降级后的）
    usage: dict                     # {"prompt_tokens": int, "completion_tokens": int}
    cost_cny: float                 # 本次调用费用（68折后）
    duration_s: float               # 耗时

# ── 模型选型常量（Handler 统一引用这里） ──
SCRIPT_STAGE_MODEL = "gemini-3.1-pro-preview"    # 脚本阶段主力
QC_VOTE_MODELS = ["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"]  # QC 三模型投票

def call_llm(
    model: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.3,
    max_tokens: int = 16384,
    json_mode: bool = False,
    images: list[str] | None = None,
    max_retries: int = 3,           # 每个模型重试次数
    fallback: bool = True,          # 是否启用降级链
) -> LLMResponse:
    """同步调用 LLM。内置重试+降级。失败抛出 LLMError。"""
    ...

def call_llm_multi_vote(
    models: list[str],              # 投票模型列表（如 QC_VOTE_MODELS）
    system_prompt: str,
    user_prompt: str,
    *,
    fallback: bool = True,          # 每个模型独立降级
    **kwargs,
) -> list[LLMResponse]:
    """多模型并行调用，返回所有响应。用于 QC 投票。"""
    ...

class LLMError(Exception):
    """LLM 调用失败。"""
    ...
```

**环境变量：**
```
LLM_BASE_URL=https://www.dmxapi.cn/v1
LLM_API_KEY=sk-0KLEyMoBmvLztN1v1tOrRJWF58SEYp7NY36qo6ri0O7tvmQp
```

### 3.2 `backend/common/tos_client.py`（Agent-α 创建，β/ε/ζ 消费）

```python
"""火山引擎 TOS 对象存储客户端。"""

def upload_json(key: str, data: dict) -> str:
    """上传 JSON 到 TOS，返回 tos:// URL。
    key 格式: "{episode_version_id}/{node_id}/{filename}.json"
    """
    ...

def upload_bytes(key: str, content: bytes, content_type: str) -> str:
    """上传二进制文件（图片/视频/音频），返回 tos:// URL。"""
    ...

def download_json(tos_url: str) -> dict:
    """从 tos:// URL 下载 JSON。"""
    ...

def download_bytes(tos_url: str) -> bytes:
    """从 tos:// URL 下载二进制。"""
    ...

def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """生成预签名 HTTP URL（用于前端展示）。"""
    ...

# 常量
BUCKET = "autoflow-media-2102718571-cn-shanghai"
ENDPOINT = "tos-cn-shanghai.volces.com"
```

### 3.3 `backend/common/docx_parser.py`（Agent-α 创建，Agent-β 消费）

```python
"""剧本 .docx 预处理器。"""
from dataclasses import dataclass

@dataclass
class RawScriptInput:
    script_text: str                    # 剧本正文
    narrative_arc: dict | None          # 三幕结构（如有）
    character_presets: list[dict]       # 角色预设
    production_requirements: dict       # 制作要求
    existing_storyboard: dict | None    # 已有分镜（如有）
    project_meta: dict | None           # 项目管理信息

def parse_docx(file_path: str) -> RawScriptInput:
    """解析 .docx 剧本文件，按 node-spec-sheet N01 预处理规则拆分。"""
    ...
```

### 3.4 `backend/orchestrator/comfyui_client.py`（Agent-α 创建，Agent-δ 消费）

```python
"""ComfyUI HTTP API 客户端。"""
from dataclasses import dataclass

@dataclass
class ComfyUIJob:
    prompt_id: str
    status: str                 # "queued" | "running" | "completed" | "failed"
    outputs: dict | None        # 完成后的输出节点数据

def submit_workflow(
    workflow_json: dict,
    *,
    base_url: str | None = None,    # 默认从环境变量读
) -> str:
    """提交 workflow 到 ComfyUI，返回 prompt_id。"""
    ...

def poll_until_complete(
    prompt_id: str,
    *,
    timeout_s: int = 600,
    poll_interval_s: int = 5,
) -> ComfyUIJob:
    """轮询直到完成或超时。"""
    ...

def download_output_image(prompt_id: str, node_id: str, index: int = 0) -> bytes:
    """下载生成的图片。"""
    ...

def download_output_video(prompt_id: str, node_id: str, index: int = 0) -> bytes:
    """下载生成的视频。"""
    ...
```

### 3.5 音频/音乐 API 配置（Agent-α 配置，Agent-ζ 消费）

所有音频类 API 统一通过 kie.ai 代理调用，共享同一 API key。

```python
from backend.common.env import get_audio_api_base_url, get_audio_api_key

# get_audio_api_base_url() → "https://api.kie.ai"
# get_audio_api_key()      → "4d90460e54f1a3eaa63cdb3baab89bcc"
```

| 服务 | 用途 | 对应 N20 子步骤 |
|------|------|----------------|
| **ElevenLabs** (TTS) | 语音合成 | ① TTS |
| **ElevenLabs sound-effect-v2** | 声效生成 | ④ SFX |
| **Suno** | BGM 生成 | ③ BGM |
| **LatentSync 1.5** | 唇形同步 | ② Lip Sync（GPU 自部署，非 kie.ai） |

**环境变量**（`.env.local`）：
```
AUDIO_API_BASE_URL=https://api.kie.ai
AUDIO_API_KEY=4d90460e54f1a3eaa63cdb3baab89bcc
```

**已验证的 API Endpoints（2026-03-09）**：

| 服务 | 方法 | Endpoint | 状态 |
|------|------|----------|------|
| ElevenLabs TTS | POST | `/api/v1/jobs/createTask` | ✅ ~6s |
| ElevenLabs SFX | POST | `/api/v1/jobs/createTask` | ✅ ~10s |
| 任务查询 (TTS/SFX) | GET | `/api/v1/jobs/recordInfo?taskId=` | ✅ |
| Suno BGM | POST | `/api/v1/generate` (需 callBackUrl) | ✅ 异步 |
| 任务查询 (Suno) | GET | `/api/v1/generate/record-info?taskId=` | ✅ |

---

### 3.6 Handler 统一模式（所有 Handler Agent 遵循）

每个 handler 函数必须符合以下签名，并在模块底部注册：

```python
from backend.orchestrator.graph.workers import register_handler
from backend.orchestrator.graph.state import PipelineState, NodeResult
from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_node_output_payload,
)

def handle_n01(node_id: str, state: PipelineState, config: dict) -> NodeResult:
    """
    返回 NodeResult，包含：
    - node_id: str
    - status: "succeeded" | "failed"
    - output_ref: str              # TOS URL 或 stub://
    - output_payload: dict         # 结构化输出数据
    - output_envelope: dict        # NodeOutputEnvelope 完整包装
    - cost_cny: float
    - gpu_seconds: float
    - duration_s: float
    - artifact_ids: list[str]      # 写入 artifacts 表后的 ID 列表
    - model_provider: str | None
    - model_endpoint: str | None
    - quality_score: float | None  # QC 节点填写
    """
    ...

# 模块底部注册
def register():
    register_handler("N01", handle_n01)
```

### 3.7 `backend/orchestrator/handlers/__init__.py`（Agent-α 创建）

```python
"""统一注册所有真实 handler。"""

def register_all_handlers():
    """导入所有 handler 模块并注册。在 pipeline 启动时调用。"""
    from backend.orchestrator.handlers import script_stage
    from backend.orchestrator.handlers import qc_handlers
    from backend.orchestrator.handlers import comfyui_gen
    from backend.orchestrator.handlers import freeze_handlers
    from backend.orchestrator.handlers import analysis_handlers
    from backend.orchestrator.handlers import av_handlers

    script_stage.register()
    qc_handlers.register()
    comfyui_gen.register()
    freeze_handlers.register()
    analysis_handlers.register()
    av_handlers.register()
```

---

## 四、分阶段时间表

### Phase 0：Agent-α 基础设施（Day 1 上午，2-3h）

**必须最先完成，其余 Agent 全部依赖它。**

| 序号 | 任务 | 产出文件 | 验收 |
|:----:|------|---------|------|
| α.1 | `.env.local` 添加 LLM 环境变量 | `.env.local` | 变量可读 |
| α.2 | `llm_client.py` — 实现 `call_llm` + `call_llm_multi_vote` | `backend/common/llm_client.py` | 调用 dmxapi 返回正常响应 |
| α.3 | `tos_client.py` — 封装 TOS 上传/下载 | `backend/common/tos_client.py` | 上传 JSON 后能下载回来 |
| α.4 | `docx_parser.py` — 解析测试剧本 .docx | `backend/common/docx_parser.py` | 解析 `test-data/*.docx` 输出 RawScriptInput |
| α.5 | `comfyui_client.py` — ComfyUI HTTP 客户端（可先写代码，GPU 到后测） | `backend/orchestrator/comfyui_client.py` | 代码可导入无报错 |
| α.6 | `handlers/__init__.py` — 注册入口 | `backend/orchestrator/handlers/__init__.py` | 可调用 `register_all_handlers()` |
| α.7 | 修改 `graph/__init__.py` — 接入新 handler | `backend/orchestrator/graph/__init__.py` | 图编译使用新 handler |

**α 完成信号**：在 `handlers/__init__.py` 同级创建 `_INFRA_READY` 空文件，其余 Agent 可以启动。

---

### Phase 1：LLM 节点并行开发（Day 1 下午 + 晚上）

α 完成后，以下 4 个 Agent **同时启动**：

#### Agent-β：脚本阶段（N01 N02 N04 N05 N06）

| 序号 | 节点 | 核心逻辑 | 依赖的共享模块 |
|:----:|------|---------|--------------|
| β.1 | **N01** | `docx_parser.parse_docx()` → `call_llm(SCRIPT_STAGE_MODEL)` → ParsedScript JSON → 上传 TOS | llm_client, tos_client, docx_parser |
| β.2 | **N02** | 读 N01 output → `call_llm(SCRIPT_STAGE_MODEL)` → EpisodeScript per episode | llm_client, tos_client |
| β.3 | **N04** | 读 N02+N03 output → 如果无 issue 直接盖章，否则 `call_llm(SCRIPT_STAGE_MODEL)` 微调 | llm_client, tos_client |
| β.4 | **N05** | 读 N04 output → `call_llm(SCRIPT_STAGE_MODEL)` 镜头分级 S0/S1/S2 + qc_tier | llm_client |
| β.5 | **N06** | 读 N04+N05 output → `call_llm(SCRIPT_STAGE_MODEL)` 生成 ArtGenerationPlan | llm_client, tos_client |
| β.6 | 冒烟 | 串行跑 N01→N02→N04→N05→N06，验证 TOS 产物 | — |

**产出文件**：`backend/orchestrator/handlers/script_stage.py`
**Prompt 来源**：`node-spec-sheet.md` N01-N06 章节的 System/User Prompt

---

#### Agent-γ：QC 投票（N03 N11 N15）

| 序号 | 节点 | 核心逻辑 | 模型 |
|:----:|------|---------|------|
| γ.1 | **N03** | 读 N02 output → `call_llm_multi_vote(QC_VOTE_MODELS)` → 6 维评分 → 去极值平均 → <8.0 打回 | gemini-3.1-pro + opus-4-6 + gpt-5.4 |
| γ.2 | **N11** | 读 N10 候选关键帧 → 按 qc_tier 从 `QC_VOTE_MODELS` 选模型数 → 多维评分 → 自动选最佳 → <7.5 打回 | 1-3 模型 |
| γ.3 | **N15** | 读 N14 候选视频 → 按 qc_tier 从 `QC_VOTE_MODELS` 选模型数 → 8 维评分 → 自动选最佳 → <7.5 或单维<5.0 打回 | 1-3 模型 |

**产出文件**：`backend/orchestrator/handlers/qc_handlers.py`
**注意**：N11/N15 的多模态评分（传图/传视频帧）需要用 `llm_client` 的 `images` 参数。Day 1 先实现纯文本评分逻辑，Day 2 GPU 到后补图/视频输入。

---

#### Agent-ε：固化节点（N09 N13 N17 N19 N22 N25 N26）

| 序号 | 节点 | 核心逻辑 |
|:----:|------|---------|
| ε.1 | **N09** | 读 N08 审核决策 + N07 候选 → 选定候选上传 TOS → 标记 frozen |
| ε.2 | **N13** | 读 N11 选定关键帧 + N12 连续性报告 → 无 issue 直接固化 → 有 issue 标记 |
| ε.3 | **N17** | 读 N15 选定视频 + N16 节奏报告 → FFmpeg trim（如需） → 上传 TOS |
| ε.4 | **N19** | 读 N18 Gate 通过 → 标记所有视频 frozen |
| ε.5 | **N22** | 读 N21 Gate 通过 → 标记所有视听产物 frozen |
| ε.6 | **N25** | 读 N24 Gate 通过 → 标记成片 delivered → 归档策略 |
| ε.7 | **N26** | 读 N25 output → 分发 stub（记录 DistributionRecord，不真实推送） |

**产出文件**：`backend/orchestrator/handlers/freeze_handlers.py`
**特点**：这 7 个节点逻辑最简单（读上游 → 写 TOS → 写 DB），可以最快完成。

---

#### Agent-ζ：分析与视听（N12 N16 N20 N23）

| 序号 | 节点 | 核心逻辑 | 阻塞情况 |
|:----:|------|---------|---------|
| ζ.1 | **N12** | 读全集关键帧 → `call_llm(SCRIPT_STAGE_MODEL, images=帧列表)` → ContinuityReport | Day 1 先写纯文本版 |
| ζ.2 | **N16** | 读全集视频 → 抽帧 → `call_llm(SCRIPT_STAGE_MODEL, images=帧列表)` → PacingReport | Day 1 先写纯文本版 |
| ζ.3 | **N20** | TTS(ElevenLabs) + 唇形同步(LatentSync) + BGM(Suno) + 声效(ElevenLabs) + 混音 + 字幕 | 需接通 kie.ai API |
| ζ.4 | **N23** | FFmpeg 合成：拼接视频 + 混音 + 字幕烧录 + 水印 | 纯 CPU，不依赖 GPU |

**产出文件**：
- `backend/orchestrator/handlers/analysis_handlers.py`（N12, N16）
- `backend/orchestrator/handlers/av_handlers.py`（N20, N23）

**N20 视听整合 — 子步骤与选型（严格遵循 node-spec-sheet）**：

| 子步骤 | 工具/模型 | 部署方式 | API 配置 |
|--------|----------|---------|---------|
| ① TTS 语音合成 | **ElevenLabs** | kie.ai 三方 API 代理 | `AUDIO_API_BASE_URL` + `AUDIO_API_KEY` |
| ② 唇形同步 | **LatentSync 1.5** | 开源自部署 (GPU) | ComfyUI 节点 or 独立推理 |
| ③ BGM 生成 | **Suno** | kie.ai 三方 API 代理 | 同上 API key |
| ④ 声效 (SFX) | **ElevenLabs sound-effect-v2** | kie.ai 三方 API 代理 | 同上 API key |
| ⑤ 混音 | **Geek_AudioMixer** (ComfyUI) 或 FFmpeg 混音 | — | — |
| ⑥ 字幕生成 | 文本 + STT 轴对齐 | 代码逻辑 | — |

**API 环境变量**（已写入 `.env.local` 和 `env.py`）：
```
AUDIO_API_BASE_URL=https://api.kie.ai
AUDIO_API_KEY=4d90460e54f1a3eaa63cdb3baab89bcc
```
读取方式：`from backend.common.env import get_audio_api_base_url, get_audio_api_key`

**kie.ai API 调用规范（2026-03-09 已验证全部调通）**：

```
认证头: Authorization: Bearer {AUDIO_API_KEY}

┌─────────────────────────────────────────────────────────────────────┐
│ ElevenLabs TTS / SFX — 统一异步任务接口                              │
├─────────────────────────────────────────────────────────────────────┤
│ 提交任务:  POST https://api.kie.ai/api/v1/jobs/createTask          │
│ 查询结果:  GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=  │
│                                                                     │
│ TTS body:                                                           │
│   {                                                                 │
│     "model": "elevenlabs/text-to-speech-multilingual-v2",           │
│     "input": { "text": "...", "voice": "Rachel" }                   │
│   }                                                                 │
│                                                                     │
│ SFX body:                                                           │
│   {                                                                 │
│     "model": "elevenlabs/sound-effect-v2",                          │
│     "input": {                                                      │
│       "text": "door knock",                                         │
│       "duration_seconds": 3,                                        │
│       "output_format": "mp3_44100_128"                              │
│     }                                                               │
│   }                                                                 │
│                                                                     │
│ 响应: {"code":200,"data":{"taskId":"xxx","recordId":"xxx"}}         │
│ 结果: resultJson.resultUrls[0] → mp3 下载链接                       │
│ TTS 耗时 ~6s, SFX 耗时 ~10s                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Suno BGM — 独立音乐生成接口（必须传 callBackUrl）                     │
├─────────────────────────────────────────────────────────────────────┤
│ 提交任务:  POST https://api.kie.ai/api/v1/generate                 │
│ 查询结果:  GET  https://api.kie.ai/api/v1/generate/record-info?    │
│                 taskId=                                              │
│                                                                     │
│ body:                                                               │
│   {                                                                 │
│     "prompt": "Tense orchestral thriller BGM",                      │
│     "customMode": false,                                            │
│     "instrumental": true,                                           │
│     "model": "V4",                                                  │
│     "callBackUrl": "https://your-server/callback"                   │
│   }                                                                 │
│ 模型: V3_5 / V4 / V4_5 / V4_5PLUS / V5                             │
│ 异步生成，通过 callback 或轮询获取结果                                │
└─────────────────────────────────────────────────────────────────────┘
```

**MVP-0 优先级**：先确保 ①TTS + ③BGM + ④声效 的 API 调通（✅ 已全部验证），② 唇形同步待 GPU 到位后接入。

**N23 实现策略**：
```python
# 纯 FFmpeg，不依赖任何 AI 模型
ffmpeg -i concat_list.txt -i mixed_audio.wav \
       -vf "subtitles=subs.ass" \
       -c:v libx264 -preset fast -crf 23 \
       -c:a aac -b:a 128k \
       output.mp4
```

---

### Phase 2：ComfyUI 接入（Day 2，GPU 到位后）

#### Agent-δ：ComfyUI 生成（N07 N10 N14）

**前置条件**：A100 在线 + ComfyUI 部署 + 模型权重下载完毕

| 序号 | 节点 | 工作流 | 核心逻辑 |
|:----:|------|--------|---------|
| δ.1 | **N07** | `wf-art-assets`（需搭建） | 读 N06 ArtGenerationPlan → 为每个资产构建 FLUX.2 workflow JSON → 提交 ComfyUI → 收集候选图 |
| δ.2 | **N10** | `wf-keyframe-generate`（需搭建） | 读 ShotSpec + FrozenArtAsset → 构建 FLUX.2+FireRed workflow → 提交 → 收集候选帧 |
| δ.3 | **N14** | `Ltx2 四关键帧生视频.json`（已有） | 读 FrozenKeyframe → 修改现有 LTX workflow 参数 → 提交 → 收集候选视频 |

**产出文件**：`backend/orchestrator/handlers/comfyui_gen.py`

**ComfyUI Workflow 搭建优先级**：
1. **N14 最先**（已有现成 workflow，改参数即可）
2. **N07 其次**（FLUX.2 txt2img workflow 社区大量现成）
3. **N10 最后**（需要 FLUX + FireRed + ControlNet 组合，最复杂）

---

### Phase 3：集成与贯通（Day 2 晚 + Day 3）

#### 所有 Agent 冻结代码，进入集成阶段

| 序号 | 任务 | 负责 |
|:----:|------|------|
| 1 | `register_all_handlers()` 确保所有 handler 正确注册 | Agent-α |
| 2 | N01→N08 真实链跑通（脚本→美术→Gate暂停） | Agent-β + α |
| 3 | Gate 审核 approve → N09→N18 继续 | Agent-α |
| 4 | N01→N26 完整 E2E 跑通 | 全员 |
| 5 | 前端 review 页面展示真实审核任务 | Agent-η |
| 6 | 前端 admin 页面展示真实 node trace | Agent-η |

#### Agent-η：节点检视与调试（Day 2-3）

**面向**：管线开发者 / 制片人 — 看过程交付质量、调优参数

| 序号 | 页面 | 改动 |
|:----:|------|------|
| η.1 | `/admin/drama/[id]` 增强 | 节点流转全程可视化：分 Tab 展示每个节点的输入/输出/提示词/过程产物（如 QC 多模型分数、候选图集、FFmpeg 命令），支持 JSON 展开/折叠、图片/视频内联预览 |
| η.2 | `/admin/debug` 新建 | 节点参数调试页：26 节点平铺卡片，每个节点暴露所有可配参数（提示词模板、temperature、candidate_count、分辨率、QC 阈值等），支持手动输入 → 单步执行 → 查看输出结果 |

**η.1 节点详情页设计要点**：
- 左侧：Phase 手风琴 + 节点列表（已有），点击节点高亮
- 中央分 Tab：「输入」「输出」「提示词」「过程产物」「日志」
  - 输入 Tab：展示 `load_node_output_payload()` 读取的上游数据（JSON 树 + 图片/视频缩略图）
  - 输出 Tab：展示 `NodeResult.output_payload`（JSON 树 + 候选图/视频网格）
  - 提示词 Tab：展示 System Prompt 和 User Prompt 全文，支持 diff 对比（如 N04 修改 vs N02 原文）
  - 过程产物 Tab：QC 节点→各模型独立评分+去极值详情；ComfyUI 节点→workflow JSON+seed；AV 节点→各轨道音频
  - 日志 Tab：节点执行日志流（duration / cost / error / retries）
- 右侧：遥测面板（已有），增加 cost breakdown 和重试次数

**η.2 调试页设计要点**：
- 页面分为 5 个 Stage 区块，每个区块包含该阶段的节点卡片
- 每个节点卡片包含：
  - 参数表单：所有可配置参数（从 handler 代码提取默认值预填）
  - 输入区：可粘贴/上传 JSON 作为该节点输入（或从上一个节点输出自动填充）
  - 「执行」按钮：调用后端 API 单步执行该节点
  - 输出区：显示执行结果（JSON + 图片/视频预览）
- 参数默认值参考表（已从后端 handler 提取，见下方）

**η.2 各节点默认参数速查**：

| 节点 | 模型 | Temperature | Max Tokens | 关键参数 |
|------|------|:-----------:|:----------:|----------|
| N01 | gemini-3.1-pro | 0.3 | 16384 | timeout=180s |
| N02 | gemini-3.1-pro | 0.5 | 32768 | timeout=360s |
| N03 | 3模型投票 | 0.3 | 8192 | 阈值=8.0, 6维等权 |
| N04 | gemini-3.1-pro | 0.2 | 32768 | 无 issue 跳过 LLM |
| N05 | gemini-3.1-pro | 0.2 | 16384 | S0/S1/S2 分级 |
| N06 | gemini-3.1-pro | 0.6 | 16384 | 候选数按 importance |
| N07 | FLUX.2 Dev | — | — | 1024×1024, steps=20, cfg=3.5 |
| N10 | FLUX.2+FireRed | — | — | 2048×1152, firered=0.85 |
| N11 | 1-3模型(tier) | 0.3 | 8192 | 阈值=7.5, 8维加权 |
| N12 | gemini-3.1-pro | 0.3 | 8192 | 多模态/文本双模式 |
| N14 | LTX-2.3 | — | — | 768×512, steps=20, v_cfg=3.0 |
| N15 | 1-3模型(tier) | 0.3 | 8192 | 阈值=7.5+硬拒绝 |
| N16 | gemini-3.1-pro | 0.3 | 8192 | 含 trim 建议 |
| N20 | kie.ai 多服务 | — | — | TTS voice, BGM model=V4 |
| N23 | FFmpeg | — | — | crf=23, aac 128k |

---

#### Agent-θ：审核工作流（Day 2-3 并行）

**面向**：质检人员 / 审核员 — 执行 4 个 Gate 的人工审核决策

| 序号 | 页面 | 改动 |
|:----:|------|------|
| θ.1 | `/review/art-assets` | 接真实 review-tasks API + N07 候选图 URL，approve/return 写入真实决策 |
| θ.2 | `/review/visual` | 接真实 shot 级 review-tasks，展示 N10/N14 候选关键帧和视频 |
| θ.3 | `/review/audiovisual` | 接真实 N20 视听数据，NLE 时间线展示 TTS/BGM/SFX 各轨道 |
| θ.4 | `/review/final` | 接真实 N23 成片视频 URL，支持添加时间戳审核点 |
| θ.5 | `/admin/orchestrator/acceptance` | 接真实 north-star-summary API + node_runs 表 |

---

## 五、每日检查点

### Day 1 晚检查点

| 检查项 | 验收标准 |
|--------|---------|
| `llm_client.py` 可用 | `call_llm("gpt-4o", ...)` 返回正常响应 |
| `tos_client.py` 可用 | 上传 JSON → 下载回来内容一致 |
| `docx_parser.py` 可用 | 解析测试剧本输出 RawScriptInput |
| N01→N06 handler 完成 | 串行执行，每个节点产出写入 TOS |
| N03 QC handler 完成 | 三模型投票，评分 <8.0 返回 auto_rejected |
| N09-N26 freeze handler 完成 | 代码可导入，逻辑完整（输入为 stub 时也能跑） |
| N12/N16 analysis handler 完成 | 纯文本版可运行 |
| N20/N23 av handler 完成 | ElevenLabs TTS + Suno BGM + SFX API 调通 + FFmpeg 合成代码完成 |

### Day 2 晚检查点

| 检查项 | 验收标准 |
|--------|---------|
| ComfyUI 在线 | `curl http://<gpu-ip>:8188/system_stats` 返回 200 |
| FLUX.2 Dev 可出图 | 提交 txt2img workflow，返回图片 |
| LTX-2.3 可出视频 | 用现有 workflow 出 2s 视频 |
| N07 handler 通过 | 输入 ArtGenerationPlan → 输出候选图 |
| N14 handler 通过 | 输入关键帧 → 输出候选视频 |
| N01→N08 真实链跑通 | 从 .docx 到 Gate 暂停，DB 中有完整 node_runs |
| 前端至少 1 个页面接通 | acceptance 页显示真实数据 |

### Day 3 晚最终验收

| 检查项 | 验收标准 |
|--------|---------|
| N01→N26 E2E 跑通 | 输入 .docx → 所有节点执行 → 输出成片视频 |
| 4 个 Gate 可审核 | approve → 图继续执行 |
| QC 自动打回生效 | N03 评分 <8.0 → 自动回 N02 |
| 前端 review 页可操作 | 展示真实候选图/视频，approve/return 可点 |
| 成片可播放 | N23 输出的 mp4 文件可正常播放 |

---

## 六、各 Agent 启动 Prompt 模板

### Agent-α 启动 Prompt

```
你是 Agent-α (Infra)，负责为 Autoflow AIGC 管线创建基础设施代码。

## 你的任务
按顺序创建以下文件（每个文件都是新建，不修改已有文件除非特别说明）：

1. 修改 `.env.local`，在文件末尾新增：
   LLM_BASE_URL=https://www.dmxapi.cn/v1
   LLM_API_KEY=sk-0KLEyMoBmvLztN1v1tOrRJWF58SEYp7NY36qo6ri0O7tvmQp
   COMFYUI_BASE_URL=http://localhost:8188

2. 修改 `backend/common/env.py`，新增函数：
   - get_llm_base_url() -> str
   - get_llm_api_key() -> str
   - get_comfyui_base_url() -> str

3. 创建 `backend/common/llm_client.py`
   - 使用 httpx 调用 OpenAI 兼容 API
   - 实现 call_llm() 和 call_llm_multi_vote()
   - 支持 json_mode 和 images 参数
   - 写完后用 dmxapi.cn 做一次真实调用测试

4. 创建 `backend/common/tos_client.py`
   - 使用 tos SDK（已安装在 .venv-connectivity）
   - Bucket: autoflow-media-2102718571-cn-shanghai
   - 实现 upload_json/upload_bytes/download_json/download_bytes/generate_presigned_url
   - 写完后上传一个测试 JSON 验证

5. 创建 `backend/common/docx_parser.py`
   - 使用 python-docx（如未安装则用 pip install）
   - 解析 test-data/ 下的 .docx 文件
   - 输出 RawScriptInput dataclass
   - 写完后用测试剧本验证

6. 创建 `backend/orchestrator/comfyui_client.py`
   - 使用 httpx 调用 ComfyUI HTTP API
   - 实现 submit_workflow/poll_until_complete/download_output_image/download_output_video
   - 暂不测试（GPU未到），确保代码可导入无报错

7. 创建 `backend/orchestrator/handlers/__init__.py`
   - 实现 register_all_handlers() 函数
   - 导入各 handler 模块（用 try/except 包裹，某个模块未就绪时跳过不报错）

8. 修改 `backend/orchestrator/graph/__init__.py`
   - 在适当位置添加 register_all_handlers() 调用

## 禁止触碰的文件
- backend/orchestrator/graph/script_handlers.py（已有旧 handler，不改）
- backend/orchestrator/graph/workers.py（不改注册机制）
- backend/orchestrator/graph/supervisor.py
- backend/common/contracts/**

## 接口签名
见 PLAN.md §3.1-§3.4 的完整签名定义。

## 完成信号
所有文件创建完毕且通过基础测试后，在 backend/orchestrator/handlers/ 目录下创建空文件 _INFRA_READY。
```

---

### Agent-β 启动 Prompt

```
你是 Agent-β (Script Stage)，负责实现管线脚本阶段的 5 个真实 LLM handler。

## 前置条件
确认 `backend/orchestrator/handlers/_INFRA_READY` 文件存在（Agent-α 已完成）。

## 你的任务
创建 `backend/orchestrator/handlers/script_stage.py`，实现以下 5 个 handler：

### N01 — 剧本结构化解析
- 输入：从 state 获取 episode_context_ref → 调用 docx_parser.parse_docx()
- LLM 调用：`call_llm(SCRIPT_STAGE_MODEL, system_prompt=..., user_prompt=..., json_mode=True)`
- **模型**：`from backend.common.llm_client import SCRIPT_STAGE_MODEL`（gemini-3.1-pro → opus-4-6 → 二梯队自动降级）
- System Prompt 和 User Prompt 见 node-spec-sheet.md N01 章节（已复制到本 prompt 底部）
- 输出：ParsedScript JSON → upload_json() 到 TOS → 写 artifact

### N02 — 拆集拆镜
- 输入：读 N01 output_payload 的 ParsedScript
- LLM 调用：`call_llm(SCRIPT_STAGE_MODEL, temperature=0.5, max_tokens=32768)`
- 输出：EpisodeScript JSON

### N04 — 分镜定稿
- 输入：读 N02 output + N03 output（qc_result）
- 逻辑：如果 N03 无 issue → 直接盖章不调 LLM；有 minor issue → call_llm 微调
- 输出：EpisodeScript (frozen)

### N05 — 镜头分级
- 输入：读 N04 output
- LLM 调用：为每个 shot 分配 difficulty(S0/S1/S2) + qc_tier
- 输出：EpisodeScript (frozen + graded)

### N06 — 视觉元素 Prompt 生成
- 输入：读 N04+N05 output + character_registry + location_registry
- LLM 调用：call_llm("gemini-2.0-flash", temperature=0.6)
- 输出：ArtGenerationPlan JSON（角色/场景/道具的 prompt + 候选数 + 参考策略）
- 注意：N06 不生成图像，只生成 Prompt 和生成方案

### 通用规则
- 所有 handler 遵循签名：handle_nXX(node_id, state, config) -> NodeResult
- 用 build_node_output_envelope() 包装输出
- 用 tos_client.upload_json() 持久化产物
- 模块底部定义 register() 函数注册所有 handler
- Prompt 模板从 node-spec-sheet.md 对应章节复制

## 你只能创建/修改的文件
- backend/orchestrator/handlers/script_stage.py（新建）

## 禁止触碰的文件
- backend/common/**（Agent-α 负责）
- backend/orchestrator/graph/**（不改）
- backend/orchestrator/handlers/__init__.py（Agent-α 负责）

## Prompt 模板参考
[附上 node-spec-sheet.md N01-N06 的完整 prompt 模板]
```

---

### Agent-γ 启动 Prompt（模式同上，只含 N03/N11/N15）

```
你是 Agent-γ (QC Voting)。创建 `backend/orchestrator/handlers/qc_handlers.py`。

实现 N03（分镜QC 三模型投票）、N11（关键帧QC 按 qc_tier）、N15（视频QC 多维度）。

## 模型选型（必须遵循）
- 三模型投票列表：`from backend.common.llm_client import QC_VOTE_MODELS`
  即 `["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"]`
- 用法：`call_llm_multi_vote(QC_VOTE_MODELS, system_prompt, user_prompt, json_mode=True)`
- 每个模型内置独立重试+降级链，无需 handler 层处理
- N11/N15 按 qc_tier 选用 QC_VOTE_MODELS 的前 N 个模型（S0=1个, S1=2个, S2=3个）

核心逻辑：call_llm_multi_vote() → 去极值取平均 → 与阈值比较 → 返回 pass/reject。

N03 阈值 8.0（6维等权），N11/N15 阈值 7.5（加权，单维<5.0直接打回）。

详细评分维度和 Prompt 见 node-spec-sheet.md N03/N11/N15 章节。
```

---

### Agent-ε 启动 Prompt（模式同上，只含固化节点）

```
你是 Agent-ε (Freeze)。创建 `backend/orchestrator/handlers/freeze_handlers.py`。

实现 7 个固化/分发节点：N09, N13, N17, N19, N22, N25, N26。

所有固化节点的模式相同：
1. 读上游 output（通过 load_node_output_payload）
2. 选定候选（如果上游有 QC/Gate 选定）
3. 上传选定产物到 TOS（tos_client.upload_bytes/upload_json）
4. 写入 artifacts 表（frozen=true）
5. 返回 NodeResult

N17 特殊：需要 FFmpeg trim（如果 PacingReport 有建议）。
N26 特殊：分发 stub — 记录 DistributionRecord 但不真实推送。
```

---

### Agent-ζ 启动 Prompt（模式同上，含 N12/N16/N20/N23）

```
你是 Agent-ζ (AV & Analysis)。创建两个文件：
- `backend/orchestrator/handlers/analysis_handlers.py`（N12, N16）
- `backend/orchestrator/handlers/av_handlers.py`（N20, N23）

N12 连续性检查：`call_llm(SCRIPT_STAGE_MODEL, images=帧列表)` 多模态分析全集关键帧序列。
N16 节奏分析：`call_llm(SCRIPT_STAGE_MODEL, images=帧列表)` 多模态分析全集视频。
N23 成片合成：纯 FFmpeg 合成（拼接 + 混音 + 字幕）。

## N20 视听整合 — 严格遵循以下选型

所有音频 API 统一通过 kie.ai 代理调用：
```python
from backend.common.env import get_audio_api_base_url, get_audio_api_key
# base_url = "https://api.kie.ai"
# api_key = "4d90460e54f1a3eaa63cdb3baab89bcc"
```

### 子步骤与 API 调用（✅ 2026-03-09 已全部验证调通）：

1. **TTS 语音合成** — ElevenLabs (kie.ai 代理)
   POST https://api.kie.ai/api/v1/jobs/createTask
   body: {"model": "elevenlabs/text-to-speech-multilingual-v2", "input": {"text": "...", "voice": "Rachel"}}
   查询: GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId={id}
   结果: resultJson.resultUrls[0] → mp3 URL（耗时 ~6s）

2. **唇形同步** — LatentSync 1.5（开源 GPU 自部署）
   MVP-0 阶段 GPU 未到时跳过，标记 issue

3. **BGM 生成** — Suno (kie.ai 代理, 必须传 callBackUrl)
   POST https://api.kie.ai/api/v1/generate
   body: {"prompt": "...", "instrumental": true, "model": "V4", "callBackUrl": "https://..."}
   查询: GET https://api.kie.ai/api/v1/generate/record-info?taskId={id}
   模型选项: V3_5 / V4 / V4_5 / V4_5PLUS / V5

4. **声效 (SFX)** — ElevenLabs sound-effect-v2 (kie.ai 代理)
   POST https://api.kie.ai/api/v1/jobs/createTask
   body: {"model": "elevenlabs/sound-effect-v2", "input": {"text": "door knock", "duration_seconds": 3}}
   查询: 同 TTS（耗时 ~10s）

5. **混音** — Geek_AudioMixer (ComfyUI) 或 FFmpeg 简单混音
6. **字幕** — 文本 + STT 轴对齐

所有 API 认证头: Authorization: Bearer {get_audio_api_key()}

### 禁止使用 edge-tts 或其他非指定方案。

N23 需要 ffmpeg 命令行工具。
```

---

### Agent-δ 启动 Prompt（Day 2 GPU 到位后启动）

```
你是 Agent-δ (ComfyUI Gen)。创建 `backend/orchestrator/handlers/comfyui_gen.py`。

实现 N07（美术图 FLUX.2）、N10（关键帧 FLUX.2+FireRed）、N14（视频 LTX-2.3）。

使用 comfyui_client.py（Agent-α 已创建）提交 workflow。

N14 优先：已有现成 workflow `VideoGen/Ltx2 四关键帧生视频.json`，修改参数即可。
N07 其次：需要构建 FLUX.2 txt2img workflow JSON。
N10 最后：需要 FLUX.2 + FireRed + ControlNet 组合 workflow。

每个 handler：
1. 从 state 读上游输出（ArtGenerationPlan / ShotSpec / FrozenKeyframe）
2. 构建 ComfyUI workflow JSON（动态填入 prompt/参考图/参数）
3. submit_workflow() → poll_until_complete() → download_output()
4. 上传产物到 TOS → 写 artifact → 返回 NodeResult
```

---

### Agent-η 启动 Prompt（Day 2 开始）

```
你是 Agent-η (Node Inspection & Debug)。负责两个核心页面：节点详情页增强 + 节点调试页新建。

你只能修改 frontend/ 目录下的文件，不得触碰 backend/。

## 任务 η.1：剧集详情页增强 /admin/drama/[id]

现有页面已有三栏布局（Phase Accordion + Node I/O Inspector + Telemetry），但用 mock 数据。
你需要：
1. 将中央区域改为分 Tab 展示：「输入」「输出」「提示词」「过程产物」「日志」
2. 接通 /api/orchestrator/node-trace 真实 API，展示真实 node_runs 数据
3. 输入 Tab：展示上游节点的 output_payload（JSON 树 + 图片/视频缩略图）
4. 输出 Tab：展示当前节点 NodeResult.output_payload（JSON 树 + 候选图/视频网格预览）
5. 提示词 Tab：展示 System Prompt 和 User Prompt 全文（LLM 节点）
6. 过程产物 Tab：QC 节点→各模型独立评分表；ComfyUI→workflow JSON+seed；AV→各轨道音频
7. 日志 Tab：节点执行日志（duration / cost / error / retries）

## 任务 η.2：节点调试页新建 /admin/debug

新建页面，面向管线开发者，用于单步测试每个节点：
1. 26 个节点按 5 个 Stage 分组，每个节点一个卡片
2. 每个卡片含：参数表单（预填默认值）+ 输入 JSON 区 + 「执行」按钮 + 输出区
3. 后端 API route：/api/orchestrator/node-debug — POST { node_id, input_payload, params }
4. 参数表单从 handler 代码提取默认值（见 PLAN.md η.2 参数速查表）
5. 执行结果展示：JSON 输出 + 图片/视频内联预览 + cost/duration 指标
6. 节点间可链接：上一节点输出自动填充为下一节点输入

需要新建的文件：
- frontend/app/admin/debug/page.tsx — 调试页主页面
- frontend/lib/node-debug-types.ts — 调试页类型定义
- frontend/components/node-debug-card.tsx — 节点调试卡片组件
- frontend/app/api/orchestrator/node-debug/route.ts — 后端桥接 API

## 禁止触碰
- frontend/app/review/** — Agent-θ 负责
- backend/** — 不得修改
```

---

### Agent-θ 启动 Prompt（Day 2 开始，与 η 并行）

```
你是 Agent-θ (Review Workflow)。负责将 4 个审核工作流页面从 mock 数据切换到真实后端 API。

你只能修改 frontend/ 目录下的文件，不得触碰 backend/。

## 任务 θ.1：美术资产审核 /review/art-assets（Gate N08）

现有页面已有完整 UI：左导航 + 中央工作区 + 右侧 AI 反馈面板。
你需要：
1. 将 mock 数据替换为 /api/orchestrator/review/tasks?stage=1 真实 API
2. 候选图从 N07 output_payload.asset_candidate_sets 读取，展示 TOS 真实图片 URL
3. approve/return 操作调用 /api/orchestrator/review/tasks/[taskId]/approve|return
4. 锁定资产操作写入真实 gate_decisions

## 任务 θ.2：视觉素材审核 /review/visual（Gate N18）

1. 接通 /api/orchestrator/review/tasks?stage=2 + stage2-summary API
2. 展示 N10 候选关键帧 + N14 候选视频（图片网格 + 视频播放器）
3. 按镜头级别逐个审核，支持 Gacha 选择最佳候选

## 任务 θ.3：视听整合审核 /review/audiovisual（Gate N21）

1. 接通 /api/orchestrator/review/tasks?stage=3
2. NLE 时间线展示 N20 输出的各音轨（TTS/BGM/SFX）
3. 视频播放器加载 N17 固化视频 + N20 混音音频

## 任务 θ.4：成片审核 /review/final（Gate N24）

1. 接通 /api/orchestrator/review/tasks?stage=4 + stage4-summary API
2. 视频播放器加载 N23 合成的最终 MP4
3. 支持添加时间戳审核点（issue type + severity）
4. N24 三步串行审核：qc_inspector → senior_reviewer → final_approver

## 任务 θ.5：验收页接真实数据 /admin/orchestrator/acceptance

1. 接通 north-star-summary API
2. 展示真实 node_runs 表数据
3. Registry validation 实时状态

## 方法
- 将各页面中引用 mock-data / *-mock-data.ts 的地方替换为 fetch 调用后端 API
- API 基础路径：/api/orchestrator/（Next.js API route → Python backend bridge）
- Python 后端桥接：frontend/lib/python-read-api.ts → execFile 调用后端 Python 脚本

## 禁止触碰
- frontend/app/admin/drama/** — Agent-η 负责
- frontend/app/admin/debug/** — Agent-η 负责
- backend/** — 不得修改
```

---

## 七、关键风险与降级策略

| 风险 | 概率 | 降级策略 |
|------|:----:|---------|
| ~~dmxapi 不支持 gemini-2.0-flash~~ | ~~中~~ | ✅ 已验证：12 个模型全部 3/3 成功率 100%（2026-03-08 测试） |
| ~~dmxapi 不支持三模型同时投票~~ | ~~低~~ | ✅ 已验证：三模型并行调用成功 |
| 旗舰模型延迟高 (gemini-3.1-pro ~86s, opus ~49s) | 高 | llm_client.py 已内置重试+降级链，timeout 设为 120s |
| GPU Day 2 晚仍未到 | 中 | ComfyUI 节点全用 stub 图/视频，其余节点照跑 |
| FireRed workflow 搭不出来 | 中 | N09/N13 跳过 FireRed，直接用 FLUX 出图固化 |
| kie.ai API 不可用 | 低 | ElevenLabs/Suno 通过 kie.ai 代理，如挂则 TTS 降级为静音+字幕 |
| LatentSync GPU 未到位 | 中 | 跳过唇形同步，标记 issue，后续补接 |
| FFmpeg 合成报错 | 低 | 简化为纯拼接（不加转场/字幕/水印） |

---

## 八、目录结构最终形态

```
backend/
├── common/
│   ├── db.py                          (已有, 不改)
│   ├── env.py                         (α 修改)
│   ├── llm_client.py                  (α 新建)
│   ├── tos_client.py                  (α 新建)
│   ├── docx_parser.py                 (α 新建)
│   └── contracts/                     (已有, 冻结不碰)
│
├── orchestrator/
│   ├── graph/
│   │   ├── __init__.py                (α 微改)
│   │   ├── topology.py                (不改)
│   │   ├── state.py                   (不改)
│   │   ├── workers.py                 (不改)
│   │   ├── script_handlers.py         (不改, 保留旧 handler 作为参考)
│   │   ├── supervisor.py              (不改)
│   │   ├── gates.py                   (不改)
│   │   ├── builder.py                 (不改)
│   │   └── context.py                 (不改)
│   │
│   ├── comfyui_client.py              (α 新建)
│   │
│   ├── handlers/
│   │   ├── __init__.py                (α 新建 — 注册入口)
│   │   ├── _INFRA_READY               (α 完成信号)
│   │   ├── script_stage.py            (β 新建 — N01 N02 N04 N05 N06)
│   │   ├── qc_handlers.py            (γ 新建 — N03 N11 N15)
│   │   ├── comfyui_gen.py            (δ 新建 — N07 N10 N14)
│   │   ├── freeze_handlers.py        (ε 新建 — N09 N13 N17 N19 N22 N25 N26)
│   │   ├── analysis_handlers.py      (ζ 新建 — N12 N16)
│   │   └── av_handlers.py            (ζ 新建 — N20 N23)
│   │
│   ├── model_gateway.py               (不改)
│   ├── write_side.py                  (不改)
│   ├── db_read_side.py                (不改)
│   └── ...
```

---

## 九、Agent 启动顺序清单

```
Day 1 上午  → 启动 Agent-α (Infra)，等待完成
Day 1 下午  → 同时启动 Agent-β (Script), Agent-γ (QC), Agent-ε (Freeze), Agent-ζ (AV)
Day 2 上午  → 同时启动 Agent-η (Node Inspect/Debug) + Agent-θ (Review Workflow)
Day 2 下午  → GPU 到位后启动 Agent-δ (ComfyUI)
Day 2 晚    → 全 Agent 冻结，开始集成测试
Day 3       → Bug 修复 + E2E 贯通 + 演示准备
```
