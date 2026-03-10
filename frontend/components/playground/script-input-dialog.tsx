"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { FileText, Upload, Sparkles } from "lucide-react"

interface ScriptInputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (script: string) => void
}

const SAMPLE_SCRIPT = `【第一集：命运的相遇】

场景一：繁华都市街头，黄昏

林晓（28岁，职场精英，穿着干练的职业套装）匆忙走在下班人潮中，手机响起。

林晓：（接电话）妈，我今天加班，不回去吃饭了...

突然，一个男子从她身边跑过，撞掉了她的手机。

林晓：喂！你怎么...

男子（张伟，30岁，穿着休闲但略显狼狈）回头看了一眼，眼神中带着歉意和紧迫。

张伟：对不起！（继续跑）

身后传来追赶的脚步声，几个黑衣人紧随其后。

林晓捡起手机，愣在原地，目送这一切发生。

---

场景二：公司大楼，次日清晨

林晓走进电梯，意外发现张伟也在里面，穿着西装，完全换了一个人。

林晓：是你？

张伟：（惊讶，随即恢复镇定）你认错人了。

电梯门打开，是同一层。两人面面相觑。

林晓：你也在这家公司？

张伟：从今天开始，我是新来的项目经理。

林晓：（震惊）什么？我是这个项目的负责人。

两人对视，气氛微妙。

【第一集完】`

export function ScriptInputDialog({ open, onOpenChange, onSubmit }: ScriptInputDialogProps) {
  const [script, setScript] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!script.trim()) return
    setIsLoading(true)
    // Simulate some processing delay
    await new Promise((r) => setTimeout(r, 500))
    onSubmit(script)
    setIsLoading(false)
  }

  const loadSample = () => {
    setScript(SAMPLE_SCRIPT)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            输入剧本
          </DialogTitle>
          <DialogDescription>
            输入完整剧本文本，系统将自动解析并启动 26 节点流水线处理
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4">
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="script">剧本内容</Label>
            <Button variant="ghost" size="sm" onClick={loadSample} className="h-7 text-xs gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              加载示例
            </Button>
          </div>
          <Textarea
            id="script"
            placeholder="在此粘贴或输入剧本内容..."
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="h-[300px] resize-none font-mono text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-2">
            支持格式：纯文本、Markdown、Fountain 剧本格式 · 建议长度：5-10 万字
          </p>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex-1 text-xs text-muted-foreground">
            {script.length > 0 && (
              <span>已输入 {script.length.toLocaleString()} 字符</span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!script.trim() || isLoading} className="gap-2">
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                开始处理
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
