# AutoFlow v2.2 — Memory & RAG 合同

> Agent 记忆与 RAG 案例库的数据合同。由主控 Agent 维护。

## 1. agent_memory 表合同

```sql
CREATE TABLE core_pipeline.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name agent_name_enum NOT NULL,
    memory_type memory_type_enum NOT NULL,   -- lesson | preference | statistics | case_ref
    scope memory_scope_enum NOT NULL,        -- global | project | episode | shot
    scope_id TEXT,                           -- project_id / episode_id etc.
    content_key TEXT NOT NULL,
    content_value JSONB NOT NULL DEFAULT '{}',
    confidence FLOAT DEFAULT 1.0,            -- 0.0~1.0, decay over time
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
-- UNIQUE(agent_name, scope, scope_id, content_key)
```

### 1.1 memory_type 语义

| 类型 | 用途 | 示例 |
|------|------|------|
| lesson | 经验教训 | "古装场景需要更多光影对比" |
| preference | 偏好设置 | "偏好 16:9 构图" |
| statistics | 统计数据 | "平均 QC 分数 7.8" |
| case_ref | RAG 案例引用 | "chain_id=xxx 是高分参考" |

### 1.2 scope 语义

| 范围 | scope_id | 含义 |
|------|----------|------|
| global | NULL | 全局知识（跨项目） |
| project | project_id | 项目级知识 |
| episode | episode_version_id | 剧集级知识 |
| shot | shot_id | 镜头级知识 |

### 1.3 CRUD API

| 函数 | 文件 | 说明 |
|------|------|------|
| `upsert_memory()` | agent_memory.py | 插入或更新（按 unique key） |
| `get_memory()` | agent_memory.py | 按 ID 获取 |
| `get_memory_by_key()` | agent_memory.py | 按 agent+scope+key 获取 |
| `list_memories()` | agent_memory.py | 带过滤+分页列表 |
| `update_memory()` | agent_memory.py | 更新内容+confidence |
| `touch_memory()` | agent_memory.py | 更新 access_count + last_accessed_at |
| `delete_memory()` | agent_memory.py | 删除 |
| `cleanup_stale_memories()` | agent_memory.py | 衰减 + 清理 |
| `get_memory_stats()` | agent_memory.py | 聚合统计 |

### 1.4 衰减策略

`cleanup_stale_memories(agent_name, stale_days=30, decay_factor=0.8, min_confidence=0.1)`

1. 超过 `stale_days` 天未访问的记忆：`confidence *= decay_factor`
2. `confidence < min_confidence` 的记忆：删除
3. 返回 `{decayed: N, deleted: M}`

## 2. RAG 案例库合同

### 2.1 RAGCase 数据结构

```python
@dataclass
class RAGCase:
    chain_id: str               # 唯一标识
    quality_score: float        # 质量分 0-10
    case_type: str              # "positive" | "negative" | "corrective"
    genre: str | None           # 题材标签
    scene_type: str | None      # 场景类型
    payload: dict[str, Any]     # 案例具体内容
```

### 2.2 Qdrant 集合设计

| 属性 | 值 |
|------|---|
| 集合名 | `autoflow_rag` |
| 向量维度 | 1536 |
| 距离度量 | COSINE |
| Point ID | `int(md5(chain_id)[:16], 16)` — 确定性 |

Payload 字段：
- `chain_id`: str
- `quality_score`: float
- `case_type`: str
- `genre`: str | null
- `scene_type`: str | null
- `case_payload`: dict

### 2.3 检索策略

当前版本使用 **payload 过滤 + 客户端排序**（非向量相似度）：

1. `scroll()` 带 `genre` / `scene_type` 条件过滤
2. 客户端按 `quality_score` 降序排序
3. 取 top-K（默认 3）

未来版本将集成 embedding 实现真正的向量语义检索。

### 2.4 写入策略

- EvolutionEngine reflection 模式：高分案例（quality_score ≥ 8.0）自动写入
- 人工标注：负向案例（case_type="negative"）通过 API 写入
- 向量：当前使用零向量占位，待 embedding 服务就绪后使用真实向量

### 2.5 客户端切换

```python
get_rag_client()  # 自动根据 QDRANT_URL 切换
# QDRANT_URL 已设置 → QdrantRagClient
# QDRANT_URL 为空   → MockRagClient
```

## 3. MQ Topic 合同

| Topic | 生产者 | 消费者 | Tags | Payload |
|-------|--------|--------|------|---------|
| `autoflow.agent.task` | 调度器 | 各 Agent | agent_name | `{run_id, node_id, agent_name, context}` |
| `autoflow.agent.result` | 各 Agent | 调度器 | agent_name | `{run_id, node_id, agent_name, result, cost_cny}` |
| `autoflow.supervisor.alert` | Supervisor | 管理面板 | budget_alert | `{run_id, node_id, health, budget_status, utilization_pct, violations}` |
| `autoflow.evolution.trigger` | 定时器/手动 | EvolutionEngine | mode | `{mode, agent_name, params}` |

## 4. 冻结条款

以下字段一经发布，不得由执行 Agent 自行修改：

- `agent_memory` 表结构（增列可以，改列/删列需主控审批）
- `RAGCase` dataclass 字段
- MQ Topic 名称和 payload 结构
- `autoflow_rag` 集合的向量维度（1536）
- 成本预算常量 `COST_BUDGET_PER_MIN = 30.0`

修改需向主控 Agent 汇报冲突，经批准后统一变更。
