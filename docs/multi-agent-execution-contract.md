# 多 Agent 执行契约

## 放在哪里最稳
为了让多 agent 在 Cursor 里执行时不乱，契约需要分两层保存：

1. `.cursor/rules/*.mdc`
这些规则会在后续会话里持续生效，是给 agent 的硬约束。

2. `docs/multi-agent-execution-contract.md`
这份文档是给人看的总合同，方便你、我、外包和后续执行 Agent 对齐。

本项目当前生效的契约文件如下：

- `.cursor/rules/autonomy-execution.mdc`
- `.cursor/rules/core-orchestrator-multi-agent-charter.mdc`
- `.cursor/rules/multi-agent-source-of-truth.mdc`
- `.cursor/rules/multi-agent-boundaries-and-handoffs.mdc`
- `.cursor/rules/multi-agent-stop-and-risk-gates.mdc`
- `.cursor/rules/multi-agent-delivery-standard.mdc`
- `.cursor/rules/multi-agent-file-ownership.mdc`
- `.cursor/rules/shared-contract-freeze-batch-1.mdc`
- `.cursor/rules/task-launch-doc-required.mdc`
- `docs/multi-agent-file-ownership.md`
- `docs/shared-contract-freeze-batch-1.md`
- `docs/task-launches/`

## 契约优先级
执行时按以下优先级理解，越靠前越优先：

1. 你在当前会话里的明确指令
2. Cursor 系统与运行安全边界
3. `.cursor/rules/*.mdc`
4. spec 与业务文档
5. 普通说明性文档与临时备注

## 今晚是否具备启动条件
已经基本具备启动条件，但应按“先合同、再并行”的顺序推进。

已满足的前提：

- `PostgreSQL` 已可连接
- `Redis` 已可用，推荐通过本地 tunnel 或内网方式使用
- `TOS` 已可用，且已验证读写删链路
- 迁移 SQL 已执行，现网兼容说明已补到 spec
- 外包兼容层与 `stage_tasks` / `review_tasks` 共存策略已明确

仍需保持的前置约束：

- 并行实现前，主控 Agent 先冻结共享合同
- 同一轮只允许一个 Agent 主改共享文件
- 先做 `MVP-0` 最小闭环，不并发铺开全部真实模型能力

## 必须统一的契约项
以下内容如果不统一，多 agent 最容易互相打架，因此必须由主控 Agent 先冻结：

- 共享 schema 与字段命名：`review_tasks`、`return_tickets`、`runs`、`node_runs`、`artifacts`
- 状态枚举：版本状态、节点状态、审核状态、回炉状态、自动打回状态
- DTO 与 API 契约：Gate 放行、打回、审核池、回炉、版本切换、回调接口
- 异步契约：`Celery + Redis broker`、queue name、回调 payload、幂等键
- 人审契约：`review_steps`、Stage2 shot 聚合、Stage4 三步串行、`openclaw_session_id`
- 兼容契约：`stage_tasks` 和 `review_tasks` 的共存边界、外包前端当前只需关注的字段面
- 交付契约：每个 Agent 的输出格式、验证口径、风险上报口径
- 风险契约：哪些事情默认自动执行，哪些事情必须停下问你

## 推荐执行方式
主控 Agent 先做合同冻结，再按模块并行，而不是按文件随意并行。

推荐顺序：

1. 主控 Agent 冻结共享合同与最小闭环验收口径
2. 运维平台 Agent 继续守住联通性、运行脚本、环境变量
3. 编排运行时 Agent 与数据/状态机 Agent 并行推进骨架
4. 人审入口 Agent 跟进 `review_tasks`、Gate 接口、兼容 DTO
5. 回炉与版本 Agent 跟进 `ReturnTicket`、rerun plan、`v+1`
6. 真实模型、RAG、数据运营能力后置接入

## 文件改动范围在哪里定义
“谁能改哪些文件”不是只写在一句原则里，而是分两层约定：

1. `.cursor/rules/multi-agent-file-ownership.mdc`
这是给 agent 的硬规则，要求所有执行 Agent 服从文件所有权表。

2. `docs/multi-agent-file-ownership.md`
这是具体的目录级归属表，由主控 Agent 维护，后续并行开发前先冻结。

## 每轮任务文档放在哪里
每次新的多 Agent 轮次启动前，统一在 `docs/task-launches/` 下创建任务启动文档。

这类文档负责冻结本轮的：

- 任务目标
- 实施路径
- Agent 分工
- 允许改动范围
- 禁止碰的共享文件
- 验收标准
- 总结果回填

## Agent 输出模板
每个执行 Agent 回传结果时，统一按以下结构交付：

1. 目标与结果
2. 改动文件
3. 影响合同
4. 验证结果
5. 未决风险或阻塞

## 当前建议
如果你认可这套契约，下一步就可以不再停留在“是否能开始”，而是直接进入“主控 Agent 冻结第一批共享合同，然后启动今晚的并行任务”。
