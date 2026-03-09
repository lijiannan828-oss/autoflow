# AIGC 管线质检标准（Quality Standards）

> **状态**：`confirmed` — 正在同步更新至 `node-spec-sheet.md`、`schema-contracts.md`、`requirements.md`、`tasks.md`
>
> **适用范围**：3 个自动质检节点（N03、N11、N15）+ 4 个人工审核 Gate（N08、N18、N21、N24）

---

## 一、自动质检：维度定义与权重

### 1.1 N03 · 分镜质检（Script QC）

评分对象：`EpisodeScript`（单集分镜脚本文本，非图像）

| # | 维度 key | 中文名 | 权重 | 说明 |
|---|----------|--------|------|------|
| 1 | `narrative_coherence` | 叙事连贯性 | **0.20** | 镜头间故事逻辑是否顺畅，有无跳跃/断裂 |
| 2 | `visual_feasibility` | 视觉可行性 | **0.20** | visual_prompt 能否被生图/生视频模型有效执行 |
| 3 | `pacing` | 节奏感 | **0.15** | 镜头时长分配是否符合短剧快节奏（1-3s/镜头） |
| 4 | `character_consistency` | 角色一致性 | **0.15** | 角色出场、对白、表情是否与人设匹配 |
| 5 | `technical_compliance` | 技术规范性 | **0.15** | camera_movement 可实现、时长合理、编号连续 |
| 6 | `emotional_impact` | 情感表达力 | **0.15** | 关键场景戏剧张力、开头钩子、结尾悬念 |

> **设计说明**：N03 评审的是文本脚本（非视觉产物），所以用叙事导向的 6 维，与 N11/N15 的视觉导向维度不同。这是有意的分域设计，不需要强行统一。

**通过/打回逻辑**：

```
weighted_avg = sum(dim_score[i] * weight[i])
if weighted_avg < 8.0:
    decision = "reject" → 打回 N02
else:
    decision = "pass"
```

**投票规则**：3 模型（GPT 5.4 + Gemini 3.1 + Claude）独立评同一 prompt，去极值取中间值。

---

### 1.2 N11 · 关键帧质检（Keyframe QC）

评分对象：每 shot 的关键帧候选图（静态图像）

| # | 维度 key | 中文名 | 权重 | 说明 |
|---|----------|--------|------|------|
| 1 | `character_consistency` | 角色一致性 | **0.20** | 角色外貌与 FrozenArtAsset 基线匹配（结合 FaceID） |
| 2 | `body_integrity` | 人体完整性 | **0.15** | 无肢体残缺、多余手指、断肢、面部扭曲等 AI 生图常见缺陷 |
| 3 | `tone_consistency` | 影调一致性 | **0.15** | 关键帧色调/影调与 N09 冻结的美术资产基调保持一致 |
| 4 | `script_fidelity` | 脚本忠实度 | **0.15** | 画面是否忠实表达 visual_prompt 意图 |
| 5 | `action_accuracy` | 动作准确性 | **0.10** | 角色动作是否匹配 ShotSpec.action_description |
| 6 | `expression_match` | 表情匹配 | **0.10** | 表情是否匹配 ShotSpec.characters_in_shot[].expression |
| 7 | `composition` | 构图 | **0.10** | 人物位置、前后景关系是否合理 |
| 8 | `lighting_consistency` | 光照一致性 | **0.05** | 光照是否匹配场景设定（时间、天气） |

> **权重逻辑**：角色一致性最高——"人对不对"是观众第一判断。`body_integrity` 和 `tone_consistency` 为新增核心维度：前者拦截 AI 最常见的肢体残缺/变形问题（一眼假），后者确保关键帧与美术基调统一（防止同一部剧色调割裂）。光照在静态图阶段容忍度较高，给最低权重。

**通过/打回逻辑**：

```
weighted_avg = sum(dim_score[i] * weight[i])
if weighted_avg < 7.5:
    decision = "reject" → 打回 N10
else:
    selected_candidate = max(candidates, key=lambda c: c.weighted_avg)
    decision = "pass"
```

**投票规则**：按 `qc_tier` 决定模型数（tier_1→3 模型, tier_2→2, tier_3→1），去极值/取平均。

---

### 1.3 N15 · 视频素材质检（Video QC）

评分对象：每 shot 的视频候选片段

| # | 维度 key | 中文名 | 权重 | 说明 |
|---|----------|--------|------|------|
| 1 | `character_consistency` | 角色一致性 | **0.20** | 视频全程角色外貌一致（FaceID 逐帧采样） |
| 2 | `motion_fluidity` | 运动流畅度 | **0.15** | 无抖动/卡帧/变形/不自然的帧间跳变 |
| 3 | `physics_plausibility` | 物理合理性 | **0.15** | 重力、碰撞、物体穿模（Physics Checker 辅助） |
| 4 | `action_accuracy` | 动作准确性 | **0.10** | 人物动作匹配描述 |
| 5 | `expression_match` | 表情匹配 | **0.10** | 面部表情自然且符合剧情 |
| 6 | `composition` | 构图稳定性 | **0.10** | 运镜过程中构图保持合理 |
| 7 | `lighting_consistency` | 光照一致性 | **0.10** | 视频内光照无突变 |
| 8 | `continuity_score` | 关键帧连贯度 | **0.10** | 视频与起始关键帧的视觉连贯性 |

> **权重逻辑**：视频相比静态图，`motion_fluidity` 和 `physics_plausibility` 是两个新增的核心维度（AI 视频最常见的"一眼假"问题），给予高权重。`character_consistency` 保持最高，因为角色走形是最不可接受的缺陷。

**通过/打回逻辑（多条件，按优先级短路执行）**：

```python
# 优先级 1: 硬性单维度地板
if any(dim_score < 5.0 for dim in all_dims):
    decision = "reject"  # critical — 任何维度崩塌直接打回
    reason = f"{dim_name} = {score} < 5.0 (floor)"

# 优先级 2: 关键维度专属阈值
elif scores["character_consistency"] < 7.0:
    decision = "reject"  # 角色走形不可接受
    reason = "character_consistency < 7.0"

elif scores["physics_plausibility"] < 6.0:
    decision = "reject"  # 物理明显穿帮
    reason = "physics_plausibility < 6.0"

# 优先级 3: 加权总分
elif weighted_avg < 7.5:
    decision = "reject"
    reason = f"weighted_avg = {weighted_avg} < 7.5"

else:
    selected_candidate = max(candidates, key=lambda c: c.weighted_avg)
    decision = "pass"
```

> **设计说明**：短路执行意味着优先级 1 的"地板价"检查最先触发。如果某个维度得了 2 分，即使其他维度都是 10 分拉高了加权总分，也不会放行。这符合"一个维度崩塌 = 视频不可用"的业务直觉。

---

## 二、辅助检查工具阈值

| 工具 | 用于节点 | 指标 | 阈值 | 失败处理 |
|------|---------|------|------|---------|
| **FaceID Checker** | N11, N15 | cosine similarity（与 FrozenArtAsset 基线） | `≥ 0.75` → pass | < 0.75 时 `character_consistency` 维度自动扣至 ≤ 5.0 |
| **ReActor** | N11, N15 | 人脸检测成功率（有脸的帧中检测到率） | `≥ 0.90` → pass | < 0.90 写入 QualityIssue (severity=major) |
| **Physics Checker** | N15 | 穿模/重力违规帧占比 | `≤ 0.05`（≤5%帧异常） → pass | > 5% 时 `physics_plausibility` 自动扣至 ≤ 5.0 |

> **待确认**：以上工具阈值是初版建议。FaceID 的 0.75 基于 InsightFace 的经验值，实际需根据 FireRed 生成的角色风格化程度调整（风格化越强，相似度天然越低，可能需要降到 0.65-0.70）。

---

## 三、人工审核 Gate 标准

### 3.1 设计原则

人工审核不设硬性打分阈值（人的判断维度无法穷举），但提供**结构化审核清单**作为 SOP 指引。审核员可以在清单之外发现问题。

每个 Gate 的审核界面应展示：
- 上一个自动质检节点的分数（辅助参考，不作为强制依据）
- 结构化清单（每项 ✓ / ✗ / N/A）
- 打回时必须填写文字修改意见

---

### 3.2 N08 · Gate Stage1 — 美术资产审核

**审核角色**：剪辑中台 | **粒度**：per asset | **前置自动质检**：无

| # | 检查项 | 判断标准 | 对应操作 |
|---|--------|---------|---------|
| 1 | 角色是否与 CharacterProfile 描述匹配 | 五官、发型、体型、肤色 与档案描述一致 | 不匹配 → 打回该资产 |
| 2 | 候选图质量（清晰度、伪影、变形） | 无明显模糊、AI 伪影（多余手指、面部扭曲） | 严重变形 → 打回 |
| 3 | 服装变体合理性 | 服装与 CostumeSet 描述匹配、场景适配 | 不匹配 → 打回 |
| 4 | 场景背景与 LocationProfile 匹配 | 时间/天气/氛围正确 | 不匹配 → 打回 |
| 5 | 道具合理性 | 道具外观与描述一致、比例正常 | 不匹配 → 打回 |
| 6 | 角色音色（voice_config） | 试听音色样本，确认与角色定位匹配 | 不匹配 → 标记需重选 |

> **辅助操作**：支持自然语言改图（如"眼睛放大"），系统调模型重新生成候选。

---

### 3.3 N18 · Gate Stage2 — 视觉素材审核

**审核角色**：质检员 | **粒度**：per shot | **前置自动质检**：N15 评分

| # | 检查项 | 判断标准 | 对应操作 |
|---|--------|---------|---------|
| 1 | 角色一致性 | 视频中角色与 N09 基线一致，无走形/变脸 | 不通过 → 打回该 shot |
| 2 | 动作符合 ShotSpec | 角色动作与分镜描述匹配 | 不符 → 打回该 shot |
| 3 | 表情自然度 | 无僵硬/诡异表情，与剧情情感匹配 | 严重违和 → 打回 |
| 4 | 运动流畅度 | 无抖动/卡帧/肢体变形 | 有明显问题 → 打回 |
| 5 | 画面整体质量 | 无明显 AI 伪影、穿模、物理违规 | 有明显问题 → 打回 |
| 6 | 镜头间衔接 | 连续播放时前后镜头过渡自然 | 不自然 → 标记 issue |

> **参考信息**：界面展示 N15 自动评分。如果 N15 给出的 `weighted_average` 接近阈值（7.5-8.0 区间），质检员应重点复查。

---

### 3.4 N21 · Gate Stage3 — 视听整合审核

**审核角色**：质检员 | **粒度**：per episode | **前置自动质检**：无

| # | 检查项 | 判断标准 | 对应操作 |
|---|--------|---------|---------|
| 1 | 唇形同步 | 角色说话时嘴型与语音匹配，无明显延迟或错位 | 不通过 → 打回 N20（该 shot 的唇形同步） |
| 2 | 配音语调 | 语速自然、情感匹配剧情、角色辨识度 | 严重不匹配 → 打回 N20（TTS 参数调整） |
| 3 | BGM 匹配 | 背景音乐节奏与画面情绪吻合、音量比例合适 | 不匹配 → 打回 N20（BGM 重选/重混） |
| 4 | 音效合理性 | SFX 时间点准确、音量合适、不抢占对白 | 问题较多 → 打回 N20 |
| 5 | 字幕准确性 | 字幕与对白一致、时间轴对齐、无错别字 | 有误 → 打回 N20（STT 重新对轴） |
| 6 | 整体视听协调 | 各音轨混合后无冲突、整体观感流畅 | 有问题 → 打回 N20 |

> **审核工具**：多轨波形图、分轨静音（逐轨听）、按 shot 跳转定位。

---

### 3.5 N24 · Gate Stage4 — 成片三步串行审核

每步独立审核，Step N 打回立即终止，不进入 Step N+1。

#### Step 1：质检员快检（可跳过）

| # | 检查项 | 重点 |
|---|--------|------|
| 1 | 成片完整性 | 所有场景/镜头齐全，无漏接、黑屏、空白帧 |
| 2 | 转场效果 | 镜头间转场平滑、无硬切违和 |
| 3 | 字幕与水印 | 字幕可读、水印位置正确 |
| 4 | 技术规格 | 分辨率/帧率/编码/文件大小符合标准 |

> 打回目标：N23（成片合成问题）或更上游（视频/音频问题）

#### Step 2：剪辑中台终审（必选）

| # | 检查项 | 重点 |
|---|--------|------|
| 1 | 叙事完整性 | 故事线清晰、起承转合、角色弧光 |
| 2 | 节奏把控 | 整体节奏张弛有度、高潮设计到位 |
| 3 | 品牌调性 | 风格/色调/情绪与项目定位一致 |
| 4 | 高光闪回 | 开头 3-5s 闪回效果吸引眼球 |
| 5 | 商业可用性 | 是否达到投放标准 |

> 打回目标：视具体问题回退到 N14/N20/N23

#### Step 3：合作方验收（必选）

| # | 检查项 | 重点 |
|---|--------|------|
| 1 | 品牌合规 | 无违规内容、符合合作方品牌规范 |
| 2 | 内容准确性 | 剧情与原始需求一致 |
| 3 | 发布就绪 | 可直接用于平台发布 |

> **注意**：合作方界面需脱敏，不展示模型信息和成本数据。
> 打回目标：视具体意见回退

---

## 四、QualityScore schema 统一方案

### 4.1 问题

当前 `schema-contracts.md` 中 `QualityScore.dimensions` 是一个固定 10 维结构，但实际上：
- N03 用 6 个叙事维度（narrative_coherence 等），不在 schema 中
- N11 用 6 个视觉维度
- N15 用 8 个视觉+物理维度（含 `motion_fluidity`，也不在 schema 中）

### 4.2 方案：dimensions 改为 `Record<string, number>`

```typescript
interface QualityScore extends SchemaMeta {
  shot_id?: string;          // N03 无 shot_id（集级评审）
  node_id: string;           // 来源节点
  check_type: "auto" | "human";
  qc_tier: QCTier;
  scale: "1_10";
  normalized_score?: number;

  // 改为动态 key-value，不同节点有不同维度集
  dimensions: Record<string, number>;
  dimension_weights: Record<string, number>;  // 新增：权重定义

  weighted_average: number;
  pass_threshold: number;
  is_passed: boolean;
  model_reviews: {
    model_name: string;
    scores: Record<string, number>;
    reasoning: string;
    latency_ms: number;
  }[];
  aggregation_method: "weighted_average" | "median" | "min_of_max";
  issues?: QualityIssue[];

  // 新增：辅助工具检查结果
  tool_checks?: {
    tool_name: string;         // "FaceID" | "ReActor" | "PhysicsChecker"
    metric: string;            // "cosine_similarity" | "detection_rate" | "violation_rate"
    value: number;
    threshold: number;
    passed: boolean;
  }[];
}
```

**好处**：
- N03 / N11 / N15 各自定义自己的维度集和权重，无需在 schema 里硬编码所有可能的维度名
- 新增的 `dimension_weights` 让打分过程可审计
- 新增的 `tool_checks` 记录 FaceID/Physics 等工具的原始检测数据

### 4.3 各节点的 dimensions 注册表

| 节点 | dimensions keys |
|------|----------------|
| N03 | `narrative_coherence`, `visual_feasibility`, `pacing`, `character_consistency`, `technical_compliance`, `emotional_impact` |
| N11 | `character_consistency`, `body_integrity`, `tone_consistency`, `script_fidelity`, `action_accuracy`, `expression_match`, `composition`, `lighting_consistency` |
| N15 | `character_consistency`, `motion_fluidity`, `physics_plausibility`, `action_accuracy`, `expression_match`, `composition`, `lighting_consistency`, `continuity_score` |

---

## 五、跨文档冲突修正清单

| 文件 | 当前值 | 应改为 | 原因 |
|------|--------|--------|------|
| `requirements.md` §5.2 | N11 "一检合格率 >85%" | "加权总分（weighted_average）< 7.5 → 自动打回 N10" | 与 node-spec-sheet 对齐 |
| `tasks.md` | N11 "合格率 <85%" | 同上 | 同上 |
| `design.md` §5.2 | N11 "加权总分<7.5" | 已正确 ✅ | — |
| `schema-contracts.md` QualityScore | 固定 10 维 | 改为 `Record<string, number>` + `dimension_weights` | 适配三种不同质检维度体系 |

---

## 六、待确认事项

1. **N03 权重分配**：叙事连贯性 0.20、视觉可行性 0.20 为最高权重，你认可吗？还是更偏向等权（各 1/6 ≈ 0.167）？
2. ~~**N11 权重**~~ — ✅ 已更新为 8 维（新增 body_integrity 0.15、tone_consistency 0.15）
3. **N15 权重**：角色一致性 0.20 最高，motion_fluidity 和 physics 各 0.15，你觉得够吗？还是物理合理性应该更高？
4. **FaceID 阈值 0.75**：对于风格化角色（非写实），可能需要降低。你预期的美术风格更偏写实还是动漫/卡通？
5. **Physics Checker 5% 帧容忍度**：是否合理？短剧 1-3s/镜头，3s@24fps = 72 帧，5% = 3.6 帧。
6. **人工 Gate 清单**：是否需要进一步细化？还是当前粒度足够作为 SOP？
7. **QualityScore 改为 Record<string, number>**：这会让 schema 更灵活但失去类型安全。你倾向于动态 key 还是保持固定维度（在 schema 中注册所有可能的维度名）？
