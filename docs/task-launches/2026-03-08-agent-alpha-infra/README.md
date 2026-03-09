# Agent-α 基础设施轮次

## 元信息

| 项 | 值 |
|---|---|
| 日期 | 2026-03-08 |
| Agent | Agent-α (Infra) |
| Sprint 阶段 | Phase 0 |
| 状态 | `pass` |

## 本轮目标

为 MVP-0 三日冲刺搭建所有基础设施代码，使其余 6 个 Agent 可以立即启动并行开发。

## 任务清单

| 序号 | 任务 | 产出文件 | 验收标准 | 状态 |
|:----:|------|---------|---------|:----:|
| α.1 | `.env.local` 添加 LLM/ComfyUI 环境变量 | `.env.local` | 变量可通过 `get_env()` 读取 | pass |
| α.2 | `llm_client.py` — LLM 统一调用客户端 | `backend/common/llm_client.py` | `call_llm("gpt-4o-mini", ...)` 返回正常响应 | pass |
| α.3 | `tos_client.py` — TOS 对象存储客户端 | `backend/common/tos_client.py` | 上传 JSON → 下载回来内容一致 | pass |
| α.4 | `docx_parser.py` — 剧本预处理 | `backend/common/docx_parser.py` | 解析 `test-data/*.docx` 输出 RawScriptInput | pass |
| α.5 | `comfyui_client.py` — ComfyUI HTTP 客户端 | `backend/orchestrator/comfyui_client.py` | 代码可导入无报错（GPU 未到，暂不测） | pass |
| α.6 | `handlers/__init__.py` — Handler 注册入口 | `backend/orchestrator/handlers/__init__.py` | `register_all_handlers()` 可调用 | pass |
| α.7 | `graph/__init__.py` — 接入新 handler 注册 | `backend/orchestrator/graph/__init__.py` | 图编译使用新 handler | pass |

## 完成信号

`backend/orchestrator/handlers/_INFRA_READY` 已创建。

## 验收结果

### α.1 — 环境变量
- `get_llm_base_url()` → `https://www.dmxapi.cn/v1`
- `get_llm_api_key()` → `sk-0KLEyMo...`
- `get_comfyui_base_url()` → `http://localhost:8188`

### α.2 — LLM Client
- 真实调用 `call_llm("gpt-4o-mini", ...)` 成功
- 返回 model=`gpt-4o-mini-2024-07-18`, usage 包含 token 统计
- `call_llm_multi_vote` 支持并行多模型投票
- 支持 `json_mode=True` 和 `images` 多模态输入

### α.3 — TOS Client
- `upload_json` → `download_json` 往返验证通过
- 测试 key: `_test/alpha-smoke/1772981730.json`
- 数据一致性校验通过

### α.4 — Docx Parser
- 成功解析 12.3MB 测试剧本
- 提取 607 段落, 18492 字符, 13 张嵌入图片
- 检测到 11 个对话模式（含部分结构标记，N01 LLM 会进一步清洗）

### α.5 — ComfyUI Client
- 模块导入无报错
- `submit_workflow`, `poll_until_complete`, `download_output_image/video`, `get_system_stats` 全部可用
- 等待 GPU 到位后进行真实测试

### α.6 — Handler Registration
- `register_all_handlers()` 可调用，当前返回空列表（handler 模块待其他 Agent 创建）
- 各模块导入失败时静默跳过，不阻塞其他模块

### α.7 — Graph Integration
- `register_all_handlers` 已导出至 `backend.orchestrator.graph` 包
- 调用后 `compile_pipeline()` 仍然返回 `CompiledStateGraph`，无回归

## 增补：模型选型与鲁棒性（2026-03-09）

### API 质量验证
- 12 个模型全部 3/3 成功率 100%（空负载 + 生产负载两轮测试）
- 生产级测试：380 字剧本 → 分镜 JSON，全模型均成功输出有效 JSON

### 模型选型决策
- **脚本阶段** (N01-N06): `SCRIPT_STAGE_MODEL = "gemini-3.1-pro-preview"` → 降级 `claude-opus-4-6` → 二梯队
- **分镜质检** (N03/N11/N15): `QC_VOTE_MODELS = ["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"]` 三模型投票
- 常量定义在 `backend/common/llm_client.py`，Handler 统一引用

### 鲁棒性增强
- 重试：3 次指数退避 + jitter（429/5xx/超时）
- 降级链：`MODEL_FALLBACKS` 字典，旗舰互为首选降级
- Claude JSON 修复：自动剥离 ` ```json ``` ` markdown 包裹
- 68 折价格追踪：`LLMResponse.cost_cny` 逐调用计费

## 业务价值

- 其余 6 个 Agent 现在可以立即启动并行开发，所有共享基础设施（LLM/TOS/ComfyUI/Parser/注册机制）已就绪
- LLM API 已验证可用（dmxapi.cn 代理 → 12 模型全部通过），后续 Agent-β/γ/ζ 可直接调用
- 模型选型和降级链已确定，Handler 开发零决策成本
- TOS 读写已验证可用，后续所有节点的产物存储有保障
- 12.3MB 剧本可被正确解析，管线入口数据源已打通
