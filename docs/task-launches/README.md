# 任务启动文档目录

## 目的
`docs/task-launches/` 用于存放每一轮多 Agent 任务的独立目录。

每一轮任务目录的作用不是写长篇背景，而是用统一格式冻结本轮的：

- 任务目标
- 实施路径
- Agent 分工
- 允许改动范围
- 禁止碰的共享文件
- 验收标准
- 总结果与阻塞回填

## 命名规则
建议每轮使用一个目录：

`YYYY-MM-DD-任务名/`

例如：

- `2026-03-07-mvp0-first-parallel-run/`

## 使用规则
- 每次新的多 Agent 轮次启动前，先创建该目录。
- 目录内至少包含：`README.md`、`acceptance/task-checkpoints.md`、`acceptance/final-summary.md`。
- 任务边界变化时，先更新目录内的任务说明，再调整 Agent 分工。
- 每完成一个 Task，就在 `acceptance/task-checkpoints.md` 追加一条验收总结。
- 任务完成后，在 `acceptance/final-summary.md` 回填整体结果，不再另起散落总结文档。

## 推荐结构
- `README.md`
  - 任务信息
  - 本轮目标
  - 不在本轮范围内
  - 共享合同与真相源
  - 路径与文件所有权
  - Agent 分工
  - 统一验收标准
  - 阻塞项与下一步
- `acceptance/task-checkpoints.md`
  - 每个 Task 完成后的验收总结
- `acceptance/final-summary.md`
  - 本轮总验收结果与交付结论
