# Agent-ζ (AV & Analysis) 验收摘要

## 状态
- 本轮状态：`pass`
- 验收结论：4 个节点 handler 全部真实实现并通过导入+注册验证

## 交付物

| 文件 | 行数 | 节点 | 说明 |
|------|------|------|------|
| `backend/orchestrator/handlers/analysis_handlers.py` | ~370 | N12, N16 | 连续性 + 节奏分析 handler |
| `backend/orchestrator/handlers/av_handlers.py` | ~650 | N20, N23 | 视听整合 + 成片合成 handler |

## 验收标准

### ζ.1 — N12 跨镜头连续性检查
- ✅ 从 N11 输出读取全集选定关键帧（兼容多种上游数据结构）
- ✅ 多模态模式：当 HTTP 图片 URL 可用时，通过 `images=` 参数传入 LLM
- ✅ 纯文本降级：图片不可用时，用 shot_spec 文字描述代替
- ✅ 模型：`SCRIPT_STAGE_MODEL`（gemini-3.1-pro-preview），内置降级链
- ✅ 输出：`ContinuityReport` JSON，含 overall_score / scene_transitions / character_continuity / pacing_analysis / blocking_issues
- ✅ 产物上传 TOS，返回标准 NodeResult + NodeOutputEnvelope
- ✅ 错误处理：LLM 调用失败时返回 status=failed + error_code

### ζ.2 — N16 节奏连续性分析
- ✅ 从 N15 输出读取全集选定视频（兼容多种上游数据结构）
- ✅ 多模态 / 纯文本双模式
- ✅ 输出：`PacingReport` JSON，含 overall_rhythm_score / total_duration / target_duration / shot_pacing[] / scene_transitions[] / blocking_issues
- ✅ 时长偏差计算（total vs target）
- ✅ 逐镜头 trim 建议（供 N17 FFmpeg trim 使用）
- ✅ timeout=300s（多视频分析需要更长时间）

### ζ.3 — N20 视听整合
- ✅ 6 步 pipeline 完整实现：
  1. **TTS** — ElevenLabs API via kie.ai (`/v1/text-to-speech/{voice_id}`)，支持多角色 voice_config 映射
  2. **唇形同步** — 标记 `lipsync_applied: false`（LatentSync 需 GPU，MVP-0 跳过）
  3. **BGM** — Suno API via kie.ai (`/suno/submit/music`)，按场景情绪生成
  4. **SFX** — ElevenLabs sound-effect-v2 via kie.ai (`/v1/sound-generation`)，按 shot sfx_tags 生成
  5. **混音** — FFmpeg concat 混合 TTS 音轨
  6. **字幕** — 从 dialogue 文本 + TTS 时长生成 subtitle_json
- ✅ 所有音频 API 统一通过 `get_audio_api_base_url()` + `get_audio_api_key()` 调用
- ✅ 每个子步骤独立 try/except，单步失败不阻塞后续步骤
- ✅ 输出：`AVTrackSet` JSON，含 video_track / tts_tracks / lipsync_videos / bgm_track / sfx_tracks / mixed_audio / subtitle_json
- ✅ 所有音频产物上传 TOS

### ζ.4 — N23 成片合成
- ✅ FFmpeg pipeline 完整实现：
  1. 从 TOS 下载 shot 视频文件
  2. concat demuxer 按时间轴拼接
  3. 混入 mixed_audio（如有）
  4. SRT 字幕烧录（`-vf subtitles=`）
  5. H.264 编码：`-preset fast -crf 23 -c:a aac -b:a 128k`
- ✅ 降级策略：FFmpeg filter 失败时自动回退到简化命令（纯拼接）
- ✅ ffprobe 获取最终时长
- ✅ stub 模式：无真实视频文件时产出 stub FinalEpisode（不报错，供下游消费）
- ✅ 输出：`FinalEpisode` JSON，含 video / duration_sec / resolution / fps / codec / file_size_mb / timeline / subtitle

### 注册验证
- ✅ `register_all_handlers()` 成功注册 analysis_handlers + av_handlers
- ✅ `get_handler("N12/N16/N20/N23")` 均返回正确的 handler 函数
- ✅ 与现有 script_stage / qc_handlers / freeze_handlers 共存无冲突

## 业务价值

1. **管线完整性**：补全了 26 节点管线中最后 4 个缺失的真实 handler，使 N01→N26 全链路首次具备真实执行能力
2. **视觉质量保障**：N12/N16 通过多模态 LLM 分析，在人工审核前自动检测连续性和节奏问题，减少 N18 Gate 的人工负担
3. **视听整合能力**：N20 实现了 TTS/BGM/SFX 的完整音频管线，从"静默视频"升级为"有声短剧"，是产品可演示的关键里程碑
4. **成片输出能力**：N23 实现了 FFmpeg 成片合成，意味着管线首次能够输出可播放的 MP4 文件，完成从剧本到成片的端到端闭环
5. **API 架构统一**：所有音频服务通过 kie.ai 统一代理，单一 API key 管理，降低运维复杂度
6. **渐进式降级**：每个节点都有完善的 stub/降级策略，GPU 未到位时不阻塞管线，GPU 到位后无缝切换到多模态/唇形同步

## 未完成 / 后续迭代

| 项目 | 当前状态 | 需要条件 |
|------|---------|---------|
| N12/N16 多模态图片输入 | 纯文本降级模式可用 | 上游节点产出 HTTP 可访问的图片 URL |
| N20 唇形同步 (LatentSync) | 跳过 + issue 标记 | GPU (A100) 到位 + LatentSync 部署 |
| N23 竖屏二次输出 | 仅横屏 1920x1080 | 后续 FFmpeg 增加 `-vf scale=1080:1920` |
| N23 高光闪回 (3-5s) | 未实现 | LLM 选择关键镜头逻辑 |
| N23 复杂转场 (ComfyUI VHS_VideoCombine) | 仅 cut 转场 | ComfyUI 部署 |
