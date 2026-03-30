import { eq, inArray } from 'drizzle-orm'
import { createDb } from '../client'
import {
  dataFreshness,
  jobRuns,
  markets,
  marketScores,
  wallets,
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

export interface DashboardUsabilityInput {
  freshnessRows: Array<{
    asOf: Date | string | null
    sourceKey: FreshnessSourceKey
    status: string
  }>
  marketScoreRows: Array<{ marketId: string }>
  now?: Date
  walletScoreRows: Array<{ walletAddress: string }>
}

export function summarizeDashboardUsability(input: DashboardUsabilityInput) {
  const freshnessBySource = new Map(
    input.freshnessRows.map((row) => [
      row.sourceKey,
      {
        asOf: row.asOf,
        status: normalizeFreshnessStatus(row.status),
      },
    ]),
  )

  return {
    hasFallbackRows: freshnessCoreSourceKeys.some((sourceKey) => {
      const row = freshnessBySource.get(sourceKey)

      return row !== undefined && row.status === 'fallback'
    }),
    hasFreshnessRows: freshnessCoreSourceKeys.every((sourceKey) =>
      freshnessBySource.has(sourceKey),
    ),
    hasMarketScores: input.marketScoreRows.length > 0,
    hasWalletScores: input.walletScoreRows.length > 0,
  }
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
  const marketScoreRows = await db
    .select({ marketId: markets.id })
    .from(markets)
    .innerJoin(marketScores, eq(marketScores.marketId, markets.id))
    .limit(1)

  const walletScoreRows = await db
    .select({ walletAddress: wallets.address })
    .from(wallets)
    .innerJoin(walletScores, eq(walletScores.walletAddress, wallets.address))
    .limit(1)

  const freshnessRows = (await db
    .select({
      asOf: dataFreshness.asOf,
      sourceKey: dataFreshness.sourceKey,
      status: dataFreshness.status,
    })
    .from(dataFreshness)
    .where(inArray(dataFreshness.sourceKey, freshnessCoreSourceKeys))) as Array<{
    asOf: Date | string | null
    sourceKey: FreshnessSourceKey
    status: string
  }>

  return summarizeDashboardUsability({
    freshnessRows,
    marketScoreRows,
    walletScoreRows,
  })
}
