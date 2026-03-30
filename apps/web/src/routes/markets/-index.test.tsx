import { describe, expect, it, vi } from 'vitest'

vi.mock('../../features/freshness/server', () => ({
  getDashboardFreshness: vi.fn(async () => ({
    label: 'fallback',
    message: 'Using fallback seed data because live bootstrap failed.',
  })),
}))

vi.mock('../../features/markets/server', () => ({
  getMarketLeaderboard: vi.fn(async () => [
    {
      marketId: 'market-1',
      slug: 'market-1',
      question: 'Will the market test pass?',
      category: null,
      volume: 1000,
      edgeScore: 1.23,
      timingScore: 0.45,
      tags: [],
    },
  ]),
}))

import { loadMarketRouteData } from '../../features/route-loaders'

describe('markets route loader', () => {
  it('loads freshness with the leaderboard rows', async () => {
    const data = await loadMarketRouteData()

    expect(data).toMatchObject({
      freshness: {
        label: 'fallback',
        message: 'Using fallback seed data because live bootstrap failed.',
      },
    })
    expect(data?.rows).toHaveLength(1)
    expect(data?.rows[0]?.freshness).toBe('degraded')
  })
})
