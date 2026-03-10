# 06 - ComfyUI 工作流清单与部署指南

> **整理日期**: 2026-03-09 | **适配验证**: 2026-03-10
> **用途**: 供运维 Agent 直接下载 JSON 工作流文件并部署到 ComfyUI 实例
> **原则**: 优先选择官方/Comfy-Org 维护的工作流，其次选口碑好的社区方案

---

## P0 工作流适配清单（2026-03-10 验证）

> 仅包含 `05-model-evaluation.md` 选型覆盖的模型，已验证工作流兼容性。

| # | 模型 | 工作流 JSON | 下载链接 | 状态 |
|---|------|-----------|---------|------|
| 1 | FLUX.2 Dev 32B | 官方教程内嵌，拖拽示例图提取 | https://docs.comfy.org/tutorials/flux/flux-2-dev | ✅ |
| 2 | Z-Image-Turbo | `z_image_turbo_t2i.json` | Comfy-Org 模板 `image_z_image_turbo.json` | ✅ |
| 3 | Wan2.2 14B I2V | `wan22_14B_i2v.json` | Comfy-Org 模板 `video_wan2_2_14B_i2v.json` | ✅ |
| 4 | Wan2.2 14B T2V | `wan22_14B_t2v.json` | Comfy-Org 模板 `video_wan2_2_14B_t2v.json` | ✅ |
| 5 | Wan2.2 14B FLF2V | `wan22_14B_flf2v.json` | Comfy-Org 模板 `video_wan2_2_14B_flf2v.json` | ✅ |
| 6 | LTX-Video 2.3 I2V | `ltx23_i2v.json` | Comfy-Org 模板 `video_ltx2_3_i2v.json` | ✅ |
| 7 | LTX-Video 2.3 T2V | `ltx23_t2v.json` | Comfy-Org 模板 `video_ltx2_3_t2v.json` | ✅ |
| 8 | FireRed-1.1 | `firered_1.1_official.json` | HuggingFace `FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI` | ✅ |
| 9 | PuLID-FLUX | `pulid_flux_16bit.json` | GitHub `balazik/ComfyUI-PuLID-Flux` | ✅ |
| 10 | CosyVoice 3.0 | `cosyvoice3_tts.json` | GitHub `filliptm/ComfyUI_FL-CosyVoice3` | ✅ |
| 11 | ACE-Step 1.5 | `ace_step_text2music.json` | GitHub `ace-step/ACE-Step-ComfyUI` | ✅ |
| 12 | HunyuanVideo-Foley | `hunyuan_foley_v2a.json` | GitHub `if-ai/ComfyUI_HunyuanVideoFoley` | ✅ |
| 13 | LatentSync v1.6 | `latentsync_basic.json` | GitHub `ShmuelRonen/ComfyUI-LatentSyncWrapper` | ⚠️ v1.5 工作流，换 checkpoint 兼容 |
| 14 | SeedVR2 | `seedvr2_hd_video.json` | GitHub `numz/ComfyUI-SeedVR2_VideoUpscaler` | ✅ |

> **注意**: LatentSync 工作流基于 v1.5，v1.6 模型只需替换 checkpoint 即可兼容。
> **注意**: LTX HF 路径为 `Lightricks/LTX-2.3`（05 文档写的 `LTX-Video-2.3` 可能 404，运维需确认）。

### 一键下载脚本

```bash
#!/bin/bash
set -e
BASE_DIR="/data/comfyui/workflows"
T="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/refs/heads/main/templates"
mkdir -p "$BASE_DIR"/{wan22,ltx,firered,pulid,cosyvoice,ace-step,hunyuan-foley,latentsync,seedvr2,z-image}

curl -sL -o "$BASE_DIR/z-image/z_image_turbo_t2i.json"        "$T/image_z_image_turbo.json"
curl -sL -o "$BASE_DIR/wan22/wan22_14B_i2v.json"              "$T/video_wan2_2_14B_i2v.json"
curl -sL -o "$BASE_DIR/wan22/wan22_14B_t2v.json"              "$T/video_wan2_2_14B_t2v.json"
curl -sL -o "$BASE_DIR/wan22/wan22_14B_flf2v.json"            "$T/video_wan2_2_14B_flf2v.json"
curl -sL -o "$BASE_DIR/ltx/ltx23_t2v.json"                    "$T/video_ltx2_3_t2v.json"
curl -sL -o "$BASE_DIR/ltx/ltx23_i2v.json"                    "$T/video_ltx2_3_i2v.json"
curl -sL -o "$BASE_DIR/firered/firered_1.1_official.json"      "https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI/resolve/main/firered-image-edit-1.1.json"
curl -sL -o "$BASE_DIR/pulid/pulid_flux_16bit.json"            "https://raw.githubusercontent.com/balazik/ComfyUI-PuLID-Flux/master/examples/pulid_flux_16bit_simple.json"
curl -sL -o "$BASE_DIR/cosyvoice/cosyvoice3_tts.json"         "https://raw.githubusercontent.com/filliptm/ComfyUI_FL-CosyVoice3/main/workflows/CosyVoice.json"
curl -sL -o "$BASE_DIR/ace-step/ace_step_text2music.json"      "https://raw.githubusercontent.com/ace-step/ACE-Step-ComfyUI/main/workflows/text2music.json"
curl -sL -o "$BASE_DIR/hunyuan-foley/hunyuan_foley_v2a.json"   "https://raw.githubusercontent.com/if-ai/ComfyUI_HunyuanVideoFoley/main/example_workflows/hunyuan_foley.json"
curl -sL -o "$BASE_DIR/latentsync/latentsync_basic.json"       "https://raw.githubusercontent.com/ShmuelRonen/ComfyUI-LatentSyncWrapper/main/example_workflows/latentsync1.5_comfyui_basic.json"
curl -sL -o "$BASE_DIR/seedvr2/seedvr2_hd_video.json"         "https://raw.githubusercontent.com/numz/ComfyUI-SeedVR2_VideoUpscaler/main/example_workflows/SeedVR2_HD_video_upscale.json"

echo "=== 下载完成: $(find "$BASE_DIR" -name '*.json' | wc -l) 个工作流 ==="
```

---

## 工作流总览

| # | 功能 | 管线节点 | 推荐工作流 | 来源 | 优先级 |
|---|------|---------|-----------|------|--------|
| 1 | 图像生成 (FLUX.2 Dev) | N07/N10 | FLUX.2 Dev T2I + Multi-Ref | Comfy-Org 官方 + Civitai | P0 |
| 2 | 图像生成 (Z-Image-Turbo) | N07 降级 | Z-Image-Turbo T2I | Comfy-Org 官方 | P0 |
| 3 | 视频生成 (Wan2.2 I2V) | N14 | Wan2.2 14B I2V + FLF2V | Comfy-Org 官方 | P0 |
| 4 | 视频生成 (Wan2.2 T2V) | N14 | Wan2.2 14B T2V | Comfy-Org 官方 | P0 |
| 5 | 视频生成 (LTX-2.3) | N14 速度 | LTX-2.3 I2V + T2V | Comfy-Org + Lightricks | P0 |
| 6 | 角色一致性 (FireRed) | N09/N13 | FireRed 1.1 MultiRef | HuggingFace 官方 | P0 |
| 7 | 人脸 ID (PuLID) | N10 | PuLID-FLUX 16bit | balazik 官方 | P0 |
| 8 | 风格保持 (IP-Adapter) | N10 | Multi-IPAdapter FLUX | Shakker-Labs 官方 | P1 |
| 9 | TTS (CosyVoice 3.0) | N20 | CosyVoice Zero-Shot | filliptm 官方 | P0 |
| 10 | BGM (ACE-Step 1.5) | N20 | Text2Music | ace-step 官方 | P0 |
| 11 | SFX (HunyuanFoley) | N20 | Video-to-Audio | if-ai 官方 | P0 |
| 12 | 口型同步 (LatentSync) | N20 | LatentSync 1.6 Basic | ShmuelRonen 官方 | P0 |
| 13 | 视频超分 (SeedVR2) | N17 | HD Video Upscale | numz 官方 | P0 |
| 14 | 运镜控制 (Wan2.2) | N14 S2 | Wan2.2 Fun Camera/Control | Comfy-Org 官方 | P1 |
| 15 | 音频混合 | N20 | Geek_AudioMixer | GeekyGhost | P1 |

---

## 1. 图像生成 — FLUX.2 Dev 32B

### 1.1 官方基础 T2I（Comfy-Org）

```bash
# 官方教程 + 内嵌工作流
# https://docs.comfy.org/tutorials/flux/flux-2-dev
# 拖拽教程页面的示例图到 ComfyUI 即可提取 JSON

# 官方模板页
# https://comfy.org/templates/image_flux2/
```

### 1.2 Civitai 高口碑工作流（推荐直接下载）

| 工作流 | 功能 | 下载页 |
|--------|------|--------|
| **FLUX.2 Dev Basic T2I** | 基础文生图 | https://civitai.com/models/2166149/flux-2dev-comfyui-workflow |
| **FLUX.2 Dev T2I + Reference** | 文生图 + 参考图引导 | https://civitai.com/models/2166497/flux-2-dev-basic-workflow-text-to-image-reference-support |
| **FLUX.2 Multi-image Reference** | 多参考图 + 可选 LoRA | https://civitai.com/models/2197238/flux2-workflow-with-optional-multi-image-reference |
| **FLUX.2 Dev + FlashVSR Upscaler** | T2I + 超分 | https://civitai.com/models/2168773/flux-dev-2-reboot-workflow-flashvsr-upscaler |

### 1.3 GitHub 辅助工具

| 工具 | 功能 | 仓库 |
|------|------|------|
| **ComfyUI-FLUX2-JSON** | FLUX.2 结构化 Prompt 构建器 | https://github.com/MushroomFleet/ComfyUI-FLUX2-JSON |
| **kiko-flux2-prompt-builder** | 可视化 Prompt 构建（镜头/光影/风格预设） | https://github.com/ComfyAssets/kiko-flux2-prompt-builder |

### 模型文件
```
models/checkpoints/flux2_dev_fp8mixed.safetensors   (~35GB, A800 全精度)
models/vae/flux2-vae.safetensors
models/text_encoders/mistral_3_small_flux2_fp8.safetensors
```

---

## 2. 图像生成 — Z-Image-Turbo（速度降级）

### 2.1 官方模板（Comfy-Org）

```bash
# 官方 JSON 模板（直接下载）
curl -o workflows/z_image_turbo_t2i.json \
  https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_z_image_turbo.json

# 官方教程（含 ControlNet Canny 工作流）
# https://docs.comfy.org/tutorials/image/z-image/z-image-turbo
```

### 2.2 Civitai 社区工作流

| 工作流 | 功能 | 下载页 |
|--------|------|--------|
| **Z-Image Turbo V6.0** | 基础 T2I | https://civitai.com/models/2170134/z-image-turbo-workflow |
| **Z-Image Turbo 3-in-1** | T2I + I2I + Inpainting | https://civitai.com/models/2187837/z-image-turbo-3-in-1-combo-simple-comfyui-workflow |
| **Amazing Z-Image V4.0** | T2I + 风格选择器 + 超分 | https://civitai.com/models/2181458/amazing-z-image-workflow |

### 模型文件
```
models/checkpoints/z_image_turbo_bf16.safetensors
models/vae/ae.safetensors
```

---

## 3. 视频生成 — Wan2.2（质量主力）

### 3.1 官方模板（Comfy-Org）— 全部可直接下载

这是最重要的一组工作流，覆盖 N14 所有视频生成场景。

```bash
TEMPLATE_BASE="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/refs/heads/main/templates"
WF_DIR="workflows/wan22"
mkdir -p "$WF_DIR"

# 核心工作流（P0）
curl -o "$WF_DIR/wan22_14B_i2v.json"       "$TEMPLATE_BASE/video_wan2_2_14B_i2v.json"
curl -o "$WF_DIR/wan22_14B_t2v.json"       "$TEMPLATE_BASE/video_wan2_2_14B_t2v.json"
curl -o "$WF_DIR/wan22_14B_flf2v.json"     "$TEMPLATE_BASE/video_wan2_2_14B_flf2v.json"

# 扩展工作流（P1）
curl -o "$WF_DIR/wan22_14B_s2v.json"       "$TEMPLATE_BASE/video_wan2_2_14B_s2v.json"
curl -o "$WF_DIR/wan22_14B_animate.json"   "$TEMPLATE_BASE/video_wan2_2_14B_animate.json"
curl -o "$WF_DIR/wan22_14B_fun_camera.json" "$TEMPLATE_BASE/video_wan2_2_14B_fun_camera.json"
curl -o "$WF_DIR/wan22_14B_fun_control.json" "$TEMPLATE_BASE/video_wan2_2_14B_fun_control.json"
curl -o "$WF_DIR/wan22_14B_fun_inpaint.json" "$TEMPLATE_BASE/video_wan2_2_14B_fun_inpaint.json"

# 5B 轻量版（4090 使用）
curl -o "$WF_DIR/wan22_5B_ti2v.json"       "$TEMPLATE_BASE/video_wan2_2_5B_ti2v.json"
curl -o "$WF_DIR/wan22_5B_fun_control.json" "$TEMPLATE_BASE/video_wan2_2_5B_fun_control.json"
```

### 各工作流用途对照

| JSON 文件 | 用途 | 管线节点 | 说明 |
|-----------|------|---------|------|
| `wan22_14B_i2v.json` | **关键帧→视频** | N14 核心 | 以 FrozenKeyframe 为起始帧生成视频 |
| `wan22_14B_t2v.json` | 文生视频 | N14 备选 | 无关键帧时的文本驱动生成 |
| `wan22_14B_flf2v.json` | **首尾帧→视频** | N14 转场 | 两个关键帧之间生成过渡视频，720p |
| `wan22_14B_s2v.json` | 主体驱动视频 | N14 角色 | 保持角色一致性的视频生成 |
| `wan22_14B_animate.json` | 角色动画 | N14 动画 | Wan-Animate 角色驱动动画 |
| `wan22_14B_fun_camera.json` | **运镜控制** | N14 S2 镜头 | camera_movement 指令驱动 |
| `wan22_14B_fun_control.json` | ControlNet | N14 复杂动作 | Pose/Depth/Canny/MLSD 控制 (VACE 架构) |
| `wan22_14B_fun_inpaint.json` | 视频修复 | N14 修补 | 视频 inpainting/outpainting |

### 3.2 社区长视频工作流（Jeff-Emmett）

```bash
# 长视频工作流（用于超过 5 秒的镜头）
# https://github.com/Jeff-Emmett/ComfyUI_Workflows
# 文件：
#   video_wan2_2_14B_i2v_lx2v_long_video_with_scenario.json  — 叙事分段长视频
#   video_wan2_2_14B_i2v_lx2v_unlimited_long_video.json      — 无限长视频循环
```

---

## 4. 视频生成 — LTX-Video 2.3（速度主力）

### 4.1 官方模板

```bash
TEMPLATE_BASE="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/refs/heads/main/templates"
WF_DIR="workflows/ltx"
mkdir -p "$WF_DIR"

curl -o "$WF_DIR/ltx23_t2v.json" "$TEMPLATE_BASE/video_ltx2_3_t2v.json"
curl -o "$WF_DIR/ltx23_i2v.json" "$TEMPLATE_BASE/video_ltx2_3_i2v.json"
```

### 4.2 Lightricks 官方工作流

```bash
# https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows
# 文件：
#   LTX-2.3_T2V_I2V_Single_Stage_Distilled_Full.json    — 单阶段（速度优先）
#   LTX-2.3_T2V_I2V_Two_Stage_Distilled.json             — 两阶段+超分（质量优先）
#   LTX-2.3_ICLoRA_Union_Control_Distilled.json           — ControlNet 多控制
#   LTX-2.3_ICLoRA_Motion_Track_Distilled.json            — 运动轨迹追踪
```

### 性能参考
- 512x768, 121 帧: ~11 秒 (4090)
- 1216x704, 88 帧: ~2 分钟 (4090)
- Distilled 版本: <10 秒可出片

---

## 5. 角色一致性 — FireRed-1.1

### 5.1 官方工作流（HuggingFace）

```bash
WF_DIR="workflows/firered"
mkdir -p "$WF_DIR"

# FireRed 1.1 官方 ComfyUI 工作流（核心）
curl -o "$WF_DIR/firered_1.1_official.json" \
  "https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI/resolve/main/firered-image-edit-1.1.json"
```

**功能**: 支持 1-3 张参考图的多图编辑。Prompt 中指定 "place the subject from image 1 onto image 2"。
**用法**: N09 角色固化 — 3 张参考图（正面+3/4侧+全身）→ 批量生成服装/表情变体。

### 注意
- 官方仓库为 `FireRedTeam`（非 xiaoyuan-hb），HuggingFace: `FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI`
- GitHub: https://github.com/FireRedTeam/FireRed-Image-Edit

---

## 6. 人脸 ID — PuLID-FLUX

### 6.1 官方工作流（balazik）

```bash
WF_DIR="workflows/pulid"
mkdir -p "$WF_DIR"

# 全精度版（A800 使用）
curl -o "$WF_DIR/pulid_flux_16bit.json" \
  "https://raw.githubusercontent.com/balazik/ComfyUI-PuLID-Flux/master/examples/pulid_flux_16bit_simple.json"

# 8bit GGUF 版（4090 回退）
curl -o "$WF_DIR/pulid_flux_8bit_gguf.json" \
  "https://raw.githubusercontent.com/balazik/ComfyUI-PuLID-Flux/master/examples/pulid_flux_8bitgguf_simple.json"
```

### 6.2 多人脸工作流（PaoloC68 Chroma 分支）

```bash
# 多角色场景 — 保持多个不同角色的人脸 ID
curl -o "$WF_DIR/pulid_multi_face.json" \
  "https://raw.githubusercontent.com/PaoloC68/ComfyUI-PuLID-Flux-Chroma/main/examples/flux_pulid_multi.json"

# 角色换装展示（保 ID 换服装/场景）
curl -o "$WF_DIR/pulid_fashion_showcase.json" \
  "https://raw.githubusercontent.com/PaoloC68/ComfyUI-PuLID-Flux-Chroma/main/examples/chroma_pulid_fashion_showcase.json"
```

### 商用注意
- PuLID 默认用 InsightFace（有商用许可限制）
- 商用替代: `lldacing/ComfyUI_PuLID_Flux_ll` — 使用 FaceNet 替代 InsightFace

---

## 7. 风格保持 — IP-Adapter FLUX

### 7.1 Shakker-Labs 官方工作流

```bash
WF_DIR="workflows/ipadapter"
mkdir -p "$WF_DIR"

# 基础 IP-Adapter
curl -o "$WF_DIR/ipadapter_basic.json" \
  "https://raw.githubusercontent.com/Shakker-Labs/ComfyUI-IPAdapter-Flux/main/workflows/ipadapter_example.json"

# 多参考图 IP-Adapter（多角色/多风格参考）
curl -o "$WF_DIR/ipadapter_multi.json" \
  "https://raw.githubusercontent.com/Shakker-Labs/ComfyUI-IPAdapter-Flux/main/workflows/multi-ipadapter_example.json"

# 可控影响范围（调节 IP-Adapter 介入时机）
curl -o "$WF_DIR/ipadapter_start_end.json" \
  "https://raw.githubusercontent.com/Shakker-Labs/ComfyUI-IPAdapter-Flux/main/workflows/ipadapter_example_start_end_percent.json"
```

### 7.2 XLabs 替代实现

```bash
# XLabs IP-Adapter（不同的模型权重）
curl -o "$WF_DIR/ipadapter_xlabs.json" \
  "https://raw.githubusercontent.com/XLabs-AI/x-flux-comfyui/main/workflows/ip_adapter_workflow.json"
```

---

## 8. TTS — CosyVoice 3.0

### 8.1 官方工作流

```bash
WF_DIR="workflows/cosyvoice"
mkdir -p "$WF_DIR"

curl -o "$WF_DIR/cosyvoice3_tts.json" \
  "https://raw.githubusercontent.com/filliptm/ComfyUI_FL-CosyVoice3/main/workflows/CosyVoice.json"
```

**功能**: 零样本语音克隆 + 跨语言合成 + 语音转换。
**节点**: Model Loader → Zero-Shot Clone / Cross-Lingual → 音频输出。

---

## 9. BGM — ACE-Step 1.5

### 9.1 官方工作流

```bash
WF_DIR="workflows/ace-step"
mkdir -p "$WF_DIR"

curl -o "$WF_DIR/ace_step_text2music.json" \
  "https://raw.githubusercontent.com/ace-step/ACE-Step-ComfyUI/main/workflows/text2music.json"
```

**功能**: 文本→音乐生成。支持 caption（风格描述）+ lyrics（歌词标签 `[verse]` `[chorus]`）。留空歌词 = 纯器乐。
**性能**: A100 上 20 秒生成 4 分钟音乐。

### 9.2 ComfyUI 原生教程
```
# ACE-Step 已被 ComfyUI 原生收录
# 教程: https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1
```

---

## 10. SFX — HunyuanVideo-Foley

### 10.1 官方工作流（if-ai）

```bash
WF_DIR="workflows/hunyuan-foley"
mkdir -p "$WF_DIR"

curl -o "$WF_DIR/hunyuan_foley_v2a.json" \
  "https://raw.githubusercontent.com/if-ai/ComfyUI_HunyuanVideoFoley/main/example_workflows/hunyuan_foley.json"
```

**功能**: 视频→音频 (V2A)。输入视频片段 + 文本提示 → 生成匹配音效。
**节点链**: Model Loader → Dependencies Loader → Torch Compile → Generator (Advanced)
**限制**: 最长 15 秒 (450 帧 @ 30fps)，pipeline 需分段拼接。
**VRAM**: BF16 全精度 ~24GB (A800)。

### 模型文件
```
models/hunyuanfoley/hunyuanvideo_foley.pth
models/hunyuanfoley/vae_128d_48k.pth
models/hunyuanfoley/synchformer_state_dict.pth
# 来源: huggingface.co/tencent/HunyuanVideo-Foley
```

---

## 11. 口型同步 — LatentSync v1.6

### 11.1 官方工作流

```bash
WF_DIR="workflows/latentsync"
mkdir -p "$WF_DIR"

curl -o "$WF_DIR/latentsync_basic.json" \
  "https://raw.githubusercontent.com/ShmuelRonen/ComfyUI-LatentSyncWrapper/main/example_workflows/latentsync1.5_comfyui_basic.json"
```

**功能**: 音频驱动口型同步。支持 v1.5 和 v1.6（换 checkpoint 即可）。
**参数**: seed, lips_expression, inference_steps。
**输入**: 512×512 视频 + 音频 → 口型同步视频 → SeedVR2 超分。

### 11.2 社区增强工作流（OpenArt 存档）

| 工作流 | 功能 | 链接 |
|--------|------|------|
| **多角色隔离口型同步** | 自动分离多角色 + 分别口型同步 | https://openart.ai/workflows/sneakyrobot/auto-multiple-character-isolation-and-lipsync-workflow/b66KjymJ0cBXr5rj6VZQ |
| **LatentSync + Face Fix** | 口型同步 + 面部修复 | https://openart.ai/workflows/jerrydavos/v30-lipsync-swapper-face-fix/tHGTqemrSrUsmym9lHuY |

---

## 12. 视频超分 — SeedVR2

### 12.1 官方工作流（numz）

```bash
WF_DIR="workflows/seedvr2"
mkdir -p "$WF_DIR"

# 视频超分（N17 核心工作流）
curl -o "$WF_DIR/seedvr2_hd_video.json" \
  "https://raw.githubusercontent.com/numz/ComfyUI-SeedVR2_VideoUpscaler/main/example_workflows/SeedVR2_HD_video_upscale.json"

# 图像超分（美术资产用）
curl -o "$WF_DIR/seedvr2_4k_image.json" \
  "https://raw.githubusercontent.com/numz/ComfyUI-SeedVR2_VideoUpscaler/main/example_workflows/SeedVR2_4K_image_upscale.json"

# 简单图像超分
curl -o "$WF_DIR/seedvr2_simple_image.json" \
  "https://raw.githubusercontent.com/numz/ComfyUI-SeedVR2_VideoUpscaler/main/example_workflows/SeedVR2_simple_image_upscale.json"
```

### 12.2 Comfy.org 官方模板
```
# 图像超分: https://comfy.org/templates/utility_seedvr2_image_upscale/
# 视频超分: https://comfy.org/templates/utility_seedvr2_video_upscale/
```

### 模型文件
```
# 模型自动下载到 ComfyUI/models/SEEDVR2/
# 来源: huggingface.co/numz/SeedVR2_comfyUI
# 可选: 3B/7B, FP16/FP8/GGUF
# A800 使用 7B FP16 获得最佳质量
```

---

## 13. 音频混合 — Geek_AudioMixer

### 安装

```bash
cd /path/to/ComfyUI/custom_nodes/
git clone https://github.com/GeekyGhost/ComfyUI_Geeky_AudioMixer
# 或通过 ComfyUI Manager 搜索 "Geeky AudioMixer"
```

**功能**: 4 轨音频混音器。1 主轨 + 3 可选轨。逐轨控制: 音量 (0-500%)、起始偏移 (0-60s)、淡入淡出 (0-5s)。主音量、预增益、动态压缩、软限制。输出 WAV/MP3/FLAC。

**典型连接**:
```
[CosyVoice TTS 输出] ──→ audio_1 (对白主轨)
[ACE-Step BGM 输出]  ──→ audio_2 (背景音乐)
[HunyuanFoley SFX]   ──→ audio_3 (音效)
[额外音效]            ──→ audio_4 (可选)
         ↓
   [Geeky AudioMixer]
         ↓
   [混合音频] ──→ [Video Combine]
```

无独立 JSON 工作流文件，作为节点嵌入其他工作流使用。

---

## 一键下载脚本

```bash
#!/bin/bash
# download-comfyui-workflows.sh — 运维 Agent 可直接执行
set -e

BASE_DIR="/data/comfyui/workflows"
mkdir -p "$BASE_DIR"/{wan22,ltx,firered,pulid,ipadapter,cosyvoice,ace-step,hunyuan-foley,latentsync,seedvr2,z-image}

TEMPLATE_BASE="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/refs/heads/main/templates"

echo "=== 1. Z-Image-Turbo ==="
curl -sL -o "$BASE_DIR/z-image/z_image_turbo_t2i.json" \
  "$TEMPLATE_BASE/image_z_image_turbo.json"

echo "=== 2. Wan2.2 官方模板 (9个) ==="
for wf in \
  video_wan2_2_14B_i2v \
  video_wan2_2_14B_t2v \
  video_wan2_2_14B_flf2v \
  video_wan2_2_14B_s2v \
  video_wan2_2_14B_animate \
  video_wan2_2_14B_fun_camera \
  video_wan2_2_14B_fun_control \
  video_wan2_2_14B_fun_inpaint \
  video_wan2_2_5B_ti2v; do
  curl -sL -o "$BASE_DIR/wan22/${wf}.json" "$TEMPLATE_BASE/${wf}.json"
done

echo "=== 3. LTX-Video 2.3 ==="
curl -sL -o "$BASE_DIR/ltx/ltx23_t2v.json" "$TEMPLATE_BASE/video_ltx2_3_t2v.json"
curl -sL -o "$BASE_DIR/ltx/ltx23_i2v.json" "$TEMPLATE_BASE/video_ltx2_3_i2v.json"

echo "=== 4. FireRed 1.1 ==="
curl -sL -o "$BASE_DIR/firered/firered_1.1_official.json" \
  "https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI/resolve/main/firered-image-edit-1.1.json"

echo "=== 5. PuLID-FLUX ==="
curl -sL -o "$BASE_DIR/pulid/pulid_flux_16bit.json" \
  "https://raw.githubusercontent.com/balazik/ComfyUI-PuLID-Flux/master/examples/pulid_flux_16bit_simple.json"
curl -sL -o "$BASE_DIR/pulid/pulid_multi_face.json" \
  "https://raw.githubusercontent.com/PaoloC68/ComfyUI-PuLID-Flux-Chroma/main/examples/flux_pulid_multi.json"

echo "=== 6. IP-Adapter FLUX ==="
curl -sL -o "$BASE_DIR/ipadapter/ipadapter_basic.json" \
  "https://raw.githubusercontent.com/Shakker-Labs/ComfyUI-IPAdapter-Flux/main/workflows/ipadapter_example.json"
curl -sL -o "$BASE_DIR/ipadapter/ipadapter_multi.json" \
  "https://raw.githubusercontent.com/Shakker-Labs/ComfyUI-IPAdapter-Flux/main/workflows/multi-ipadapter_example.json"

echo "=== 7. CosyVoice 3.0 ==="
curl -sL -o "$BASE_DIR/cosyvoice/cosyvoice3_tts.json" \
  "https://raw.githubusercontent.com/filliptm/ComfyUI_FL-CosyVoice3/main/workflows/CosyVoice.json"

echo "=== 8. ACE-Step 1.5 ==="
curl -sL -o "$BASE_DIR/ace-step/ace_step_text2music.json" \
  "https://raw.githubusercontent.com/ace-step/ACE-Step-ComfyUI/main/workflows/text2music.json"

echo "=== 9. HunyuanVideo-Foley ==="
curl -sL -o "$BASE_DIR/hunyuan-foley/hunyuan_foley_v2a.json" \
  "https://raw.githubusercontent.com/if-ai/ComfyUI_HunyuanVideoFoley/main/example_workflows/hunyuan_foley.json"

echo "=== 10. LatentSync ==="
curl -sL -o "$BASE_DIR/latentsync/latentsync_basic.json" \
  "https://raw.githubusercontent.com/ShmuelRonen/ComfyUI-LatentSyncWrapper/main/example_workflows/latentsync1.5_comfyui_basic.json"

echo "=== 11. SeedVR2 ==="
curl -sL -o "$BASE_DIR/seedvr2/seedvr2_hd_video.json" \
  "https://raw.githubusercontent.com/numz/ComfyUI-SeedVR2_VideoUpscaler/main/example_workflows/SeedVR2_HD_video_upscale.json"
curl -sL -o "$BASE_DIR/seedvr2/seedvr2_4k_image.json" \
  "https://raw.githubusercontent.com/numz/ComfyUI-SeedVR2_VideoUpscaler/main/example_workflows/SeedVR2_4K_image_upscale.json"

echo "=== All workflows downloaded ==="
echo "Total: $(find "$BASE_DIR" -name '*.json' | wc -l) JSON files"
```

---

## 工作流与管线节点映射

```
N06 (Prompt 工程)
 └─ 无 ComfyUI 工作流（LLM 生成 prompt + workflow JSON）

N07 (美术图生成)
 ├─ FLUX.2 Dev T2I + Multi-Ref        ← flux2_dev_t2i.json
 ├─ Z-Image-Turbo T2I (降级)          ← z_image_turbo_t2i.json
 └─ FireRed 1.1 MultiRef (角色变体)   ← firered_1.1_official.json

N09 (角色固化)
 ├─ FireRed 1.1 MultiRef              ← firered_1.1_official.json
 └─ PuLID-FLUX (人脸 ID)             ← pulid_flux_16bit.json

N10 (关键帧生成) — 两阶段
 Phase 1: LLM (Gemini 3.1) 为每帧×每候选生成独立 prompt + motion_script
 Phase 2: ComfyUI 执行生图 ↓
 ├─ FLUX.2 Dev + FireRed + PuLID      ← 组合工作流
 ├─ IP-Adapter Multi (风格一致)        ← ipadapter_multi.json
 └─ Z-Image-Turbo (降级)              ← z_image_turbo_t2i.json

N13 (关键帧定稿)
 └─ FireRed 1.1 Edit (微调修正)       ← firered_1.1_official.json

N14 (视频生成)
 ├─ Wan2.2 14B I2V (质量主力)          ← wan22_14B_i2v.json
 ├─ Wan2.2 14B FLF2V (转场)           ← wan22_14B_flf2v.json
 ├─ Wan2.2 Fun Camera (运镜 S2)        ← wan22_14B_fun_camera.json
 ├─ Wan2.2 Fun Control (ControlNet S2) ← wan22_14B_fun_control.json
 ├─ LTX-2.3 I2V (速度 S0/S1)          ← ltx23_i2v.json
 └─ LTX-2.3 T2V (速度 S0/S1)          ← ltx23_t2v.json

N17 (视频定稿 + 超分)
 ├─ SeedVR2 HD Video Upscale          ← seedvr2_hd_video.json
 └─ SeedVR2 4K Image Upscale          ← seedvr2_4k_image.json

N20 (视听整合)
 ├─ CosyVoice 3.0 TTS                 ← cosyvoice3_tts.json
 ├─ ACE-Step 1.5 BGM                  ← ace_step_text2music.json
 ├─ HunyuanVideo-Foley SFX            ← hunyuan_foley_v2a.json
 ├─ LatentSync 1.6 口型同步            ← latentsync_basic.json
 └─ Geek_AudioMixer 混音              ← (节点内嵌，无独立 JSON)
```

---

## 自定义节点安装汇总（更新版）

```bash
cd /path/to/ComfyUI/custom_nodes/

# === P0 核心节点 ===

# Wan2.2 — ComfyUI 原生支持，确保 ComfyUI 更新到最新版即可

# LTX-Video
git clone https://github.com/Lightricks/ComfyUI-LTXVideo

# FireRed 1.1
# 安装 ComfyUI 兼容包:
pip install firered-image-edit  # 或按 HuggingFace 仓库说明

# PuLID-FLUX
git clone https://github.com/balazik/ComfyUI-PuLID-Flux

# IP-Adapter FLUX
git clone https://github.com/Shakker-Labs/ComfyUI-IPAdapter-Flux

# CosyVoice 3.0
git clone https://github.com/filliptm/ComfyUI_FL-CosyVoice3

# ACE-Step (ComfyUI 原生已收录，也可手动安装)
git clone https://github.com/ace-step/ACE-Step-ComfyUI

# HunyuanVideo-Foley
git clone https://github.com/if-ai/ComfyUI_HunyuanVideoFoley

# LatentSync
git clone https://github.com/ShmuelRonen/ComfyUI-LatentSyncWrapper

# SeedVR2
git clone https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler

# === P1 辅助节点 ===

# 音频混合
git clone https://github.com/GeekyGhost/ComfyUI_Geeky_AudioMixer

# FLUX.2 Prompt 构建器
git clone https://github.com/MushroomFleet/ComfyUI-FLUX2-JSON

# ReActor (人脸质检)
git clone https://github.com/Gourieff/comfyui-reactor-node

# cubiq IP-Adapter Plus (通用 IP-Adapter)
git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus
```

---

## 更新日志

| 日期 | 变更 |
|------|------|
| 2026-03-10 | v1.1 — 增加「适配验证」章节：模型→工作流兼容矩阵 + P0 一键下载脚本 + 版本差异警告（Stable Audio "2.5" 不存在、LTX HF 路径修正、LatentSync v1.5→v1.6 兼容说明） |
| 2026-03-09 | v1.0 — 初始版本，15 类工作流全量收录，一键下载脚本 |
