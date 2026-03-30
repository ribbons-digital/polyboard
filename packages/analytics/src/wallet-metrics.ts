export interface WalletMetricInput {
  realizedPnl: number
  unrealizedPnl: number
  closedPositions: Array<{
    won: boolean
    size: number
    holdHours: number
    category?: string | null
  }>
}

export function summarizeWalletMetrics(input: WalletMetricInput) {
  const wins = input.closedPositions.filter((position) => position.won).length
  const averagePositionSize =
    input.closedPositions.reduce((sum, position) => sum + position.size, 0) /
    Math.max(input.closedPositions.length, 1)
  const averageHoldingHours =
    input.closedPositions.reduce(
      (sum, position) => sum + position.holdHours,
      0,
    ) / Math.max(input.closedPositions.length, 1)

  const categoryCounts = new Map<string, number>()

  for (const position of input.closedPositions) {
    if (!position.category) {
      continue
    }

    categoryCounts.set(
      position.category,
      (categoryCounts.get(position.category) ?? 0) + 1,
    )
  }

  const [topCategory = 'General', categoryCount = 0] =
    [...categoryCounts.entries()].sort((left, right) => right[1] - left[1])[0] ??
    []

  return {
    averageHoldingHours,
    averagePositionSize,
    categoryConcentration:
      categoryCount / Math.max(input.closedPositions.length, 1),
    realizedPnl: input.realizedPnl,
    topCategory,
    totalPnl: input.realizedPnl + input.unrealizedPnl,
    unrealizedPnl: input.unrealizedPnl,
    winRate: wins / Math.max(input.closedPositions.length, 1),
  }
}
