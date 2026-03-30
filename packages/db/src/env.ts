import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { z } from 'zod'

let loadedDotenv = false

function ensureDatabaseEnvLoaded() {
  if (loadedDotenv) {
    return
  }

  let currentDir = process.cwd()

  while (true) {
    const candidate = path.join(currentDir, '.env')

    if (existsSync(candidate)) {
      config({ path: candidate })
      break
    }

    const parentDir = path.dirname(currentDir)

    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  loadedDotenv = true
}

const DatabaseUrlSchema = z
  .string({
    error: 'DATABASE_URL is required',
  })
  .min(1, 'DATABASE_URL is required')
  .superRefine((value, ctx) => {
    try {
      const url = new URL(value)

      if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL must use the postgres:// or postgresql:// protocol',
        })
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_URL must be a valid PostgreSQL connection string',
      })
    }
  })

const EnvSchema = z.object({
  DATABASE_URL: DatabaseUrlSchema,
  POLYBOARD_MARKET_MIN_VOLUME: z.coerce.number().positive().default(50_000),
  POLYBOARD_BACKFILL_BATCH_SIZE: z.coerce.number().int().positive().default(50),
})

export function parseDatabaseEnv(input: Record<string, string | undefined>) {
  ensureDatabaseEnvLoaded()

  const parsed = EnvSchema.parse({
    ...process.env,
    ...input,
  })

  return {
    databaseUrl: parsed.DATABASE_URL,
    minMarketVolume: parsed.POLYBOARD_MARKET_MIN_VOLUME,
    backfillBatchSize: parsed.POLYBOARD_BACKFILL_BATCH_SIZE,
  }
}
