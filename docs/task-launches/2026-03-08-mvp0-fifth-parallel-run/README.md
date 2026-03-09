# 2026-03-08 MVP-0 第五轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第五轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`completed`

## 本轮目标
- 把“spec 已统一”推进到“系统读写与验收视图开始按统一真相源运行”。
- 优先解决 `T28`：让 `core orchestrator` 真相源与 `Review Gateway / acceptance / 调试视图` 的边界进一步收口。
- 为北极星指标落第一层可计算底座：至少开始承接成本、质量、吞吐/等待时间这三类系统指标。
- 让验收页从“任务完成展示”进一步迈向“业务目标进度展示”。

## 为什么第五轮先做这个
- 第四轮已经证明最小真实写侧闭环成立，但系统仍存在“双轨口径”风险：
  - `core truth objects` 已开始形成
  - `review-workflow` / compat DTO / 页面聚合仍有历史表达
- 如果不先做真相源收口，后续越往成本、质量、运营方向推进，字段漂移和重复实现的风险越大。
- 同时，既然北极星目标已在 spec 中明确，第五轮应开始把这些目标接到可观测指标，而不是继续只补局部 API。

## 本轮覆盖的 spec 任务编号
- `T15`：NodeRun 采集与成本归集
- `T16`：Data Center 指标 API
- `T20`：节点调试页后端（补更多真实指标承接）
- `T21`：Review Gateway
- `T25`：质量评测体系
- `T28`：真相源统一与 Review Gateway 收口

## 本轮主线
1. 收口 `Review Gateway` 的 DTO 来源，尽量优先使用 core truth objects，而不是旧兼容层直接拼装。
2. 为 `NodeRun / EpisodeVersion / ReturnTicket` 补一层最小指标聚合：成本、等待时间、回炉轮次、质量信号。
3. 承接一版最小 `Data Center / North Star` 读侧 API，先支撑验收页与管理页，而不是一口气做完整后台。
4. 将验收页的总体进度与业务北极星视角再向前推进，开始展示成本/质量/吞吐/进化主线，而不只展示功能任务。
5. 让 Node Trace / Review Gateway / acceptance 至少在一条真实链路上使用统一真相源表达。

## 技术路线
- 继续以 `backend/common/contracts/*` + `frontend/app/api/**` 为 BFF/读写收口层。
- 继续优先复用真实 PostgreSQL 数据，不重新发明平行状态结构。
- 第五轮先做“统一读写口径 + 指标聚合底座”，不在本轮全面展开完整 Data Center UI。
- 质量评测在本轮先落“指标字典 + 最小采集/展示骨架”，不追求所有算法到位。

## 主要文件
- 核心 spec：`.spec-workflow/specs/aigc-core-orchestrator-platform/**`
- 审核消费层 spec：`.spec-workflow/specs/aigc-review-workflow-mvp/**`
- 核心读写层：`backend/common/**`、`backend/orchestrator/**`、`backend/rerun/**`
- BFF：`frontend/app/api/**`
- 验收页：`frontend/app/admin/orchestrator/acceptance/**`
- 调试页：`frontend/app/admin/drama/**`
- 进度真相源：`frontend/lib/orchestrator-roadmap-progress.ts`
- 第五轮目录：`docs/task-launches/2026-03-08-mvp0-fifth-parallel-run/**`

## 实施路径
1. 主控 Agent 冻结第五轮目标、覆盖任务编号、路径边界与验收标准。
2. 真相源收口 Agent 对齐 `core truth objects -> Review Gateway DTO` 的来源与边界，减少直接依赖 compat 表达。
3. 数据指标 Agent 在 `NodeRun / EpisodeVersion / ReturnTicket` 上补最小成本、等待时间、回炉轮次聚合。
4. 质量指标 Agent 定义第一版质量指标字典，并让验收页/管理页可读到最小质量信号。
5. 管理视图 Agent 扩展 acceptance / Node Trace / Data Center 初始面板，开始展示北极星相关指标。
6. 主控 Agent 回填任务验收记录、总验收总结与总体进度。

## Agent 分工建议
### 主控 Agent
- 目标：
  - 管理第五轮目录与验收
  - 统一 core / review-workflow 边界
  - 更新总体进度与北极星展示口径

### 真相源收口 Agent
- 对应任务：
  - `T21`
  - `T28`
- 目标：
  - 收口 Review Gateway DTO 来源
  - 减少 compat 层扩散

### 指标聚合 Agent
- 对应任务：
  - `T15`
  - `T16`
- 目标：
  - 构建成本、等待时间、回炉轮次等最小聚合

### 质量指标 Agent
- 对应任务：
  - `T25`
- 目标：
  - 建立质量指标字典与最小质量聚合输出

### 管理视图 Agent
- 对应任务：
  - `T20`
- 目标：
  - 让 acceptance / Node Trace 开始展示更接近北极星指标的真实数据

## 允许改动路径
- `backend/common/**`
- `backend/orchestrator/**`
- `backend/rerun/**`
- `frontend/app/api/**`
- `frontend/app/admin/orchestrator/acceptance/**`
- `frontend/app/admin/drama/**`
- `frontend/lib/**`
- `docs/task-launches/2026-03-08-mvp0-fifth-parallel-run/**`

## 禁止碰的共享文件
- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- 已执行迁移 SQL 与生产真相源结构，除非第五轮明确扩 scope
- 外包团队主工作页面，除非本轮单独批准

## 不在本轮范围内
- 全量 ComfyUI / LLM / 音频模型真实生产接入
- 完整 Data Center 页面体系
- 审核工作流全部前台页面联调完成
- 2000+ 分钟产能压测实战
- Reflection 全量回写策略与自动优化闭环

## 验收标准
- `Review Gateway` 至少一条真实链路明确优先读取 core truth objects，而不是继续扩 compat 拼装
- 验收页和/或管理页可看到至少一组最小北极星指标：成本、等待时间/吞吐、质量信号中的两类以上
- `frontend/lib/orchestrator-roadmap-progress.ts` 与第五轮结果保持同步
- 第五轮目录下存在逐 Task 验收记录与总验收总结
- 本轮结果能从“技术交付”与“业务推进”两个维度解释清楚

## 风险与控制
- 风险：真相源收口容易变成大重构
- 控制：本轮只收口读写边界和 DTO 来源，不做一次性彻底替换所有旧结构
- 风险：指标系统容易演变成完整数据中台
- 控制：本轮只做最小指标聚合与验收展示，不做完整运营后台
- 风险：为了展示指标而引入大量伪数据
- 控制：优先展示真实可计算字段，不能计算的就明确标注为后续主线

## 预期产出
- 一个新的第五轮任务目录
- 一版更清晰的 core truth source 收口结果
- 一套最小北极星指标聚合骨架
- 一轮从“最小真实写侧闭环”推进到“真相源统一 + 指标起步”的第五轮主线
