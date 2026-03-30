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
  POLYBOARD_WS_URL: OptionalUrlString.default(
    'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  ),
  POLYBOARD_GAMMA_URL: OptionalUrlString.default(
    'https://gamma-api.polymarket.com',
  ),
})

export interface WorkerEnv {
  databaseUrl: string
  minMarketVolume: number
  backfillBatchSize: number
  gammaUrl: string
  wsUrl: string
}

export function parseWorkerEnv(input: Record<string, string | undefined>): WorkerEnv {
  const database = parseDatabaseEnv(input)
  const worker = WorkerEnvSchema.parse(input)

  return {
    databaseUrl: database.databaseUrl,
    minMarketVolume: database.minMarketVolume,
    backfillBatchSize: database.backfillBatchSize,
    gammaUrl: worker.POLYBOARD_GAMMA_URL,
    wsUrl: worker.POLYBOARD_WS_URL,
  }
}
