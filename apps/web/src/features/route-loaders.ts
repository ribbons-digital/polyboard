import { getDashboardFreshness } from './freshness/server'
import { getMarketLeaderboard } from './markets/server'
import { getWalletLeaderboard } from './wallets/server'

export async function loadDashboardRouteData() {
  const [freshness, markets, wallets] = await Promise.all([
    getDashboardFreshness(),
    getMarketLeaderboard({ data: { minEdge: 0.2 } }),
    getWalletLeaderboard(),
  ])

  return {
    freshness,
    markets: markets.map((row) => ({
      ...row,
      freshness: 'fresh' as const,
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
    rows,
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
