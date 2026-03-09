export function getScoreColor(score: number): string {
  if (score >= 8) return "text-score-green"
  if (score >= 6) return "text-score-yellow"
  return "text-score-red"
}

export function getScoreBg(score: number): string {
  if (score >= 8) return "bg-score-green"
  if (score >= 6) return "bg-score-yellow"
  return "bg-score-red"
}

export function getScoreHex(score: number): string {
  if (score >= 8) return "#10B981"
  if (score >= 6) return "#F59E0B"
  return "#EF4444"
}

export function averageScore(scores: { score: number }[]): number {
  if (scores.length === 0) return 0
  return +(scores.reduce((s, m) => s + m.score, 0) / scores.length).toFixed(1)
}
