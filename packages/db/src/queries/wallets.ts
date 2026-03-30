import { desc, eq } from 'drizzle-orm'
import { createDb } from '../client'
import {
  walletEventStats,
  walletPositionsClosed,
  walletPositionsOpen,
  walletScores,
  walletTrades,
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

export interface OpenPositionInput {
  marketId: string
  tokenId: string
  outcome: string
  size: number
  averagePrice: number
  currentValue: number
  realizedPnl: number
  totalPnl: number
}

export async function replaceOpenPositions(
  db: DbClient,
  walletAddress: string,
  rows: OpenPositionInput[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(walletPositionsOpen)
      .where(eq(walletPositionsOpen.walletAddress, walletAddress))

    if (rows.length === 0) {
      return
    }

    await tx.insert(walletPositionsOpen).values(
      rows.map((row) => ({
        averagePrice: String(row.averagePrice),
        currentValue: String(row.currentValue),
        marketId: row.marketId,
        outcome: row.outcome,
        realizedPnl: String(row.realizedPnl),
        size: String(row.size),
        tokenId: row.tokenId,
        totalPnl: String(row.totalPnl),
        updatedAt: new Date(),
        walletAddress,
      })),
    )
  })
}

export interface ClosedPositionInput {
  marketId: string
  tokenId: string
  outcome: string
  totalBought: number
  averagePrice: number
  realizedPnl: number
  closedAt: Date
}

export async function replaceClosedPositions(
  db: DbClient,
  walletAddress: string,
  rows: ClosedPositionInput[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(walletPositionsClosed)
      .where(eq(walletPositionsClosed.walletAddress, walletAddress))

    if (rows.length === 0) {
      return
    }

    await tx.insert(walletPositionsClosed).values(
      rows.map((row) => ({
        averagePrice: String(row.averagePrice),
        closedAt: row.closedAt,
        marketId: row.marketId,
        outcome: row.outcome,
        realizedPnl: String(row.realizedPnl),
        tokenId: row.tokenId,
        totalBought: String(row.totalBought),
        walletAddress,
      })),
    )
  })
}

export interface WalletTradeInput {
  transactionHash: string
  marketId: string
  tokenId: string
  side: string
  price: number
  size: number
  tradedAt: Date
}

export async function replaceTrades(
  db: DbClient,
  walletAddress: string,
  rows: WalletTradeInput[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(walletTrades)
      .where(eq(walletTrades.walletAddress, walletAddress))

    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      await tx
        .insert(walletTrades)
        .values({
          marketId: row.marketId,
          price: String(row.price),
          side: row.side,
          size: String(row.size),
          tokenId: row.tokenId,
          tradedAt: row.tradedAt,
          transactionHash: row.transactionHash,
          walletAddress,
        })
    }
  })
}

export interface WalletEventStatInput {
  eventSlug: string
  tradeCount: number
  realizedPnl: number
  totalVolume: number
}

export async function replaceWalletEventStats(
  db: DbClient,
  walletAddress: string,
  rows: WalletEventStatInput[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(walletEventStats)
      .where(eq(walletEventStats.walletAddress, walletAddress))

    if (rows.length === 0) {
      return
    }

    await tx.insert(walletEventStats).values(
      rows.map((row) => ({
        eventSlug: row.eventSlug,
        realizedPnl: String(row.realizedPnl),
        totalVolume: String(row.totalVolume),
        tradeCount: row.tradeCount,
        updatedAt: new Date(),
        walletAddress,
      })),
    )
  })
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
