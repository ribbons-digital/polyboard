import { parseDatabaseEnv } from '@polyboard/db'
import { z, type RefinementCtx } from 'zod'

const OptionalUrlString = z
  .string()
  .min(1)
  .superRefine((value: string, ctx: RefinementCtx) => {
    try {
      new URL(value)
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected a valid URL',
      })
    }
  })

const WorkerEnvSchema = z.object({
  POLYBOARD_DISCOVERY_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  POLYBOARD_DATA_URL: OptionalUrlString.default(
    'https://data-api.polymarket.com',
  ),
  POLYBOARD_WS_URL: OptionalUrlString.default(
    'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  ),
  POLYBOARD_GAMMA_URL: OptionalUrlString.default(
    'https://gamma-api.polymarket.com',
  ),
  POLYBOARD_SCORE_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  POLYBOARD_WALLET_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(900_000),
})

export interface WorkerEnv {
  discoveryIntervalMs: number
  databaseUrl: string
  minMarketVolume: number
  backfillBatchSize: number
  dataUrl: string
  gammaUrl: string
  scoreRefreshIntervalMs: number
  walletRefreshIntervalMs: number
  wsUrl: string
}

export function parseWorkerEnv(input: Record<string, string | undefined>): WorkerEnv {
  const database = parseDatabaseEnv(input)
  const worker = WorkerEnvSchema.parse(input)

  return {
    discoveryIntervalMs: worker.POLYBOARD_DISCOVERY_INTERVAL_MS,
    databaseUrl: database.databaseUrl,
    minMarketVolume: database.minMarketVolume,
    backfillBatchSize: database.backfillBatchSize,
    dataUrl: worker.POLYBOARD_DATA_URL,
    gammaUrl: worker.POLYBOARD_GAMMA_URL,
    scoreRefreshIntervalMs: worker.POLYBOARD_SCORE_REFRESH_INTERVAL_MS,
    walletRefreshIntervalMs: worker.POLYBOARD_WALLET_REFRESH_INTERVAL_MS,
    wsUrl: worker.POLYBOARD_WS_URL,
  }
}
