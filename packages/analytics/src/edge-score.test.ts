import { describe, expect, it } from 'vitest'
import { computeEdgeScore, deriveWalletTags } from './index'

describe('computeEdgeScore', () => {
  it('blends structure, smart-money, and timing scores using the configured weights', () => {
    const result = computeEdgeScore(
      {
        marketStructureScore: 0.8,
        smartMoneyScore: 0.6,
        timingScore: 0.4,
      },
      {
        marketStructure: 0.4,
        smartMoney: 0.4,
        timing: 0.2,
      },
    )

    expect(result.edgeScore).toBeCloseTo(0.64, 6)
  })
})

describe('deriveWalletTags', () => {
  it('assigns specialist and conviction tags from wallet metrics', () => {
    expect(
      deriveWalletTags({
        averagePositionSize: 18000,
        winRate: 0.71,
        topCategory: 'Politics',
        categoryConcentration: 0.83,
        averageHoldingHours: 8,
      }),
    ).toEqual(expect.arrayContaining(['high-conviction', 'event-specialist']))
  })
})
