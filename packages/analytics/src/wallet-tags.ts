export function deriveWalletTags(input: {
  averagePositionSize: number
  winRate: number
  topCategory: string
  categoryConcentration: number
  averageHoldingHours: number
}) {
  const tags: string[] = []

  if (input.averagePositionSize >= 10_000) {
    tags.push('high-conviction')
  }

  if (input.categoryConcentration >= 0.7) {
    tags.push('event-specialist')
  }

  if (input.averageHoldingHours <= 12) {
    tags.push('fast-flipper')
  }

  if (input.winRate >= 0.65 && input.averagePositionSize < 5_000) {
    tags.push('high-winrate-low-size')
  }

  if (input.topCategory.toLowerCase() === 'politics') {
    tags.push('election-heavy')
  }

  return tags
}
