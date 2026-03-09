# 任务启动目录模板

## 目录结构

```text
docs/task-launches/YYYY-MM-DD-task-name/
  README.md
  acceptance/
    task-checkpoints.md
    final-summary.md
```

## `README.md` 模板

- 任务信息
- 本轮目标
- 不在本轮范围内
- 对应 spec 任务编号
- 共享合同与真相源
- 路径与文件所有权
- Agent 分工
- 统一验收标准
- 阻塞项与下一步

## `acceptance/task-checkpoints.md` 模板

每完成一个 Task，追加一条记录，建议包含：

- 日期时间
- Task 编号
- 执行 Agent
- 目标
- 实际结果
- 验收结论
- 证据或验证方式
- 未决风险

## `acceptance/final-summary.md` 模板

- 本轮状态：`draft | in_progress | blocked | done`
- 已完成 Task
- 未完成 Task
- 页面或脚本类交付物
- 总体验收结论
- 下一步建议
