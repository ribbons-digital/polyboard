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

  return {
    marketStructure:
      typeof record.marketStructure === 'number'
        ? record.marketStructure
        : defaultScoreWeights.marketStructure,
    smartMoney:
      typeof record.smartMoney === 'number'
        ? record.smartMoney
        : defaultScoreWeights.smartMoney,
    timing:
      typeof record.timing === 'number'
        ? record.timing
        : defaultScoreWeights.timing,
  }
}

export interface RecomputeMarketScoresDeps {
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
}
