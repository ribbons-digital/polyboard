import {
  createDb,
  walletScores,
  wallets,
  walletWatchlists,
} from '@polyboard/db'
import { desc, eq, sql } from 'drizzle-orm'

function toRecord(value: unknown): Record<string, {}> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      entry ?? {},
    ]),
  ) as Record<string, {}>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

export interface WalletLeaderboardInput {
  limit?: number
}

export async function listWalletLeaderboard(filters: WalletLeaderboardInput = {}) {
  const db = createDb()

  const query = db
    .select({
      address: wallets.address,
      averagePositionSize: sql<number>`(${walletScores.averagePositionSize})::float`,
      completeness: walletScores.completeness,
      displayName: wallets.displayName,
      isExcluded: walletWatchlists.isExcluded,
      tags: walletScores.tags,
      totalPnl: sql<number>`(${walletScores.totalPnl})::float`,
      verified: wallets.verified,
      winRate: sql<number>`(${walletScores.winRate})::float`,
    })
    .from(walletScores)
    .innerJoin(wallets, eq(wallets.address, walletScores.walletAddress))
    .leftJoin(walletWatchlists, eq(walletWatchlists.address, wallets.address))
    .orderBy(desc(walletScores.totalPnl))

  const rows = await (filters.limit === undefined
    ? query
    : query.limit(filters.limit))

  return rows.map((row) => ({
    ...row,
    tags: toStringArray(row.tags),
  }))
}

export async function getWalletScores(address: string) {
  const db = createDb()

  const [score] = await db
    .select({
      averagePositionSize: sql<number>`(${walletScores.averagePositionSize})::float`,
      completeness: walletScores.completeness,
      realizedPnl: sql<number>`(${walletScores.realizedPnl})::float`,
      tags: walletScores.tags,
      totalPnl: sql<number>`(${walletScores.totalPnl})::float`,
      unrealizedPnl: sql<number>`(${walletScores.unrealizedPnl})::float`,
      walletAddress: walletScores.walletAddress,
      winRate: sql<number>`(${walletScores.winRate})::float`,
    })
    .from(walletScores)
    .where(eq(walletScores.walletAddress, address))
    .limit(1)

  if (!score) {
    return null
  }

  return {
    ...score,
    tags: toStringArray(score.tags),
  }
}
