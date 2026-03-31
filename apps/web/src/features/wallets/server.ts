import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { listWalletLeaderboard, getWalletScores } from './service'
import {
  fetchWalletPositions,
  fetchWalletTrades,
  fetchWalletSummary,
} from './live-api'

export const getWalletLeaderboard = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().positive().max(100).optional(),
      })
      .optional()
      .parse(input),
  )
  .handler(({ data }) => listWalletLeaderboard(data))

export const getWalletById = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ address: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const [positions, trades, summary, scores] = await Promise.all([
      fetchWalletPositions(data.address).catch(() => []),
      fetchWalletTrades(data.address).catch(() => []),
      fetchWalletSummary(data.address).catch(() => null),
      getWalletScores(data.address).catch(() => null),
    ])

    return {
      address: data.address,
      positions: positions.slice(0, 50),
      recentTrades: trades.slice(0, 20),
      summary,
      scores,
    }
  })
