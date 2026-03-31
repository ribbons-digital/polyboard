import { desc, eq } from 'drizzle-orm'
import { createDb } from '../client'
import {
  walletScores,
  wallets,
  walletWatchlists,
} from '../schema'

type DbClient = ReturnType<typeof createDb>

export interface WalletProfileInput {
  address: string
  displayName?: string | null
  pseudonym?: string | null
  verified?: boolean
  profileImage?: string | null
  metadata?: Record<string, unknown>
}

export async function upsertWalletProfiles(
  db: DbClient,
  rows: WalletProfileInput[],
) {
  const now = new Date()

  for (const row of rows) {
    const updateSet: Record<string, unknown> = {
      updatedAt: now,
    }

    if (row.displayName !== undefined) {
      updateSet.displayName = row.displayName ?? null
    }

    if (row.pseudonym !== undefined) {
      updateSet.pseudonym = row.pseudonym ?? null
    }

    if (row.verified !== undefined) {
      updateSet.verified = row.verified
    }

    if (row.profileImage !== undefined) {
      updateSet.profileImage = row.profileImage ?? null
    }

    if (row.metadata !== undefined) {
      updateSet.metadata = row.metadata
    }

    await db
      .insert(wallets)
      .values({
        address: row.address,
        displayName: row.displayName ?? null,
        metadata: row.metadata ?? {},
        profileImage: row.profileImage ?? null,
        pseudonym: row.pseudonym ?? null,
        updatedAt: now,
        verified: row.verified ?? false,
      })
      .onConflictDoUpdate({
        target: wallets.address,
        set: updateSet,
      })
  }
}

export interface WalletScoreInput {
  walletAddress: string
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  winRate: number
  averagePositionSize: number
  tags: string[]
  completeness: 'provisional' | 'backfilled'
}

export async function upsertWalletScore(db: DbClient, input: WalletScoreInput) {
  await db
    .insert(walletScores)
    .values({
      averagePositionSize: String(input.averagePositionSize),
      calculatedAt: new Date(),
      completeness: input.completeness,
      realizedPnl: String(input.realizedPnl),
      tags: input.tags,
      totalPnl: String(input.totalPnl),
      unrealizedPnl: String(input.unrealizedPnl),
      walletAddress: input.walletAddress,
      winRate: String(input.winRate),
    })
    .onConflictDoUpdate({
      target: walletScores.walletAddress,
      set: {
        averagePositionSize: String(input.averagePositionSize),
        calculatedAt: new Date(),
        completeness: input.completeness,
        realizedPnl: String(input.realizedPnl),
        tags: input.tags,
        totalPnl: String(input.totalPnl),
        unrealizedPnl: String(input.unrealizedPnl),
        winRate: String(input.winRate),
      },
    })
}

export async function listTrackedWallets(db: DbClient) {
  return db.select().from(wallets)
}

export async function listWatchlistEntries(db: DbClient) {
  return db.select().from(walletWatchlists)
}



export async function getWalletDetailData(
  db: DbClient,
  walletAddress: string,
) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.address, walletAddress))
  const [score] = await db
    .select()
    .from(walletScores)
    .where(eq(walletScores.walletAddress, walletAddress))
  const openPositions = await db
    .select()
    .from(walletPositionsOpen)
    .where(eq(walletPositionsOpen.walletAddress, walletAddress))
  const closedPositions = await db
    .select()
    .from(walletPositionsClosed)
    .where(eq(walletPositionsClosed.walletAddress, walletAddress))
    .orderBy(desc(walletPositionsClosed.closedAt))
  const eventStats = await db
    .select()
    .from(walletEventStats)
    .where(eq(walletEventStats.walletAddress, walletAddress))

  return {
    closedPositions,
    eventStats,
    openPositions,
    score,
    wallet,
  }
}
