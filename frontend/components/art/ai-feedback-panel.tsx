"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface AIFeedbackPanelProps {
  selectedAssetName: string | null
  selectedAssetType: "style" | "character" | "scene" | "prop" | null
  onSubmitFeedback: (feedback: string) => void
  isGenerating: boolean
}

export function AIFeedbackPanel({
  selectedAssetName,
  selectedAssetType,
  onSubmitFeedback,
  isGenerating,
}: AIFeedbackPanelProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是美术资产助手。选择左侧任意资产后，可以在这里用自然语言描述你想要的修改，我会自动调整提示词并重新生成。",
      timestamp: new Date(),
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

  const getTypeLabel = (type: "style" | "character" | "scene" | "prop" | null) => {
    switch (type) {
      case "style": return "风格"
      case "character": return "人物"
      case "scene": return "场景"
      case "prop": return "道具"
      default: return ""
    }
  }

  const handleSubmit = () => {
    if (!input.trim() || isGenerating) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    onSubmitFeedback(input)
    setInput("")

    // Simulate assistant response after a delay
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `已收到你的修改建议："${input.slice(0, 30)}${input.length > 30 ? '...' : ''}"。正在重新生成4张候选图...`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    }, 500)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <aside className="w-72 shrink-0 border-l border-border/40 bg-sidebar flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {selectedAssetName
              ? `${selectedAssetName} - 全局调整`
              : "AI 美术助手"
            }
          </h3>
        </div>
        {selectedAssetType && (
          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            {getTypeLabel(selectedAssetType)}
          </span>
        )}
      </div>

      {/* Chat messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground"
                )}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User className="h-3 w-3 text-foreground" />
                </div>
              )}
            </div>
          ))}

          {isGenerating && (
            <div className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <RefreshCw className="h-3 w-3 text-primary animate-spin" />
              </div>
              <div className="bg-card rounded-lg px-3 py-2 text-xs text-muted-foreground">
                正在生成新的候选图...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-border/40">
        {selectedAssetName ? (
          <div className="space-y-2">
            <Textarea
              placeholder={`描述你对"${selectedAssetName}"的修改建议...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              className="min-h-[60px] text-xs resize-none bg-card border-border/50"
            />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">
                按 Enter 发送
              </span>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleSubmit}
                disabled={!input.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                发送
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-4">
            请先选择一个资产进行调整
          </div>
        )}
      </div>
    </aside>
  )
}
