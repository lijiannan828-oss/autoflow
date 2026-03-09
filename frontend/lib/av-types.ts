// ===== Audiovisual Integration Types =====

// Audio clip types
export type AudioClipType = "voiceover" | "sfx" | "bgm"

export interface AudioClip {
  id: string
  type: AudioClipType
  name: string
  startTime: number
  duration: number
  trackIndex: number
  waveformColor: string
  volume: number
  fadeIn: number
  fadeOut: number
  character?: string // For voiceover clips
  dialogueText?: string
  generationModel?: string
}

// Video clip on timeline
export interface VideoClip {
  id: string
  name: string
  thumbnailColor: string
  startTime: number
  duration: number
  inPoint: number
  outPoint: number
}

// Subtitle clip
export interface SubtitleClip {
  id: string
  text: string
  startTime: number
  duration: number
  speaker?: string
}

// Track definition
export type TrackType = "subtitle" | "video" | "voiceover" | "sfx" | "bgm"

export interface Track {
  id: string
  type: TrackType
  name: string
  color: string
  muted: boolean
  locked: boolean
  height: number
}

// Character for voiceover
export interface Character {
  id: string
  name: string
  avatarColor: string
  voiceModel: string
  defaultLanguage: string
}

// Generated audio take
export interface AudioTake {
  id: string
  characterId: string
  dialogueText: string
  duration: number
  model: string
  language: string
  createdAt: string
  waveformColor: string
}

// AV page state
export interface AVEpisodeData {
  episodeId: string
  episodeTitle: string
  projectName: string
  totalDuration: number
  fps: number
  totalShots: number
  generatedAudioCount: number
  matchedSfx: number
  matchedBgm: number
  tracks: Track[]
  videoClips: VideoClip[]
  audioClips: AudioClip[]
  subtitleClips: SubtitleClip[]
  characters: Character[]
  audioTakes: AudioTake[]
}

// Selected item on timeline
export type SelectedItem = {
  type: "video" | "audio" | "subtitle"
  id: string
} | null

// Audio generation mode
export type AudioTabType = "voiceover" | "sfx" | "bgm"

// Format timecode for NLE display (HH:MM:SS:FF)
export function formatNLETimecode(seconds: number, fps: number = 25): string {
  const totalFrames = Math.floor(seconds * fps)
  const hours = Math.floor(totalFrames / (fps * 60 * 60))
  const minutes = Math.floor((totalFrames % (fps * 60 * 60)) / (fps * 60))
  const secs = Math.floor((totalFrames % (fps * 60)) / fps)
  const frames = totalFrames % fps
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`
}
