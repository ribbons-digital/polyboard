import { describe, expect, it, vi } from 'vitest'
import {
  defaultScoreWeights,
  normalizeScoreWeights,
  recomputeMarketScores,
} from './analytics'

describe('normalizeScoreWeights', () => {
  it('falls back to defaults for invalid numeric values', () => {
    expect(
      normalizeScoreWeights({
        marketStructure: Number.NaN,
        smartMoney: Number.POSITIVE_INFINITY,
        timing: -0.25,
      }),
    ).toEqual(defaultScoreWeights)
  })
})

describe('recomputeMarketScores', () => {
  it('marks market scores live after a successful recompute run', async () => {
    const updateFreshness = vi.fn(async () => undefined)
    const upsertScore = vi.fn(async () => undefined)

    await recomputeMarketScores({
      freshnessRepo: {
        updateFreshness,
      },
      marketRepo: {
        listSignalInputs: async () => [
          {
            edgeScore: 0.72,
            marketId: 'm1',
            marketStructureScore: 0.8,
            smartMoneyScore: 0.65,
            timingScore: 0.71,
          },
        ],
        upsertScore,
      },
      settings: {
        scoreWeights: {},
      },
    })

    expect(upsertScore).toHaveBeenCalledTimes(1)
    expect(updateFreshness).toHaveBeenCalledWith('scores:markets', 'live')
  })
})
