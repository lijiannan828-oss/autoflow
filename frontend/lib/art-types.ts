// Art Assets Review Types (Step 1)

export interface Character {
  id: string
  name: string
  description: string
  prompt: string
  images: CharacterImage[]
  lockedImageId: string | null
}

export interface CharacterImage {
  id: string
  thumbnailColor: string
  prompt: string
  score: number
  isLocked: boolean
}

export interface Scene {
  id: string
  name: string
  description: string
  prompt: string
  images: SceneImage[]
  lockedImageId: string | null
}

export interface SceneImage {
  id: string
  thumbnailColor: string
  prompt: string
  score: number
  isLocked: boolean
}

export interface Prop {
  id: string
  name: string
  description: string
  prompt: string
  images: PropImage[]
  lockedImageId: string | null
}

export interface PropImage {
  id: string
  thumbnailColor: string
  prompt: string
  score: number
  isLocked: boolean
}

export interface ScriptHighlight {
  id: string
  title: string
  content: string
}

export interface ArtStyle {
  id: string
  baseStyle: string
  visualDescription: string
  isLocked: boolean
}

export interface ArtAssetsData {
  projectName: string
  scriptSummary: string
  highlights: ScriptHighlight[]
  artStyle: ArtStyle
  characters: Character[]
  scenes: Scene[]
  props: Prop[]
}

export interface AssetReviewSummary {
  total: number
  approved: number
  pending: number
}

export function getAssetReviewSummary(data: ArtAssetsData): AssetReviewSummary {
  const characters = data.characters.filter(c => c.lockedImageId).length
  const scenes = data.scenes.filter(s => s.lockedImageId).length
  const props = data.props.filter(p => p.lockedImageId).length
  const approved = characters + scenes + props
  const total = data.characters.length + data.scenes.length + data.props.length
  
  return {
    total,
    approved,
    pending: total - approved,
  }
}

// Navigation sections for scroll-based navigation
export type ArtSection = "highlights" | "style" | "characters" | "scenes" | "props"

export const artSections: { id: ArtSection; label: string }[] = [
  { id: "highlights", label: "剧本亮点提炼" },
  { id: "style", label: "影调与氛围" },
  { id: "characters", label: "核心人物" },
  { id: "scenes", label: "核心场景" },
  { id: "props", label: "核心道具" },
]
