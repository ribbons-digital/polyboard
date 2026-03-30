import { getDashboardFreshness } from './freshness/server'
import { getMarketLeaderboard } from './markets/server'
import type { FreshnessSummary } from './freshness/service'
import { getWalletLeaderboard } from './wallets/server'

function toMarketFreshness(label: FreshnessSummary['label']) {
  switch (label) {
    case 'fallback':
      return 'degraded' as const
    case 'degraded':
      return 'stale' as const
    case 'live':
      return 'fresh' as const
  }
}

export async function loadDashboardRouteData() {
  const [freshness, markets, wallets] = await Promise.all([
    getDashboardFreshness(),
    getMarketLeaderboard({ data: { limit: 5, minEdge: 0.2 } }),
    getWalletLeaderboard({ data: { limit: 5 } }),
  ])

  return {
    freshness,
    markets: markets.map((row) => ({
      ...row,
      freshness: toMarketFreshness(freshness.label),
    })),
    wallets,
  }
}

export async function loadMarketRouteData() {
  const [freshness, rows] = await Promise.all([
    getDashboardFreshness(),
    getMarketLeaderboard({ data: { minEdge: 0.2 } }),
  ])

  return {
    freshness,
    rows: rows.map((row) => ({
      ...row,
      freshness: toMarketFreshness(freshness.label),
    })),
  }
}

export async function loadWalletRouteData() {
  const [freshness, rows] = await Promise.all([
    getDashboardFreshness(),
    getWalletLeaderboard(),
  ])

  return {
    freshness,
    rows,
  }
}
