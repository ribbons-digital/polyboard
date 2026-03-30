import { createDb } from '../client'
import {
  dataFreshness,
  jobRuns,
  marketScores,
  walletScores,
} from '../schema'

type DbClient = ReturnType<typeof createDb>

export type FreshnessStatus = 'live' | 'degraded' | 'fallback'

export const freshnessSourceKeys = [
  'gamma:markets',
  'data:wallets',
  'scores:markets',
  'ws:markets',
] as const

export type FreshnessSourceKey = (typeof freshnessSourceKeys)[number]

export const freshnessCoreSourceKeys = [
  'gamma:markets',
  'data:wallets',
  'scores:markets',
] as const satisfies readonly FreshnessSourceKey[]

const freshnessStaleAfterMs: Record<FreshnessSourceKey, number> = {
  'gamma:markets': 600_000,
  'data:wallets': 1_800_000,
  'scores:markets': 600_000,
  'ws:markets': 120_000,
}

export function normalizeFreshnessStatus(status: string): FreshnessStatus {
  if (status === 'fresh') {
    return 'live'
  }

  if (status === 'live' || status === 'degraded' || status === 'fallback') {
    return status
  }

  return 'degraded'
}

export function getFreshnessStaleAfterMs(sourceKey: FreshnessSourceKey) {
  return freshnessStaleAfterMs[sourceKey]
}

export function isFreshnessRowStale(
  sourceKey: FreshnessSourceKey,
  asOf: Date | string | null | undefined,
  now = new Date(),
) {
  if (asOf === null || asOf === undefined) {
    return true
  }

  const timestamp = new Date(asOf).getTime()

  if (Number.isNaN(timestamp)) {
    return true
  }

  return now.getTime() - timestamp > getFreshnessStaleAfterMs(sourceKey)
}

export async function updateFreshness(
  db: DbClient,
  sourceKey: string,
  status: FreshnessStatus,
  completeness = 'backfilled',
) {
  const now = new Date()

  await db
    .insert(dataFreshness)
    .values({
      asOf: now,
      completeness,
      sourceKey,
      status,
    })
    .onConflictDoUpdate({
      target: dataFreshness.sourceKey,
      set: {
        asOf: now,
        completeness,
        status,
      },
    })
}

export async function startJobRun(db: DbClient, jobName: string) {
  const [row] = await db
    .insert(jobRuns)
    .values({
      details: {},
      jobName,
      startedAt: new Date(),
      status: 'running',
    })
    .returning()

  return row.id
}

export async function getDashboardUsability(db: DbClient) {
  const [freshnessRow] = await db
    .select({ sourceKey: dataFreshness.sourceKey })
    .from(dataFreshness)
    .limit(1)
  const [marketScore] = await db
    .select({ marketId: marketScores.marketId })
    .from(marketScores)
    .limit(1)
  const [walletScore] = await db
    .select({ walletAddress: walletScores.walletAddress })
    .from(walletScores)
    .limit(1)

  return {
    hasFreshnessRows: freshnessRow !== undefined,
    hasMarketScores: marketScore !== undefined,
    hasWalletScores: walletScore !== undefined,
  }
}
