import { describe, expect, it } from 'vitest'
import { applyMarketFilters } from './service'

describe('applyMarketFilters', () => {
  it('filters markets by minimum edge and category', () => {
    const result = applyMarketFilters(
      [
        { marketId: 'm1', category: 'Crypto', edgeScore: 0.72 },
        { marketId: 'm2', category: 'Politics', edgeScore: 0.53 },
      ],
      { minEdge: 0.6, category: 'Crypto' },
    )

    expect(result).toEqual([
      { marketId: 'm1', category: 'Crypto', edgeScore: 0.72 },
    ])
  })
})
