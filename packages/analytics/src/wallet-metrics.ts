export interface WalletMetricInput {
  realizedPnl: number
  unrealizedPnl: number
  closedPositions: Array<{
    won: boolean
    size: number
    holdHours?: number | null
    category?: string | null
  }>
}

export function summarizeWalletMetrics(input: WalletMetricInput) {
  const wins = input.closedPositions.filter((position) => position.won).length
  const holdHours = input.closedPositions
    .map((position) => position.holdHours)
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0,
    )
  const averagePositionSize =
    input.closedPositions.reduce((sum, position) => sum + position.size, 0) /
    Math.max(input.closedPositions.length, 1)
  const averageHoldingHours =
    holdHours.length === 0
      ? Number.POSITIVE_INFINITY
      : holdHours.reduce((sum, value) => sum + value, 0) / holdHours.length

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
  const categorizedPositions = input.closedPositions.filter(
    (position) => position.category !== undefined && position.category !== null,
  ).length

  return {
    averageHoldingHours,
    averagePositionSize,
    categoryConcentration:
      categorizedPositions === 0 ? 0 : categoryCount / categorizedPositions,
    realizedPnl: input.realizedPnl,
    topCategory,
    totalPnl: input.realizedPnl + input.unrealizedPnl,
    unrealizedPnl: input.unrealizedPnl,
    winRate: wins / Math.max(input.closedPositions.length, 1),
  }
}
