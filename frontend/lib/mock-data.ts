import type { Episode, EpisodeData, Shot, AlternateShot, ModelScore, GachaResult, GachaGroup } from "./types"

// ===== Episodes list with statuses - expanded to 30 for summary display =====
export const episodes: Episode[] = [
  { id: "ep-1", title: "第1集 游戏开始", shotCount: 8, status: "in-progress" },
  { id: "ep-2", title: "第2集 暗流涌动", shotCount: 10, status: "in-progress" },
  { id: "ep-3", title: "第3集 真相浮现", shotCount: 7, status: "approved" },
  { id: "ep-4", title: "第4集 命运抉择", shotCount: 9, status: "approved" },
  { id: "ep-5", title: "第5集 最终章", shotCount: 6, status: "approved" },
  { id: "ep-6", title: "第6集 新的开始", shotCount: 8, status: "approved" },
  { id: "ep-7", title: "第7集 暗夜追踪", shotCount: 9, status: "approved" },
  { id: "ep-8", title: "第8集 迷雾重重", shotCount: 7, status: "pending" },
  { id: "ep-9", title: "第9集 意外发现", shotCount: 8, status: "pending" },
  { id: "ep-10", title: "第10集 秘密通道", shotCount: 10, status: "pending" },
  { id: "ep-11", title: "第11集 双重身份", shotCount: 8, status: "pending" },
  { id: "ep-12", title: "第12集 背叛者", shotCount: 9, status: "pending" },
  { id: "ep-13", title: "第13集 证据链", shotCount: 7, status: "pending" },
  { id: "ep-14", title: "第14集 对峙", shotCount: 8, status: "pending" },
  { id: "ep-15", title: "第15集 回忆杀", shotCount: 10, status: "pending" },
  { id: "ep-16", title: "第16集 转折点", shotCount: 9, status: "pending" },
  { id: "ep-17", title: "第17集 真相大白", shotCount: 8, status: "pending" },
  { id: "ep-18", title: "第18集 最后一搏", shotCount: 7, status: "pending" },
  { id: "ep-19", title: "第19集 黎明前夜", shotCount: 9, status: "pending" },
  { id: "ep-20", title: "第20集 终局之战", shotCount: 10, status: "pending" },
  { id: "ep-21", title: "第21集 新线索", shotCount: 8, status: "pending" },
  { id: "ep-22", title: "第22集 潜入计划", shotCount: 9, status: "pending" },
  { id: "ep-23", title: "第23集 危机四伏", shotCount: 7, status: "pending" },
  { id: "ep-24", title: "第24集 反击开始", shotCount: 8, status: "pending" },
  { id: "ep-25", title: "第25集 内鬼", shotCount: 10, status: "pending" },
  { id: "ep-26", title: "第26集 逃出生天", shotCount: 9, status: "pending" },
  { id: "ep-27", title: "第27集 最后的线索", shotCount: 8, status: "pending" },
  { id: "ep-28", title: "第28集 揭露真相", shotCount: 7, status: "pending" },
  { id: "ep-29", title: "第29集 正义降临", shotCount: 9, status: "pending" },
  { id: "ep-30", title: "第30集 大结局", shotCount: 12, status: "pending" },
]

const shotColors = [
  "#8B6F47", "#5C6B73", "#A45A52", "#6B8F71",
  "#7B6B8D", "#8C7853", "#4A6670", "#9B7653",
]

const gachaColors = [
  "#7A5F3A", "#5B6A72", "#9A4A4A", "#5A7E60",
  "#6B5A7C", "#7B6742", "#3B5560", "#8A6542",
  "#6A8B5B", "#8B5B6A", "#5A7B8B", "#9B6B4A",
]

const imagePrompts = [
  "[画风：写实][近景俯视视角][蒙哥马利宴会大厅]\n灯光聚焦在凌乱的地板上，[克莱尔-女仆装]（深灰色连衣裙，白色围裙）跪在地上，双手沾满红酒渍",
  "[画风：写实][中景平视][蒙哥马利书房]\n昏暗的台灯投下暖黄色光线，[维克多-管家装]站在书架前，手持一封泛黄的信件",
  "[画风：写实][全景][蒙哥马利庄园外景-夜]\n月光洒在哥特式建筑上，远处传来钟声，一个模糊的身影穿过花园",
  "[画风：写实][特写][蒙哥马利餐厅]\n精致的银质餐具反射着烛光，一只戴着红宝石戒指的手轻轻拿起酒杯",
  "[画风：写实][中景仰视][蒙哥马利楼梯间]\n旋转楼梯的光影交错，[伊莎贝拉-晚礼服]缓步走下楼梯，裙摆拖曳",
  "[画风：写实][近景][蒙哥马利客厅-壁炉旁]\n火焰映照下的面容半明半暗，[詹姆斯-西装]凝视着壁炉中跳动的火苗",
  "[画风：写实][全景俯拍][蒙哥马利宴会大厅]\n宾客们在灯火辉煌的大厅中交谈，水晶吊灯投下万千光点",
  "[画风：写实][中景跟拍][蒙哥马利走廊]\n长长的走廊尽头，一扇门微微打开，光线从门缝中泄出",
]

const videoPrompts = [
  "镜头缓慢推近。红酒在灰色布料上持续扩散，颜色由鲜红变为暗红。灰裙女仆撑在地上的手指因用力而微微颤抖",
  "摇镜头从左至右。管家的手指沿着信件边缘滑动，信纸上的墨迹因年代久远而褪色。背景书架上的古籍微微晃动",
  "航拍缓慢下降。月光穿过乌云的间隙，庄园外墙上的藤蔓在微风中轻轻摇曳，身影在花丛间若隐若现",
  "固定机位微推。烛光在银器表面流动，戒指上的红宝石折射出深红色光芒，酒杯中的红酒微微晃动",
  "斜角升起。楼梯扶手上的木纹在灯光下清晰可见，晚礼服的丝绸面料随步伐产生流动的光泽",
  "固定近景。火焰的倒影在瞳孔中跳动，面部肌肉微微抽搐，壁炉中的木柴发出轻微的噼啪声",
  "缓慢俯拍环绕。宾客的珠宝在灯光下闪烁，酒杯碰撞的瞬间，香槟气泡腾升",
  "稳定器跟拍。走廊中的脚步声由远及近，墙上的老照片在晃动的光影中若隐若现",
]

const cameraMovements = [
  "推镜头 - 缓慢推近", "摇镜头 - 从左至右", "航拍 - 缓慢下降", "固定 - 微推",
  "斜角 - 升起", "固定 - 近景", "俯拍 - 环绕", "稳定器 - 跟拍",
]

const shotTags = [
  ["悬疑", "室内", "近景"], ["叙事", "书房", "中景"],
  ["外景", "夜戏", "氛围"], ["特写", "道具", "细节"],
  ["人物", "楼梯", "仪式感"], ["人物", "壁炉", "情绪"],
  ["群戏", "大场景", "华丽"], ["悬疑", "走廊", "紧张"],
]

const shotSuggestions: string[][] = [
  ["尾部画面停滞，建议裁切最后0.5秒"],
  [],
  ["月光过曝，建议降低亮度10%"],
  [],
  ["裙摆运动模糊稍重，可适当提高快门速度"],
  [],
  ["远处宾客面部清晰度不足"],
  ["走廊光线偏暗，建议提亮15%"],
]

const models = ["Seko", "Luma", "Kling", "Pika"]

function generateScores(base: number): ModelScore[] {
  return [
    { model: "Gemini", score: Math.min(10, Math.max(1, +(base + (Math.random() * 0.8 - 0.4)).toFixed(1))), comment: "画面质量优秀，构图合理" },
    { model: "GPT-4V", score: Math.min(10, Math.max(1, +(base + (Math.random() * 0.6 - 0.3)).toFixed(1))), comment: "色彩还原度高，曝光准确" },
    { model: "Claude", score: Math.min(10, Math.max(1, +(base + (Math.random() * 0.6 - 0.3)).toFixed(1))), comment: "运动流畅，无明显瑕疵" },
  ]
}

// Base scores for each shot (will cycle for more shots)
const baseScores = [8.7, 9.1, 7.8, 8.4, 9.4, 7.2, 8.9, 8.1]
// Shot durations that sum to ~87s for 32 shots
const baseDurations = [3.5, 2.5, 4, 2, 3, 2.5, 3.5, 2, 3, 2.5, 2, 3.5, 2.5, 3, 2, 2.5]

// Create grouped gacha results for a shot
function makeGachaGroups(shotIndex: number): { groups: GachaGroup[]; stats: { keyframeCount: number; videoCount: number } } {
  const groupCount = 2 + (shotIndex % 2) // 2-3 groups per shot
  const groups: GachaGroup[] = []
  let totalKeyframes = 0
  let totalVideos = 0

  for (let g = 0; g < groupCount; g++) {
    const keyframeScore = +(baseScores[shotIndex] + (Math.random() * 1.5 - 0.5)).toFixed(1)
    const keyframe: GachaResult = {
      id: `gacha-${shotIndex}-kf-${g}`,
      type: "image",
      thumbnailColor: gachaColors[(shotIndex * 3 + g) % gachaColors.length],
      label: `关键帧 ${g + 1}`,
      prompt: imagePrompts[shotIndex],
      model: models[g % models.length],
      score: Math.min(10, Math.max(1, keyframeScore)),
      comment: keyframeScore >= 8 ? "质量优秀" : keyframeScore >= 6 ? "质量良好" : "存在瑕疵",
      createdAt: new Date(Date.now() - (groupCount - g) * 1800000).toISOString(),
      isSelected: g === 0, // first group's keyframe is selected by default
    }
    totalKeyframes++

    const videoCount = 2 + (g % 2) // 2-3 videos per keyframe
    const videos: GachaResult[] = []
    for (let v = 0; v < videoCount; v++) {
      const videoScore = +(baseScores[shotIndex] + (Math.random() * 2 - 1)).toFixed(1)
      videos.push({
        id: `gacha-${shotIndex}-v-${g}-${v}`,
        type: "video",
        thumbnailColor: gachaColors[(shotIndex * 3 + g + v + 1) % gachaColors.length],
        label: `视频 ${g + 1}-${v + 1}`,
        prompt: videoPrompts[shotIndex],
        model: models[(g + v) % models.length],
        score: Math.min(10, Math.max(1, videoScore)),
        comment: videoScore >= 8 ? "质量优秀" : videoScore >= 6 ? "质量良好" : "存在瑕疵",
        createdAt: new Date(Date.now() - (groupCount - g) * 1800000 + v * 300000).toISOString(),
        isSelected: g === 0 && v === 0, // first video of first group is selected
      })
      totalVideos++
    }
    // Sort videos by score descending
    videos.sort((a, b) => b.score - a.score)

    groups.push({
      id: `group-${shotIndex}-${g}`,
      keyframe,
      videos,
      isSelected: g === 0, // first group is selected by default
    })
  }

  // Sort groups by keyframe score descending
  groups.sort((a, b) => b.keyframe.score - a.keyframe.score)

  return { groups, stats: { keyframeCount: totalKeyframes, videoCount: totalVideos } }
}

function makeAlternates(i: number): AlternateShot[] {
  const count = 2 + (i % 2)
  return Array.from({ length: count }, (_, j) => ({
    id: `alt-${i}-${j}`,
    thumbnailColor: gachaColors[(i + j) % gachaColors.length],
    label: `备选${j + 1}`,
    scores: generateScores(baseScores[i] - 0.3),
  }))
}

function makeShots(): Shot[] {
  let startTime = 0
  const shotCount = 32
  return Array.from({ length: shotCount }, (_, i) => {
    const dur = baseDurations[i % baseDurations.length]
    const colorIdx = i % shotColors.length
    const promptIdx = i % imagePrompts.length
    const { groups, stats } = makeGachaGroups(i)
    
    // Determine status: 5 approved, 6 generating/rejected, rest pending
    let status: "pending" | "approved" | "rejected" | "generating" = "pending"
    if (i < 5) status = "approved"
    else if (i >= 5 && i < 11) status = i % 2 === 0 ? "generating" : "rejected"
    
    const shot: Shot = {
      id: `shot-${i + 1}`,
      index: i + 1,
      label: `分镜${i + 1}`,
      thumbnailColor: shotColors[colorIdx],
      estimatedDuration: dur,
      inPoint: 0,
      outPoint: dur,
      startTime,
      imagePrompt: imagePrompts[promptIdx],
      videoPrompt: videoPrompts[promptIdx],
      referenceImageColor: shotColors[colorIdx],
      cameraMovement: cameraMovements[promptIdx],
      tags: shotTags[promptIdx],
      scores: generateScores(baseScores[i % baseScores.length]),
      suggestions: shotSuggestions[promptIdx],
      alternates: makeAlternates(i),
      gachaGroups: groups,
      gachaStats: stats,
      status,
    }
    startTime += dur
    return shot
  })
}

// Calculate total duration for 32 shots
const allDurations = Array.from({ length: 32 }, (_, i) => baseDurations[i % baseDurations.length])
const totalShotDuration = allDurations.reduce((a, b) => a + b, 0)

export const currentEpisodeData: EpisodeData = {
  episodeId: "ep-1",
  episodeTitle: "第1集 游戏开始",
  projectName: "万斯家的回响：游戏开始",
  shots: makeShots(),
  totalDuration: totalShotDuration,
  fps: 25,
  currentStep: "visual-material",
  completedSteps: ["art-assets"],
}
