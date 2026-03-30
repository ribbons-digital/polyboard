export interface ScoreInputs {
  marketStructureScore: number
  smartMoneyScore: number
  timingScore: number
}

export interface ScoreWeights {
  marketStructure: number
  smartMoney: number
  timing: number
}

export function computeEdgeScore(input: ScoreInputs, weights: ScoreWeights) {
  const edgeScore =
    input.marketStructureScore * weights.marketStructure +
    input.smartMoneyScore * weights.smartMoney +
    input.timingScore * weights.timing

  return {
    ...input,
    edgeScore,
    reasons: [
      {
        label: 'market-structure',
        value: input.marketStructureScore,
      },
      {
        label: 'smart-money',
        value: input.smartMoneyScore,
      },
      {
        label: 'timing',
        value: input.timingScore,
      },
    ],
  }
}
