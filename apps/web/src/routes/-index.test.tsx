import { describe, expect, it, vi } from 'vitest'

vi.mock('../features/freshness/server', () => ({
  getDashboardFreshness: vi.fn(async () => ({
    label: 'live',
    message: 'Live Polymarket data is flowing through the worker.',
  })),
}))

vi.mock('../features/markets/server', () => ({
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

vi.mock('../features/wallets/server', () => ({
  getWalletLeaderboard: vi.fn(async () => [
    {
      address: '0xwallet',
      displayName: null,
      verified: false,
      totalPnl: 250,
      winRate: 0.6,
      averagePositionSize: 25,
      tags: [],
      completeness: 'complete',
    },
  ]),
}))

import { loadDashboardRouteData } from '../features/route-loaders'

describe('dashboard route loader', () => {
  it('loads freshness alongside dashboard data', async () => {
    const data = await loadDashboardRouteData()

    expect(data).toMatchObject({
      freshness: {
        label: 'live',
        message: 'Live Polymarket data is flowing through the worker.',
      },
    })
    expect(data?.markets).toHaveLength(1)
    expect(data?.wallets).toHaveLength(1)
  })
})
