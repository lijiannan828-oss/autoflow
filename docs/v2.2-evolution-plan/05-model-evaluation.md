# 05 - 模型版本评测与部署指南

> **评测日期**: 2026-03-09
> **目标硬件**: A800×8 (80GB VRAM/卡)
> **原则**: A800 显存充足，**全部使用全精度 (FP16/BF16)**，不做量化，追求最高质量
> **用途**: 供运维 Agent 直接按照本文档拉取模型、配置 ComfyUI 节点

---

## 最终选型清单

| # | 功能 | 管线节点 | 生产主力 | 备选/降级 | VRAM (全精度) | ComfyUI 节点 | 许可证 |
|---|------|---------|---------|----------|-------------|-------------|--------|
| 1 | 图像生成 | N07/N10 | **FLUX.2 [dev] 32B** | Z-Image-Turbo 6B | ~40GB / ~16GB | ComfyUI 原生 / Turbo 节点 | 非商用 / Apache 2.0 |
| 2 | 视频生成 | N14 | **Wan2.2-T2V-A14B** (MoE) | LTX-Video 2.3 | ~40GB / ~18GB | ComfyUI-Wan / ComfyUI-LTXVideo | Apache 2.0 |
| 3 | 角色一致性 | N09/N10/N13 | **FireRed-1.1** (MultiRef) | PuLID + IP-Adapter | ~24GB / ~16GB | ComfyUI-FireRed / PuLID-Flux | 研究许可 / Apache 2.0 |
| 4 | 速度图像 | N07 降级 | **Z-Image-Turbo** 6B | — | ~16GB | ComfyUI 社区节点 | Apache 2.0 |
| 5 | TTS (中文) | N20 | **CosyVoice 3.0** | CosyVoice 2.0 | ~8GB | ComfyUI_FL-CosyVoice3 | Apache 2.0 |
| 6 | TTS (英文) | N20 | **ElevenLabs API** | CosyVoice 3.0 | — (API) | — | 商用 API |
| 7 | BGM 生成 | N20 | **ACE-Step 1.5** | 曲库匹配 | <4GB | ComfyUI-ACE-Step | MIT |
| 8 | 音效 SFX (V2A) | N20 | **HunyuanVideo-Foley** | MMAudio | ~24GB / ~6GB | ComfyUI_HunyuanVideoFoley | Tencent / MIT |
| 9 | 口型同步 | N20 | **LatentSync v1.6** | LatentSync v1.5 | ~18GB | ComfyUI-LatentSyncWrapper | Apache 2.0 |
| 10 | 视频超分 | N17 | **SeedVR2** FP16 | RealESRGAN (图像) | ~16GB / <2GB | ComfyUI-SeedVR2 / 内置 | 研究许可 |
| 11 | 音频混合 | N20 | **Geek_AudioMixer** | FFmpeg | — | ComfyUI 节点 | — |
| 12 | 辅助质检 | N11/N15 | **ReActor** + FaceID | — | ~4GB | ComfyUI-ReActor | — |

---

## 1. 图像生成 — FLUX.2 Dev + Z-Image-Turbo

### 选型理由
Spec 文档确认：N07 角色基线图首选 `FLUX.2 Dev`，备选 `Z-Image-Turbo`。A800 (80GB) 可轻松跑 FLUX.2 [dev] 32B 全精度。

### 推荐方案

| 场景 | 模型 | HuggingFace 路径 | VRAM (全精度) | 说明 |
|------|------|------------------|-------------|------|
| **生产主力** | FLUX.2 [dev] 32B | `black-forest-labs/FLUX.2-dev` | ~40GB BF16 | A800 独占，最高质量 |
| **速度降级** | Z-Image-Turbo 6B | `Tongyi-MAI/Z-Image-Turbo` | ~16GB | Apache 2.0，3x 速度，中英文文字渲染优秀 |
| **4090 回退** | FLUX.1 [dev] FP8 | `black-forest-labs/FLUX.1-dev` | ~12GB FP8 | 仅 4090 场景使用量化 |

### Z-Image-Turbo 评测
- **开发者**: 阿里通义实验室，2025年11月发布
- **架构**: S3-DiT (Scalable Single-Stream DiT)，6B 参数
- **速度**: H800 上 <1 秒，A800 约 1-2 秒，消费级 GPU 约 3 秒
- **亮点**: 中英文文字渲染能力极强，适合带文字的短剧场景（片头字幕、道具文字等）
- **ComfyUI**: 社区节点已收录，ComfyUI 原生支持加载

### ComfyUI 集成
- **FLUX**: ComfyUI 原生内置，无需额外安装
- **Z-Image-Turbo**: 社区已收录，兼容标准 `KSampler` 工作流

### 部署命令
```bash
# FLUX.2 Dev 32B 全精度 (A800)
huggingface-cli download black-forest-labs/FLUX.2-dev \
  --local-dir /data/models/flux2-dev/

# Z-Image-Turbo (速度降级方案)
huggingface-cli download Tongyi-MAI/Z-Image-Turbo \
  --local-dir /data/models/z-image-turbo/

# FLUX.1 Dev FP8 (仅 4090 使用)
huggingface-cli download black-forest-labs/FLUX.1-dev \
  --include "flux1-dev-fp8*.safetensors" \
  --local-dir /data/models/flux1-dev-fp8/
```

### 风险提示
- FLUX.2 [dev] 为非商用许可，生产环境需评估合规性
- Z-Image-Turbo 为 Apache 2.0，无商用限制，可作为合规替代

---

## 2. 视频生成 — Wan2.2 + LTX-Video 2.3

### 选型理由
Spec 文档明确指定 `Wan2.2` 为视频生成备选（非 Wan2.1）。Wan2.2 是全球首个开源 MoE 视频生成模型，质量显著领先 LTX。A800 可跑 Wan2.2 全精度，应优先使用。

### 推荐方案

| 场景 | 模型 | HuggingFace 路径 | VRAM (全精度) | 说明 |
|------|------|------------------|-------------|------|
| **质量主力** | Wan2.2-T2V-A14B | `Wan-AI/Wan2.2-T2V-A14B` | ~40GB BF16 | MoE 架构，27B总参/14B激活 |
| **I2V 主力** | Wan2.2-I2V-A14B | `Wan-AI/Wan2.2-I2V-A14B` | ~40GB BF16 | 关键帧→视频（N14 核心路径） |
| **速度主力** | LTX-Video 2.3 | `Lightricks/LTX-Video-2.3` | ~18GB BF16 | 2s 生成 5s 视频，S0/S1 批量用 |
| **角色动画** | Wan2.2-Animate-14B | `Wan-AI/Wan2.2-Animate-14B` | ~40GB | 角色动画专用（可选） |

### Wan2.2 vs LTX-2.3 路由策略（对齐 Spec）

| 镜头类型 | 首选模型 | 说明 |
|----------|---------|------|
| S0 简单镜头 | LTX-2.3 | 速度优先，批量生成 |
| S1 标准镜头 | LTX-2.3 | 速度+质量平衡 |
| S2 复杂镜头 | Wan2.2-I2V | 质量优先，复杂运动 |
| 追踪/orbital | Wan2.2 + ControlNet | 运镜控制能力强 |

### ComfyUI 集成
- **Wan2.2**: `ComfyUI-Wan` — 官方提供工作流，ComfyUI 原生完整支持
- **LTX**: `ComfyUI-LTXVideo` — `cd custom_nodes && git clone https://github.com/Lightricks/ComfyUI-LTXVideo`

### 部署命令
```bash
# Wan2.2 T2V (文生视频)
huggingface-cli download Wan-AI/Wan2.2-T2V-A14B \
  --local-dir /data/models/wan22-t2v/

# Wan2.2 I2V (图生视频 — N14 核心路径)
huggingface-cli download Wan-AI/Wan2.2-I2V-A14B \
  --local-dir /data/models/wan22-i2v/

# LTX-Video 2.3 (速度优先)
huggingface-cli download Lightricks/LTX-Video-2.3 \
  --local-dir /data/models/ltx-video/

# Wan2.2 Animate (可选)
huggingface-cli download Wan-AI/Wan2.2-Animate-14B \
  --local-dir /data/models/wan22-animate/
```

### 风险提示
- Wan2.2 14B 激活参数在 A800 上没有显存问题（~40GB / 80GB）
- LTX 在复杂人体运动场景可能出现 artifact，S2 镜头应路由给 Wan2.2
- Wan2.2 生成速度较 LTX 慢约 5-10x，需要在速度和质量间做路由

---

## 3. 角色一致性 — FireRed-1.1 + PuLID

### 选型理由
Spec 文档已确认组合方案：N07 用 FLUX 出基线 → N08 人工选 → **N09 用 FireRed MultiRef 固化所有变体**。FireRed-1.1 在本项目中的定位是 **MultiRef 角色一致性固化**（不是通用图像编辑），配合 PuLID 做人脸 ID 保持。

### 推荐方案

| 场景 | 模型 | HuggingFace 路径 | VRAM (全精度) | 说明 |
|------|------|------------------|-------------|------|
| **角色固化 (N09)** | FireRed-1.1 | `FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI` | ~24GB BF16 | MultiRef 固化全套变体 |
| **关键帧一致性 (N10/N13)** | Phase1: LLM (Gemini 3.1) prompt编排 + Phase2: FireRed-1.1 + FLUX | — | Phase2: ~24GB | Phase1: LLM 生成 per-candidate prompt; Phase2: FireRed MultiRef + FLUX 出图 |
| **人脸 ID 保持** | PuLID-FLUX | `guozinan/PuLID` | ~16GB | FLUX 原生人脸 ID 嵌入 |
| **通用风格保持** | IP-Adapter FLUX | `h94/IP-Adapter` | ~14GB | 角色风格/服装一致性 |

### ComfyUI 集成
- **FireRed**: `ComfyUI-FireRed` — 支持 MultiRef 模式，3 张参考图（正面+3/4侧+全身）
- **PuLID**: `ComfyUI-PuLID-Flux` — `cd custom_nodes && git clone https://github.com/balazik/ComfyUI-PuLID-Flux`
- **IP-Adapter**: `ComfyUI_IPAdapter_plus` — `cd custom_nodes && git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus`

### 部署命令
```bash
# FireRed-1.1
huggingface-cli download FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI \
  --local-dir /data/models/firered/

# PuLID
huggingface-cli download guozinan/PuLID \
  --local-dir /data/models/pulid/

# IP-Adapter (FLUX 版)
huggingface-cli download h94/IP-Adapter \
  --include "*flux*" \
  --local-dir /data/models/ip-adapter/
```

---

## 4. TTS 语音合成 — CosyVoice 3.0 + ElevenLabs

### 选型理由
Spec 确认按语言切换：中文→CosyVoice 自部署，英文→ElevenLabs API。

### 推荐方案

| 场景 | 模型 | 路径 | VRAM | 说明 |
|------|------|------|------|------|
| **中文 TTS** | CosyVoice 3.0 | `FunAudioLLM/Fun-CosyVoice3-0.5B-2512` | ~8GB | 最新版，零样本克隆，中英混合 |
| **英文 TTS** | ElevenLabs API | — | — | 第三方 API，美式口语 |
| **中文备选** | CosyVoice 2.0 | `FunAudioLLM/CosyVoice2-0.5B` | ~6GB | 更稳定，生态更成熟 |

### 核心能力
- 零样本语音克隆（3-10s 参考音频）
- 情感控制与语速调节
- 流式推理支持
- CosyVoice 3.0 相比 2.0 在韵律自然度上有显著提升

### ComfyUI 集成
- **节点**: `ComfyUI_FL-CosyVoice3`
- **安装**: `cd custom_nodes && git clone https://github.com/AIFSH/ComfyUI_FL-CosyVoice3`

### 部署命令
```bash
# CosyVoice 3.0 (推荐 ModelScope，国内快)
pip install modelscope
modelscope download FunAudioLLM/Fun-CosyVoice3-0.5B-2512 \
  --local_dir /data/models/cosyvoice3/

# 或 HuggingFace
huggingface-cli download FunAudioLLM/Fun-CosyVoice3-0.5B-2512 \
  --local-dir /data/models/cosyvoice3/
```

---

## 5. BGM 背景音乐 — ACE-Step 1.5

### 选型理由
Spec 文档写明 N20 BGM 来源：`Stable Audio 2.5` 生成**或**曲库选择。ACE-Step 1.5 是 2025-2026 年开源 BGM 生成领域的**社区评测冠军**，在 SongEval 基准上超越 Suno v5（商用），且 MIT 许可、极低显存。

### 竞品对比

| 模型 | 版本 | VRAM | 速度 | 质量 | 歌词支持 | 许可 | 结论 |
|------|------|------|------|------|---------|------|------|
| **ACE-Step** | 1.5 | <4GB | ~2s/首 (A100) | **最佳** | 支持19种语言 | MIT | **首选** |
| **Stable Audio** | Open 1.0 | ~10GB | ~5s | 中等 | 不支持 | SA 社区许可 | ~~跳过~~：仅47s单声道，ACE-Step 全面碾压 |
| **YuE** | 7B+1B | ~80GB全精度 | ~150s/首 | 优秀 | 支持 | Apache 2.0 | 太慢，不适合批量 |
| **MusicGen** | Large 3.3B | ~12GB | ~10s | 中等 | 不支持 | CC-BY-NC | 非商用，淘汰 |

### 推荐方案

| 场景 | 模型 | HuggingFace 路径 | VRAM | 说明 |
|------|------|------------------|------|------|
| **BGM 生成主力** | ACE-Step 1.5 | `ACE-Step/ACE-Step-v1-5` | <4GB | MIT，社区最佳，极快 |
| ~~BGM 生成备选~~ | ~~Stable Audio Open 1.0~~ | — | — | **跳过**：仅47s单声道，ACE-Step 全面优于，不下载 |
| **BGM 曲库选择** | 曲库匹配 | — | — | 已有版权曲库直接匹配 |

### ComfyUI 集成
- **ACE-Step**: `ComfyUI-ACE-Step` — 原生内置

### 部署命令
```bash
# ACE-Step 1.5 (唯一主力，无需备选)
huggingface-cli download ACE-Step/ACE-Step-v1-5 \
  --local-dir /data/models/ace-step/

# Stable Audio Open 1.0 — 已跳过，不下载
# 原因: 仅47s单声道，ACE-Step 1.5 全面优于（时长/质量/速度/许可）
```

### 生产建议
- 短剧 BGM 需求：每集 3-5 首不同情绪的 BGM（紧张、浪漫、日常等）
- ACE-Step 在 A800 上 <2 秒/首，**可实时批量生成多候选，人工/自动筛选**
- 支持 mood + tempo + genre 标签控制，与 Spec 中 `SceneBGMConfig` 完美对接

---

## 6. 音效 SFX — HunyuanVideo-Foley + MMAudio

### 选型理由
Spec 文档 N20 步骤 5 写明"音效库 → SFX"。HunyuanVideo-Foley 是截至目前开源 V2A (Video-to-Audio) 的 SOTA，可根据视频内容自动生成匹配音效。

### 竞品对比

| 模型 | VRAM | 质量 | 视频对齐 | 时长限制 | 许可 | 结论 |
|------|------|------|---------|---------|------|------|
| **HunyuanVideo-Foley** | ~24GB BF16 | **SOTA** | 极佳 | 8s/次 | Tencent 开源 | **首选** |
| **MMAudio** | ~6GB | 好 | 好 | 较短 | **MIT** | **备选**（许可更友好） |
| Tango 2 | ~8GB | 中等 | 弱（T2A非V2A） | — | — | 不适合 |
| Movie Gen Audio | — | — | — | — | 未开源 | 不可用 |

### 推荐方案

| 场景 | 模型 | HuggingFace 路径 | VRAM | 说明 |
|------|------|------------------|------|------|
| **V2A 主力** | HunyuanVideo-Foley | `tencent/HunyuanVideo-Foley` | ~24GB BF16 | SOTA，视觉-音频对齐最佳 |
| **轻量备选** | MMAudio | `hkchengrex/MMAudio` | ~6GB | MIT 许可，速度快 |

### 关键注意
- HunyuanVideo-Foley 实际 HF 路径为 `tencent/HunyuanVideo-Foley`（注意是 HunyuanVideo 系列）
- FP8 版本可低至 8GB，但 A800 上应用 BF16 全精度（~24GB）追求最佳音效质量
- 单次最长 8 秒，pipeline 需实现**分段生成+拼接**逻辑

### ComfyUI 集成
- **HunyuanVideo-Foley**: `ComfyUI_HunyuanVideoFoley` (by if-ai / phazei)
- **MMAudio**: 社区节点可用

### 部署命令
```bash
# HunyuanVideo-Foley (全精度)
huggingface-cli download tencent/HunyuanVideo-Foley \
  --local-dir /data/models/hunyuan-foley/

# MMAudio (备选)
huggingface-cli download hkchengrex/MMAudio \
  --local-dir /data/models/mmaudio/
```

---

## 7. 口型同步 — LatentSync v1.6

### 推荐方案

| 场景 | 模型 | HuggingFace 路径 | VRAM | 说明 |
|------|------|------------------|------|------|
| **生产主力** | LatentSync v1.6 | `bytedance/LatentSync-1.6` | ~18GB | 512x512 最佳质量 |
| **降级方案** | 无唇形同步 | — | — | Spec 确认：失败降级为无唇形 + issue 标记 |

### ComfyUI 集成
- **节点**: `ComfyUI-LatentSyncWrapper`
- **安装**: `cd custom_nodes && git clone https://github.com/ShmuelRonen/ComfyUI-LatentSyncWrapper`

### 部署命令
```bash
huggingface-cli download bytedance/LatentSync-1.6 \
  --local-dir /data/models/latentsync/

pip install mediapipe face_alignment
```

### 生产注意
- 输入 512x512 分辨率，输出后由 SeedVR2 超分
- 侧脸/遮挡场景效果下降，建议 face detection 预筛选
- Spec 确认降级策略：LatentSync 失败时标记 issue 但不阻塞流水线

---

## 8. 超分/视频增强 — SeedVR2 + RealESRGAN

### 选型理由
Spec N17 确认做超分（RealESRGAN/Topaz），SeedVR2 是 ByteDance 最新视频超分模型，时序一致性远优于传统逐帧超分。

### 推荐方案

| 场景 | 模型 | HuggingFace 路径 | VRAM | 说明 |
|------|------|------------------|------|------|
| **视频超分 (N17)** | SeedVR2 FP16 | `ByteDance/SeedVR2` | ~16GB | 帧间时序一致，无闪烁 |
| **图像超分 (美术资产)** | RealESRGAN x4plus | 内置 / `xinntao/RealESRGAN` | <2GB | 极快，批处理 |

### ComfyUI 集成
- **SeedVR2**: `ComfyUI-SeedVR2` — 社区实现
- **RealESRGAN**: ComfyUI 内置 upscale 模型

### 部署命令
```bash
# SeedVR2
huggingface-cli download ByteDance/SeedVR2 \
  --local-dir /data/models/seedvr2/

# RealESRGAN (通常 ComfyUI 已内置)
```

### 生产注意
- N17 超分需控制**单集文件 ≤ 500MB**（通过编码参数控制码率）
- 视频超分计算量大，建议异步队列处理

---

## 9. 辅助模型（质检工具）

Spec 中 N11/N15 质检节点使用的辅助工具：

| 工具 | 用途 | ComfyUI 节点 | VRAM |
|------|------|-------------|------|
| ReActor | 人脸一致性检测（逐帧比对） | `ComfyUI-ReActor` | ~4GB |
| FaceID Checker | 人脸 ID 相似度 (cosine similarity) | — | ~2GB |
| Physics Checker | 物理合理性检测 | — | — |

```bash
cd /path/to/ComfyUI/custom_nodes/
git clone https://github.com/Gourieff/comfyui-reactor-node  # ReActor
```

---

## GPU 分配方案 (A800×8, 全精度)

| GPU # | 模型 | VRAM 占用 | 剩余 | 管线节点 |
|-------|------|-----------|------|---------|
| GPU 0 | **FLUX.2 Dev 32B** BF16 | ~40GB | 40GB | N07/N10 图像生成 |
| GPU 1 | **Wan2.2-I2V-A14B** BF16 | ~40GB | 40GB | N14 视频生成 (质量) |
| GPU 2 | **FireRed-1.1** + PuLID | ~24+16=40GB | 40GB | N09/N10/N13 角色一致性 |
| GPU 3 | **LTX-Video 2.3** BF16 + Z-Image-Turbo | ~18+16=34GB | 46GB | N14 速度路径 + N07 降级 |
| GPU 4 | **HunyuanVideo-Foley** BF16 | ~24GB | 56GB | N20 音效 |
| GPU 5 | **LatentSync v1.6** + CosyVoice 3.0 | ~18+8=26GB | 54GB | N20 口型+TTS |
| GPU 6 | **SeedVR2** FP16 + RealESRGAN + ReActor | ~16+2+4=22GB | 58GB | N17 超分 + N11/N15 质检 |
| GPU 7 | **ACE-Step 1.5** + 备用 | ~4GB | 76GB | N20 BGM + 溢出缓冲（空间最充裕） |

**总结**: A800×8 全精度部署所有模型，每卡均有 40-66GB 余量，无需任何量化。GPU 7 空间最充裕，可作为新模型实验区。

---

## ComfyUI 自定义节点安装汇总

```bash
cd /path/to/ComfyUI/custom_nodes/

# 视频生成
git clone https://github.com/Lightricks/ComfyUI-LTXVideo
# Wan2.2 — ComfyUI 原生支持，确认最新版 ComfyUI 已包含

# 角色一致性
git clone https://github.com/balazik/ComfyUI-PuLID-Flux
git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus
# FireRed — 确认社区节点或手动集成

# 语音合成
git clone https://github.com/AIFSH/ComfyUI_FL-CosyVoice3

# 背景音乐
git clone https://github.com/ace-step/ComfyUI-ACE-Step

# 音效
git clone https://github.com/if-ai/ComfyUI_HunyuanVideoFoley

# 口型同步
git clone https://github.com/ShmuelRonen/ComfyUI-LatentSyncWrapper

# 质检辅助
git clone https://github.com/Gourieff/comfyui-reactor-node

# 视频超分
# SeedVR2 — 确认社区节点实际地址
```

---

## 模型下载一键脚本

```bash
#!/bin/bash
# model-download-a800.sh — A800 全精度部署
# 运维 Agent 可直接执行
set -e

MODEL_ROOT="/data/models"
mkdir -p "$MODEL_ROOT"

echo "=== 1/11 FLUX.2 Dev 32B (全精度) ==="
huggingface-cli download black-forest-labs/FLUX.2-dev \
  --local-dir "$MODEL_ROOT/flux2-dev/"

echo "=== 2/11 Z-Image-Turbo ==="
huggingface-cli download Tongyi-MAI/Z-Image-Turbo \
  --local-dir "$MODEL_ROOT/z-image-turbo/"

echo "=== 3/11 Wan2.2 I2V ==="
huggingface-cli download Wan-AI/Wan2.2-I2V-A14B \
  --local-dir "$MODEL_ROOT/wan22-i2v/"

echo "=== 4/11 Wan2.2 T2V ==="
huggingface-cli download Wan-AI/Wan2.2-T2V-A14B \
  --local-dir "$MODEL_ROOT/wan22-t2v/"

echo "=== 5/11 LTX-Video 2.3 ==="
huggingface-cli download Lightricks/LTX-Video-2.3 \
  --local-dir "$MODEL_ROOT/ltx-video/"

echo "=== 6/11 FireRed-1.1 ==="
huggingface-cli download FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI \
  --local-dir "$MODEL_ROOT/firered/"

echo "=== 7/11 PuLID ==="
huggingface-cli download guozinan/PuLID \
  --local-dir "$MODEL_ROOT/pulid/"

echo "=== 8/11 CosyVoice 3.0 ==="
huggingface-cli download FunAudioLLM/Fun-CosyVoice3-0.5B-2512 \
  --local-dir "$MODEL_ROOT/cosyvoice3/"

echo "=== 9/11 ACE-Step 1.5 ==="
huggingface-cli download ACE-Step/ACE-Step-v1-5 \
  --local-dir "$MODEL_ROOT/ace-step/"

echo "=== 10/11 HunyuanVideo-Foley ==="
huggingface-cli download tencent/HunyuanVideo-Foley \
  --local-dir "$MODEL_ROOT/hunyuan-foley/"

echo "=== 11/11 LatentSync v1.6 ==="
huggingface-cli download bytedance/LatentSync-1.6 \
  --local-dir "$MODEL_ROOT/latentsync/"

echo "=== 补充: SeedVR2 ==="
huggingface-cli download ByteDance/SeedVR2 \
  --local-dir "$MODEL_ROOT/seedvr2/"

echo "=== 补充: MMAudio (SFX 备选) ==="
huggingface-cli download hkchengrex/MMAudio \
  --local-dir "$MODEL_ROOT/mmaudio/"

# Stable Audio Open 1.0 — 已跳过，不下载

echo "=== All models downloaded ==="
```

---

## 与 Spec 文档对照检查

| Spec 指定 | 本文档覆盖 | 状态 |
|-----------|-----------|------|
| N07: FLUX.2 Dev (主) + Z-Image-Turbo (备) | FLUX.2 Dev 32B + Z-Image-Turbo 6B | **已覆盖** |
| N09: FireRed-1.1 MultiRef | FireRed-1.1 | **已覆盖** |
| N10: FLUX.2 Dev + FireRed + ControlNet | FLUX.2 Dev + FireRed + PuLID | **已覆盖** |
| N14: LTX-2.3 (默认) + Wan2.2 (备) | Wan2.2 升为质量主力 + LTX 速度主力 | **已覆盖（调整优先级）** |
| N14: HuMo (S2 条件) | — | 待实测确认 |
| N14: SkyReels (追踪运镜) | Wan2.2 ControlNet 替代 | 备选 |
| N17: RealESRGAN/Topaz (超分) | SeedVR2 (视频) + RealESRGAN (图像) | **已覆盖（升级）** |
| N20: CosyVoice (中文) + ElevenLabs (英文) | CosyVoice 3.0 + ElevenLabs API | **已覆盖** |
| N20: LatentSync (唇形) | LatentSync v1.6 | **已覆盖** |
| N20: Stable Audio 2.5 (BGM) | ACE-Step 1.5 (升级，唯一主力) | **已覆盖（Stable Audio 跳过）** |
| N20: 音效库 (SFX) | HunyuanVideo-Foley V2A + MMAudio | **已覆盖（升级为 AI 生成）** |
| N20: Geek_AudioMixer | Geek_AudioMixer | **已覆盖** |
| N11/N15: ReActor + FaceID | ReActor + FaceID Checker | **已覆盖** |

---

## 更新日志

| 日期 | 变更 |
|------|------|
| 2026-03-09 | v2.0 — 完整重写：补充 Z-Image-Turbo、Wan2.2；全部切换为 A800 全精度；BGM/SFX 竞品对比；Spec 对照检查 |
| 2026-03-09 | v1.0 — 初始版本（已废弃） |
