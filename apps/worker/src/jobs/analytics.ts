import { computeEdgeScore } from '@polyboard/analytics'

export interface RecomputeMarketScoresDeps {
  settings: {
    scoreWeights: {
      marketStructure: number
      smartMoney: number
      timing: number
    }
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

  for (const signal of signals) {
    const score = computeEdgeScore(signal, deps.settings.scoreWeights)

    await deps.marketRepo.upsertScore({
      ...score,
      marketId: signal.marketId,
    })
  }
}
