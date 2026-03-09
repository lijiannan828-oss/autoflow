import type { AVEpisodeData, Track, VideoClip, AudioClip, SubtitleClip, Character, AudioTake } from "./av-types"

// Characters for voiceover
export const characters: Character[] = [
  { id: "char-1", name: "克莱尔", avatarColor: "#8B6F47", voiceModel: "female-young-cn", defaultLanguage: "zh-CN" },
  { id: "char-2", name: "维克多", avatarColor: "#5C6B73", voiceModel: "male-mature-cn", defaultLanguage: "zh-CN" },
  { id: "char-3", name: "伊莎贝拉", avatarColor: "#A45A52", voiceModel: "female-mature-cn", defaultLanguage: "zh-CN" },
  { id: "char-4", name: "詹姆斯", avatarColor: "#6B8F71", voiceModel: "male-young-cn", defaultLanguage: "zh-CN" },
  { id: "char-5", name: "旁白", avatarColor: "#7B6B8D", voiceModel: "narrator-cn", defaultLanguage: "zh-CN" },
]

// Track definitions
const tracks: Track[] = [
  { id: "track-subtitle", type: "subtitle", name: "字幕", color: "#94A3B8", muted: false, locked: false, height: 32 },
  { id: "track-video", type: "video", name: "视频", color: "#6366F1", muted: false, locked: false, height: 56 },
  { id: "track-voiceover", type: "voiceover", name: "配音", color: "#3B82F6", muted: false, locked: false, height: 48 },
  { id: "track-sfx", type: "sfx", name: "音效", color: "#10B981", muted: false, locked: false, height: 40 },
  { id: "track-bgm", type: "bgm", name: "音乐", color: "#A855F7", muted: false, locked: false, height: 40 },
]

// Video clips (representing shots)
const videoClips: VideoClip[] = [
  { id: "vc-1", name: "分镜1", thumbnailColor: "#8B6F47", startTime: 0, duration: 5, inPoint: 0, outPoint: 5 },
  { id: "vc-2", name: "分镜2", thumbnailColor: "#5C6B73", startTime: 5, duration: 4.5, inPoint: 0, outPoint: 4.5 },
  { id: "vc-3", name: "分镜3", thumbnailColor: "#A45A52", startTime: 9.5, duration: 6, inPoint: 0, outPoint: 6 },
  { id: "vc-4", name: "分镜4", thumbnailColor: "#6B8F71", startTime: 15.5, duration: 3.5, inPoint: 0, outPoint: 3.5 },
  { id: "vc-5", name: "分镜5", thumbnailColor: "#7B6B8D", startTime: 19, duration: 5.5, inPoint: 0, outPoint: 5.5 },
  { id: "vc-6", name: "分镜6", thumbnailColor: "#8C7853", startTime: 24.5, duration: 4, inPoint: 0, outPoint: 4 },
  { id: "vc-7", name: "分镜7", thumbnailColor: "#4A6670", startTime: 28.5, duration: 5, inPoint: 0, outPoint: 5 },
  { id: "vc-8", name: "分镜8", thumbnailColor: "#9B7653", startTime: 33.5, duration: 3.5, inPoint: 0, outPoint: 3.5 },
  { id: "vc-9", name: "分镜9", thumbnailColor: "#8B6F47", startTime: 37, duration: 4, inPoint: 0, outPoint: 4 },
  { id: "vc-10", name: "分镜10", thumbnailColor: "#5C6B73", startTime: 41, duration: 5, inPoint: 0, outPoint: 5 },
  { id: "vc-11", name: "分镜11", thumbnailColor: "#A45A52", startTime: 46, duration: 4.5, inPoint: 0, outPoint: 4.5 },
  { id: "vc-12", name: "分镜12", thumbnailColor: "#6B8F71", startTime: 50.5, duration: 3.5, inPoint: 0, outPoint: 3.5 },
]

// Audio clips - voiceover
const audioClips: AudioClip[] = [
  { id: "ac-1", type: "voiceover", name: "克莱尔台词1", startTime: 0.5, duration: 3.5, trackIndex: 2, waveformColor: "#3B82F6", volume: 100, fadeIn: 0.1, fadeOut: 0.1, character: "克莱尔", dialogueText: "这里发生了什么？为什么地上全是红酒？" },
  { id: "ac-2", type: "voiceover", name: "维克多台词1", startTime: 5.5, duration: 3, trackIndex: 2, waveformColor: "#3B82F6", volume: 100, fadeIn: 0.1, fadeOut: 0.1, character: "维克多", dialogueText: "小姐，请您先回房间，这里交给我处理。" },
  { id: "ac-3", type: "voiceover", name: "旁白1", startTime: 10, duration: 4, trackIndex: 2, waveformColor: "#3B82F6", volume: 90, fadeIn: 0.2, fadeOut: 0.3, character: "旁白", dialogueText: "月光透过彩色玻璃窗，在地板上投下诡异的光影。" },
  { id: "ac-4", type: "voiceover", name: "伊莎贝拉台词1", startTime: 16, duration: 2.5, trackIndex: 2, waveformColor: "#3B82F6", volume: 100, fadeIn: 0.1, fadeOut: 0.1, character: "伊莎贝拉", dialogueText: "今晚的宴会，似乎有些不对劲。" },
  { id: "ac-5", type: "voiceover", name: "詹姆斯台词1", startTime: 20, duration: 4, trackIndex: 2, waveformColor: "#3B82F6", volume: 100, fadeIn: 0.1, fadeOut: 0.1, character: "詹姆斯", dialogueText: "所有人都有嫌疑，包括你我在内。" },
  { id: "ac-6", type: "voiceover", name: "克莱尔台词2", startTime: 25, duration: 3, trackIndex: 2, waveformColor: "#3B82F6", volume: 100, fadeIn: 0.1, fadeOut: 0.1, character: "克莱尔", dialogueText: "不，我什么都没看见，什么都没听见。" },
  { id: "ac-7", type: "voiceover", name: "旁白2", startTime: 29, duration: 3.5, trackIndex: 2, waveformColor: "#3B82F6", volume: 90, fadeIn: 0.2, fadeOut: 0.3, character: "旁白", dialogueText: "真相，往往隐藏在最不起眼的角落。" },
  { id: "ac-8", type: "voiceover", name: "维克多台词2", startTime: 34, duration: 2.5, trackIndex: 2, waveformColor: "#3B82F6", volume: 100, fadeIn: 0.1, fadeOut: 0.1, character: "维克多", dialogueText: "请各位留步，没有我的允许，谁也不能离开。" },
  // SFX clips
  { id: "sfx-1", type: "sfx", name: "玻璃碎裂", startTime: 2, duration: 1.5, trackIndex: 3, waveformColor: "#10B981", volume: 80, fadeIn: 0, fadeOut: 0.2 },
  { id: "sfx-2", type: "sfx", name: "脚步声", startTime: 8, duration: 2, trackIndex: 3, waveformColor: "#10B981", volume: 60, fadeIn: 0.1, fadeOut: 0.1 },
  { id: "sfx-3", type: "sfx", name: "钟声", startTime: 14, duration: 3, trackIndex: 3, waveformColor: "#10B981", volume: 70, fadeIn: 0.5, fadeOut: 1 },
  { id: "sfx-4", type: "sfx", name: "门吱呀声", startTime: 22, duration: 1.5, trackIndex: 3, waveformColor: "#10B981", volume: 65, fadeIn: 0, fadeOut: 0.3 },
  { id: "sfx-5", type: "sfx", name: "雷声", startTime: 31, duration: 2.5, trackIndex: 3, waveformColor: "#10B981", volume: 85, fadeIn: 0.3, fadeOut: 0.8 },
  { id: "sfx-6", type: "sfx", name: "钢琴和弦", startTime: 42, duration: 2, trackIndex: 3, waveformColor: "#10B981", volume: 55, fadeIn: 0, fadeOut: 0.5 },
  // BGM clips
  { id: "bgm-1", type: "bgm", name: "悬疑氛围", startTime: 0, duration: 25, trackIndex: 4, waveformColor: "#A855F7", volume: 40, fadeIn: 2, fadeOut: 3 },
  { id: "bgm-2", type: "bgm", name: "紧张配乐", startTime: 25, duration: 29, trackIndex: 4, waveformColor: "#A855F7", volume: 45, fadeIn: 1.5, fadeOut: 2 },
]

// Subtitle clips
const subtitleClips: SubtitleClip[] = [
  { id: "sub-1", text: "这里发生了什么？为什么地上全是红酒？", startTime: 0.5, duration: 3.5, speaker: "克莱尔" },
  { id: "sub-2", text: "小姐，请您先回房间，这里交给我处理。", startTime: 5.5, duration: 3, speaker: "维克多" },
  { id: "sub-3", text: "月光透过彩色玻璃窗，在地板上投下诡异的光影。", startTime: 10, duration: 4 },
  { id: "sub-4", text: "今晚的宴会，似乎有些不对劲。", startTime: 16, duration: 2.5, speaker: "伊莎贝拉" },
  { id: "sub-5", text: "所有人都有嫌疑，包括你我在内。", startTime: 20, duration: 4, speaker: "詹姆斯" },
  { id: "sub-6", text: "不，我什么都没看见，什么都没听见。", startTime: 25, duration: 3, speaker: "克莱尔" },
  { id: "sub-7", text: "真相，往往隐藏在最不起眼的角落。", startTime: 29, duration: 3.5 },
  { id: "sub-8", text: "请各位留步，没有我的允许，谁也不能离开。", startTime: 34, duration: 2.5, speaker: "维克多" },
]

// Pre-generated audio takes
const audioTakes: AudioTake[] = [
  { id: "take-1", characterId: "char-1", dialogueText: "这里发生了什么？为什么地上全是红酒？", duration: 3.5, model: "Wan2.2", language: "zh-CN", createdAt: new Date(Date.now() - 3600000).toISOString(), waveformColor: "#3B82F6" },
  { id: "take-2", characterId: "char-1", dialogueText: "这里发生了什么？为什么地上全是红酒？", duration: 3.8, model: "Hunyuan", language: "zh-CN", createdAt: new Date(Date.now() - 3000000).toISOString(), waveformColor: "#60A5FA" },
  { id: "take-3", characterId: "char-2", dialogueText: "小姐，请您先回房间，这里交给我处理。", duration: 3, model: "Wan2.2", language: "zh-CN", createdAt: new Date(Date.now() - 2400000).toISOString(), waveformColor: "#3B82F6" },
  { id: "take-4", characterId: "char-5", dialogueText: "月光透过彩色玻璃窗，在地板上投下诡异的光影。", duration: 4, model: "Wan2.2", language: "zh-CN", createdAt: new Date(Date.now() - 1800000).toISOString(), waveformColor: "#3B82F6" },
  { id: "take-5", characterId: "char-3", dialogueText: "今晚的宴会，似乎有些不对劲。", duration: 2.5, model: "Hunyuan", language: "zh-CN", createdAt: new Date(Date.now() - 1200000).toISOString(), waveformColor: "#60A5FA" },
  { id: "take-6", characterId: "char-4", dialogueText: "所有人都有嫌疑，包括你我在内。", duration: 4, model: "Wan2.2", language: "zh-CN", createdAt: new Date(Date.now() - 600000).toISOString(), waveformColor: "#3B82F6" },
]

export const avEpisodeData: AVEpisodeData = {
  episodeId: "ep-1",
  episodeTitle: "第1集 游戏开始",
  projectName: "万斯家族的回响: 游戏开始",
  totalDuration: 54, // ~54 seconds total
  fps: 25,
  totalShots: 32,
  generatedAudioCount: 28,
  matchedSfx: 8,
  matchedBgm: 3,
  tracks,
  videoClips,
  audioClips,
  subtitleClips,
  characters,
  audioTakes,
}
