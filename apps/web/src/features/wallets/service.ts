import {
  createDb,
  getWalletDetailData,
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

export async function listWalletLeaderboard() {
  const db = createDb()

  const rows = await db
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

  return rows.map((row) => ({
    ...row,
    tags: toStringArray(row.tags),
  }))
}

export async function getWalletDetail(address: string) {
  const db = createDb()
  const detail = await getWalletDetailData(db, address)

  return {
    ...detail,
    score: detail.score
      ? {
          ...detail.score,
          tags: toStringArray(detail.score.tags),
        }
      : detail.score,
    wallet: detail.wallet
      ? {
          ...detail.wallet,
          metadata: toRecord(detail.wallet.metadata),
        }
      : detail.wallet,
  }
}
