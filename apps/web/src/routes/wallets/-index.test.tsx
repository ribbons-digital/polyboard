import { describe, expect, it, vi } from 'vitest'

vi.mock('../../features/freshness/server', () => ({
  getDashboardFreshness: vi.fn(async () => ({
    label: 'degraded',
    message: 'Some live sources are stale or unavailable.',
  })),
}))

vi.mock('../../features/wallets/server', () => ({
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

import { loadWalletRouteData } from '../../features/route-loaders'

describe('wallets route loader', () => {
  it('loads freshness with the leaderboard rows', async () => {
    const data = await loadWalletRouteData()

    expect(data).toMatchObject({
      freshness: {
        label: 'degraded',
        message: 'Some live sources are stale or unavailable.',
      },
    })
    expect(data?.rows).toHaveLength(1)
  })
})
