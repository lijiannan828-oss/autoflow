"use client"

import { useState } from "react"
import { Sparkles, Play, Pause, GripVertical, Music, Mic, Volume2, Search, Send, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Character, AudioTake, AudioTabType, SelectedItem, AudioClip } from "@/lib/av-types"

interface AudioPanelProps {
  characters: Character[]
  audioTakes: AudioTake[]
  selectedItem: SelectedItem
  audioClips: AudioClip[]
  onGenerateVoice: (characterId: string, text: string, model: string, language: string) => void
  onDragTake: (takeId: string) => void
  onReplaceSfx?: (clipId: string, newSfxName: string) => void
  onSubmitMusicFeedback?: (clipId: string, feedback: string) => void
}

const voiceModels = [
  { id: "elevenlabs", name: "Elevenlabs", description: "情感丰富，声音自然" },
  { id: "minimax", name: "Minimax", description: "高质量TTS，多语言支持" },
]

const languages = [
  { id: "zh-CN", name: "普通话" },
  { id: "zh-TW", name: "粤语" },
  { id: "en-US", name: "English" },
  { id: "ja-JP", name: "日本語" },
]

// Mock sound effects library
const sfxLibrary = [
  { id: "sfx-glass", name: "玻璃碎裂", duration: 1.2, category: "动作" },
  { id: "sfx-footstep", name: "脚步声-木地板", duration: 0.8, category: "动作" },
  { id: "sfx-bell", name: "钟声-教堂", duration: 3.5, category: "环境音" },
  { id: "sfx-door", name: "门吱呀声", duration: 1.5, category: "动作" },
  { id: "sfx-thunder", name: "雷声-远处", duration: 2.8, category: "自然" },
  { id: "sfx-piano", name: "钢琴单音", duration: 1.0, category: "乐器" },
  { id: "sfx-rain", name: "雨声-室内", duration: 5.0, category: "自然" },
  { id: "sfx-heartbeat", name: "心跳声", duration: 2.0, category: "情绪" },
]

export function AudioPanel({
  characters,
  audioTakes,
  selectedItem,
  audioClips,
  onGenerateVoice,
  onDragTake,
  onReplaceSfx,
  onSubmitMusicFeedback,
}: AudioPanelProps) {
  const [activeTab, setActiveTab] = useState<AudioTabType>("voiceover")
  const [selectedCharacter, setSelectedCharacter] = useState<string>(characters[0]?.id ?? "")
  const [dialogueText, setDialogueText] = useState(
    "这里发生了什么？红酒洒满了整个地板，而她就站在那里，一动不动。"
  )
  const [selectedModel, setSelectedModel] = useState("elevenlabs")
  const [selectedLanguage, setSelectedLanguage] = useState("zh-CN")
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null)
  const [sfxSearchQuery, setSfxSearchQuery] = useState("")
  const [musicFeedback, setMusicFeedback] = useState("")

  // Determine which tab should be active based on selected item
  const getSelectedTrackType = (): AudioTabType | null => {
    if (!selectedItem || selectedItem.type !== "audio") return null
    const clip = audioClips.find(c => c.id === selectedItem.id)
    if (!clip) return null
    return clip.type
  }

  const selectedTrackType = getSelectedTrackType()
  const selectedAudioClip = selectedItem?.type === "audio"
    ? audioClips.find(c => c.id === selectedItem.id)
    : null

  const handleGenerate = () => {
    if (!selectedCharacter || !dialogueText.trim()) return
    onGenerateVoice(selectedCharacter, dialogueText, selectedModel, selectedLanguage)
  }

  const togglePlayTake = (takeId: string) => {
    setPlayingTakeId((prev) => (prev === takeId ? null : takeId))
  }

  const filteredSfx = sfxLibrary.filter(sfx =>
    sfx.name.toLowerCase().includes(sfxSearchQuery.toLowerCase()) ||
    sfx.category.toLowerCase().includes(sfxSearchQuery.toLowerCase())
  )

  const selectedCharacterData = characters.find((c) => c.id === selectedCharacter)

  // If no track selected, show empty state
  if (!selectedTrackType) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-r border-border/50 bg-[#121212]">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <div className="mb-3 text-4xl opacity-30">🎵</div>
            <p className="text-sm text-muted-foreground">
              选择时间轴上的音频片段
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              可编辑配音、音效或音乐
            </p>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border/50 bg-[#121212]">
      {/* Tabs - show selected track type */}
      <Tabs value={selectedTrackType} className="flex flex-1 flex-col">
        <TabsList className="mx-3 mt-3 grid h-9 w-auto grid-cols-3 bg-secondary/50">
          <TabsTrigger
            value="voiceover"
            className={cn(
              "gap-1.5 text-xs",
              selectedTrackType === "voiceover" ? "data-[state=active]:bg-card" : "opacity-50 cursor-not-allowed"
            )}
            disabled={selectedTrackType !== "voiceover"}
          >
            <Mic className="h-3.5 w-3.5" />
            配音
          </TabsTrigger>
          <TabsTrigger
            value="sfx"
            className={cn(
              "gap-1.5 text-xs",
              selectedTrackType === "sfx" ? "data-[state=active]:bg-card" : "opacity-50 cursor-not-allowed"
            )}
            disabled={selectedTrackType !== "sfx"}
          >
            <Volume2 className="h-3.5 w-3.5" />
            音效
          </TabsTrigger>
          <TabsTrigger
            value="bgm"
            className={cn(
              "gap-1.5 text-xs",
              selectedTrackType === "bgm" ? "data-[state=active]:bg-card" : "opacity-50 cursor-not-allowed"
            )}
            disabled={selectedTrackType !== "bgm"}
          >
            <Music className="h-3.5 w-3.5" />
            音乐
          </TabsTrigger>
        </TabsList>

        {/* Voiceover Tab */}
        <TabsContent value="voiceover" className="mt-0 flex flex-1 flex-col overflow-hidden p-3 pt-2">
          {/* Selected clip info */}
          {selectedAudioClip && (
            <div className="mb-3 p-2 rounded-lg bg-card/80 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: selectedAudioClip.waveformColor }} />
                <span className="text-xs font-medium">{selectedAudioClip.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedAudioClip.dialogueText}</p>
            </div>
          )}

          {/* Character selector */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">选择角色</label>
            <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
              <SelectTrigger className="h-9 bg-card border-border/50">
                <SelectValue placeholder="选择角色..." />
              </SelectTrigger>
              <SelectContent>
                {characters.map((char) => (
                  <SelectItem key={char.id} value={char.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full"
                        style={{ backgroundColor: char.avatarColor }}
                      />
                      <span>{char.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dialogue text */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">台词文本</label>
            <Textarea
              value={dialogueText}
              onChange={(e) => setDialogueText(e.target.value)}
              placeholder="输入需要生成的台词..."
              className="min-h-[80px] resize-none bg-card border-border/50 text-sm"
            />
          </div>

          {/* Model & Language selectors in row */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">语音模型</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-8 bg-card border-border/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voiceModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">语言/口音</label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="h-8 bg-card border-border/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            className="mb-4 h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Sparkles className="h-4 w-4" />
            AI 生成配音
          </Button>

          {/* Divider */}
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] text-muted-foreground">已生成音频</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* Generated takes list */}
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {audioTakes
              .filter((t) => t.characterId === selectedCharacter || !selectedCharacter)
              .map((take) => {
                const char = characters.find((c) => c.id === take.characterId)
                const isPlaying = playingTakeId === take.id
                return (
                  <div
                    key={take.id}
                    draggable
                    onDragStart={() => onDragTake(take.id)}
                    className="group flex items-center gap-2 rounded-md bg-card/80 p-2 border border-transparent hover:border-border/50 cursor-grab active:cursor-grabbing"
                  >
                    {/* Drag handle */}
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />

                    {/* Play button */}
                    <button
                      onClick={() => togglePlayTake(take.id)}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                        isPlaying ? "bg-emerald-600 text-white" : "bg-secondary hover:bg-secondary/80"
                      )}
                    >
                      {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
                    </button>

                    {/* Take info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {char && (
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: char.avatarColor }}
                          />
                        )}
                        <span className="text-xs font-medium truncate">{char?.name ?? "未知"}</span>
                        <span className="text-[10px] text-muted-foreground">· {take.duration.toFixed(1)}s</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{take.dialogueText}</p>
                    </div>

                    {/* Model badge */}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                      {take.model}
                    </span>
                  </div>
                )
              })}
          </div>
        </TabsContent>

        {/* SFX Tab - search and replace AI-matched */}
        <TabsContent value="sfx" className="mt-0 flex flex-1 flex-col overflow-hidden p-3 pt-2">
          {/* Current selected sfx info */}
          {selectedAudioClip && (
            <div className="mb-3 p-2 rounded-lg bg-emerald-950/30 border border-emerald-700/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-emerald-400">当前匹配音效</span>
                <span className="text-[10px] text-muted-foreground">{selectedAudioClip.duration.toFixed(1)}s</span>
              </div>
              <p className="text-sm text-foreground">{selectedAudioClip.name}</p>
            </div>
          )}

          {/* Search sound effects */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">搜索音效库替换</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={sfxSearchQuery}
                onChange={(e) => setSfxSearchQuery(e.target.value)}
                placeholder="输入关键词搜索..."
                className="w-full h-9 pl-8 pr-3 rounded-md bg-card border border-border/50 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">音效分类</label>
            <div className="grid grid-cols-4 gap-1.5">
              {["全部", "环境音", "动作", "情绪", "自然", "机械", "人声", "乐器"].map((cat) => (
                <button
                  key={cat}
                  className="h-7 rounded bg-card hover:bg-secondary text-[10px] text-muted-foreground hover:text-foreground transition-colors border border-border/30"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredSfx.map((sfx) => (
              <div
                key={sfx.id}
                className="group flex items-center gap-2 rounded-md bg-card/80 p-2 border border-transparent hover:border-emerald-500/30 cursor-pointer"
                onClick={() => onReplaceSfx?.(selectedItem?.id ?? "", sfx.name)}
              >
                <button className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30">
                  <Play className="h-3 w-3 ml-0.5" />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-xs block truncate">{sfx.name}</span>
                  <span className="text-[10px] text-muted-foreground">{sfx.category}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{sfx.duration.toFixed(1)}s</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  替换
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* BGM Tab - feedback text for adjustments */}
        <TabsContent value="bgm" className="mt-0 flex flex-1 flex-col overflow-hidden p-3 pt-2">
          {/* Current selected bgm info */}
          {selectedAudioClip && (
            <div className="mb-3 p-3 rounded-lg bg-purple-950/30 border border-purple-700/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-400">当前配乐</span>
                <span className="text-[10px] text-muted-foreground">{selectedAudioClip.duration.toFixed(1)}s</span>
              </div>
              <p className="text-sm text-foreground mb-2">{selectedAudioClip.name}</p>
              
              {/* Play preview */}
              <div className="flex items-center gap-2">
                <button className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600/30 text-purple-400 hover:bg-purple-600/40">
                  <Play className="h-4 w-4 ml-0.5" />
                </button>
                <div className="flex-1 h-1 bg-purple-900/50 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-purple-500 rounded-full" />
                </div>
              </div>
            </div>
          )}

          {/* Feedback text area for music adjustments */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
              审阅建议
            </label>
            <Textarea
              value={musicFeedback}
              onChange={(e) => setMusicFeedback(e.target.value)}
              placeholder="描述对当前音乐的修改建议，例如：节奏需要更紧凑，高潮部分需要更强烈..."
              className="min-h-[100px] resize-none bg-card border-border/50 text-sm"
            />
          </div>

          {/* Submit feedback button */}
          <Button
            onClick={() => {
              if (musicFeedback.trim() && selectedItem) {
                onSubmitMusicFeedback?.(selectedItem.id, musicFeedback)
                setMusicFeedback("")
              }
            }}
            disabled={!musicFeedback.trim()}
            className="mb-4 h-9 gap-2 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            提交修改建议
          </Button>

          <p className="text-[10px] text-muted-foreground/70 text-center">
            提交后，自动流将根据建议重新调整配乐
          </p>

          {/* Divider */}
          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] text-muted-foreground">或重新生成</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* Style selector for regeneration */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">音乐风格</label>
            <Select defaultValue="suspense">
              <SelectTrigger className="h-9 bg-card border-border/50">
                <SelectValue placeholder="选择风格..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suspense">悬疑/惊悚</SelectItem>
                <SelectItem value="romantic">浪漫/抒情</SelectItem>
                <SelectItem value="action">动作/紧张</SelectItem>
                <SelectItem value="sad">悲伤/忧郁</SelectItem>
                <SelectItem value="happy">欢快/明亮</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="h-9 gap-2 border-purple-700/30 hover:bg-purple-950/50 hover:text-purple-300">
            <RefreshCw className="h-4 w-4" />
            重新生成配乐
          </Button>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
