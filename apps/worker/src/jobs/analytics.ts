import { computeEdgeScore } from '@polyboard/analytics'

export const defaultScoreWeights = {
  marketStructure: 0.4,
  smartMoney: 0.4,
  timing: 0.2,
} as const

export function normalizeScoreWeights(value: unknown) {
  const record =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  const normalizeWeight = (input: unknown, fallback: number) =>
    typeof input === 'number' && Number.isFinite(input) && input >= 0
      ? input
      : fallback

  return {
    marketStructure: normalizeWeight(
      record.marketStructure,
      defaultScoreWeights.marketStructure,
    ),
    smartMoney: normalizeWeight(
      record.smartMoney,
      defaultScoreWeights.smartMoney,
    ),
    timing: normalizeWeight(record.timing, defaultScoreWeights.timing),
  }
}

export interface RecomputeMarketScoresDeps {
  freshnessRepo?: {
    updateFreshness(
      sourceKey: string,
      status: 'live' | 'degraded' | 'fallback',
    ): Promise<void>
  }
  settings: {
    scoreWeights: unknown
  }
  marketRepo: {
    listSignalInputs: () => Promise<
      Array<{
        marketId: string
        marketStructureScore: number
        smartMoneyScore: number
        timingScore: number
      }>
    >
    upsertScore: (input: {
      marketId: string
      marketStructureScore: number
      smartMoneyScore: number
      timingScore: number
      edgeScore: number
      reasons: Array<{ label: string; value: number }>
    }) => Promise<void>
  }
}

export async function recomputeMarketScores(
  deps: RecomputeMarketScoresDeps,
) {
  const signals = await deps.marketRepo.listSignalInputs()
  const scoreWeights = normalizeScoreWeights(deps.settings.scoreWeights)

  for (const signal of signals) {
    const score = computeEdgeScore(signal, scoreWeights)

    await deps.marketRepo.upsertScore({
      ...score,
      marketId: signal.marketId,
    })
  }

  await deps.freshnessRepo?.updateFreshness('scores:markets', 'live')
}
