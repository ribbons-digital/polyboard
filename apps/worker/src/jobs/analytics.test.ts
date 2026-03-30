import { describe, expect, it } from 'vitest'
import { defaultScoreWeights, normalizeScoreWeights } from './analytics'

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
