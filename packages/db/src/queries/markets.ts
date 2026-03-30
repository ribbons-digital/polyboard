import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { createDb } from '../client'
import {
  marketHolders,
  marketScores,
  marketSnapshots,
  marketTags,
  markets,
  tokens,
  wallets,
  walletTrades,
} from '../schema'

type DbClient = ReturnType<typeof createDb>

export interface UpsertMarketInput {
  id: string
  conditionId: string
  question: string
  slug: string
  active: boolean
  closed: boolean
  volume: number
  liquidity: number
  category: string | null
  endDate: string | null
  eventId?: string | null
  tokens: Array<{
    id: string
    outcome: string
    outcomeIndex: number
  }>
}

export interface ReplaceMarketTagInput {
  slug: string
  label: string
}

export function getRetiredMarketIds(
  activeMarketIds: string[],
  trackedMarketIds: string[],
) {
  const trackedMarketIdSet = new Set(trackedMarketIds)

  return activeMarketIds.filter((marketId) => !trackedMarketIdSet.has(marketId))
}

export function getRemovedTokenIds(
  existingTokenIds: string[],
  nextTokenIds: string[],
) {
  const nextTokenIdSet = new Set(nextTokenIds)

  return existingTokenIds.filter((tokenId) => !nextTokenIdSet.has(tokenId))
}

export interface TrackedTokenRow {
  marketId: string
  tokenId: string
  marketActive: boolean
  tokenActive: boolean
}

export function filterTrackedTokens(rows: TrackedTokenRow[]) {
  return rows.flatMap((row) =>
    row.marketActive && row.tokenActive
      ? [{ marketId: row.marketId, tokenId: row.tokenId }]
      : [],
  )
}

export async function listMarketIdsByConditionIds(
  db: DbClient,
  conditionIds: string[],
) {
  const uniqueConditionIds = [...new Set(conditionIds)]

  if (uniqueConditionIds.length === 0) {
    return new Map<string, string>()
  }

  const rows = await db
    .select({
      conditionId: markets.conditionId,
      marketId: markets.id,
    })
    .from(markets)
    .where(inArray(markets.conditionId, uniqueConditionIds))

  return new Map(rows.map((row) => [row.conditionId, row.marketId]))
}

export async function upsertMarkets(db: DbClient, rows: UpsertMarketInput[]) {
  const now = new Date()

  await db.transaction(async (tx) => {
    const trackedMarketIds = rows.map((row) => row.id)
    const activeMarketRows = await tx
      .select({
        id: markets.id,
      })
      .from(markets)
      .where(eq(markets.active, true))
    const retiredMarketIds = getRetiredMarketIds(
      activeMarketRows.map((row) => row.id),
      trackedMarketIds,
    )

    for (const row of rows) {
      await tx
        .insert(markets)
        .values({
          active: row.active,
          category: row.category,
          closed: row.closed,
          conditionId: row.conditionId,
          endDate: row.endDate === null ? null : new Date(row.endDate),
          eventId: row.eventId ?? null,
          id: row.id,
          liquidity: String(row.liquidity),
          metadata: {},
          question: row.question,
          slug: row.slug,
          updatedAt: now,
          volume: String(row.volume),
        })
        .onConflictDoUpdate({
          target: markets.id,
          set: {
            active: row.active,
            category: row.category,
            closed: row.closed,
            conditionId: row.conditionId,
            endDate: row.endDate === null ? null : new Date(row.endDate),
            eventId: row.eventId ?? null,
            liquidity: String(row.liquidity),
            question: row.question,
            slug: row.slug,
            updatedAt: now,
            volume: String(row.volume),
          },
        })

      const existingTokenRows = await tx
        .select({
          id: tokens.id,
        })
        .from(tokens)
        .where(eq(tokens.marketId, row.id))
      const removedTokenIds = getRemovedTokenIds(
        existingTokenRows.map((token) => token.id),
        row.tokens.map((token) => token.id),
      )

      if (removedTokenIds.length > 0) {
        await tx
          .update(tokens)
          .set({
            active: false,
          })
          .where(
            and(
              eq(tokens.marketId, row.id),
              inArray(tokens.id, removedTokenIds),
            ),
          )
      }

      for (const token of row.tokens) {
        await tx
          .insert(tokens)
          .values({
            active: true,
            id: token.id,
            marketId: row.id,
            outcome: token.outcome,
            outcomeIndex: token.outcomeIndex,
          })
          .onConflictDoUpdate({
            target: tokens.id,
            set: {
              active: true,
              marketId: row.id,
              outcome: token.outcome,
              outcomeIndex: token.outcomeIndex,
            },
          })
      }
    }

    if (retiredMarketIds.length > 0) {
      await tx
        .update(markets)
        .set({
          active: false,
          updatedAt: now,
        })
        .where(inArray(markets.id, retiredMarketIds))
    }
  })
}

export async function replaceTags(
  db: DbClient,
  marketId: string,
  tags: ReplaceMarketTagInput[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(marketTags).where(eq(marketTags.marketId, marketId))

    if (tags.length === 0) {
      return
    }

    await tx.insert(marketTags).values(
      tags.map((tag) => ({
        label: tag.label,
        marketId,
        tagSlug: tag.slug,
      })),
    )
  })
}

export async function listTrackedTokens(db: DbClient) {
  const rows = await db
    .select({
      marketActive: markets.active,
      marketId: markets.id,
      tokenActive: tokens.active,
      tokenId: tokens.id,
    })
    .from(markets)
    .innerJoin(tokens, eq(tokens.marketId, markets.id))
    .where(and(eq(markets.active, true), eq(tokens.active, true)))

  return filterTrackedTokens(rows)
}

export async function listSignalInputs(db: DbClient) {
  const snapshotScores = db
    .select({
      marketId: marketSnapshots.marketId,
      marketStructureScore:
        sql<number>`avg(${marketSnapshots.lastPrice})::float`.as(
          'market_structure_score',
        ),
      timingScore: sql<number>`avg(${marketSnapshots.spreadBps})::float`.as(
        'timing_score',
      ),
    })
    .from(marketSnapshots)
    .groupBy(marketSnapshots.marketId)
    .as('snapshot_scores')

  const holderScores = db
    .select({
      marketId: marketHolders.marketId,
      totalCurrentValue:
        sql<number>`sum(${marketHolders.currentValue})::float`.as(
          'total_current_value',
        ),
    })
    .from(marketHolders)
    .groupBy(marketHolders.marketId)
    .as('holder_scores')

  return db
    .select({
      marketId: markets.id,
      marketStructureScore:
        sql<number>`coalesce(${snapshotScores.marketStructureScore}, 0.5)`,
      smartMoneyScore:
        sql<number>`coalesce(${holderScores.totalCurrentValue} / nullif(${markets.volume}::float, 0), 0)`,
      timingScore: sql<number>`coalesce(${snapshotScores.timingScore}, 0)`,
    })
    .from(markets)
    .leftJoin(snapshotScores, eq(snapshotScores.marketId, markets.id))
    .leftJoin(holderScores, eq(holderScores.marketId, markets.id))
}

export interface UpsertMarketScoreInput {
  marketId: string
  marketStructureScore: number
  smartMoneyScore: number
  timingScore: number
  edgeScore: number
  reasons: Array<{ label: string; value: number }>
}

export async function upsertMarketScore(
  db: DbClient,
  input: UpsertMarketScoreInput,
) {
  const calculatedAt = new Date()

  await db
    .insert(marketScores)
    .values({
      ...input,
      marketStructureScore: String(input.marketStructureScore),
      smartMoneyScore: String(input.smartMoneyScore),
      timingScore: String(input.timingScore),
      edgeScore: String(input.edgeScore),
      calculatedAt,
    })
    .onConflictDoUpdate({
      target: marketScores.marketId,
      set: {
        marketStructureScore: String(input.marketStructureScore),
        smartMoneyScore: String(input.smartMoneyScore),
        timingScore: String(input.timingScore),
        edgeScore: String(input.edgeScore),
        reasons: input.reasons,
        calculatedAt,
      },
    })
}

export interface MarketHolderInput {
  tokenId: string
  walletAddress: string
  size: number
  currentValue?: number
}

export async function replaceMarketHolders(
  db: DbClient,
  marketId: string,
  rows: MarketHolderInput[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(marketHolders).where(eq(marketHolders.marketId, marketId))

    if (rows.length === 0) {
      return
    }

    const now = new Date()
    const walletAddresses = [...new Set(rows.map((row) => row.walletAddress))]

    for (const address of walletAddresses) {
      await tx
        .insert(wallets)
        .values({
          address,
          displayName: null,
          metadata: {},
          profileImage: null,
          pseudonym: null,
          updatedAt: now,
          verified: false,
        })
        .onConflictDoNothing()
    }

    await tx.insert(marketHolders).values(
      rows.map((row) => ({
        currentValue:
          row.currentValue === undefined ? null : String(row.currentValue),
        marketId,
        size: String(row.size),
        tokenId: row.tokenId,
        updatedAt: now,
        walletAddress: row.walletAddress,
      })),
    )
  })
}

export async function getMarketDetailData(db: DbClient, marketId: string) {
  const [market] = await db
    .select()
    .from(markets)
    .where(eq(markets.id, marketId))
  const holders = await db
    .select()
    .from(marketHolders)
    .where(eq(marketHolders.marketId, marketId))
    .orderBy(desc(marketHolders.size))
  const recentTrades = await db
    .select()
    .from(walletTrades)
    .where(eq(walletTrades.marketId, marketId))
    .orderBy(desc(walletTrades.tradedAt))

  return {
    holders: holders.slice(0, 10),
    market,
    recentTrades: recentTrades.slice(0, 20),
  }
}

export interface InsertMarketSnapshotInput {
  marketId: string
  tokenId: string
  lastPrice?: number
  spreadBps?: number
  bestBid?: number
  bestAsk?: number
  capturedAt: Date
}

export async function insertMarketSnapshot(
  db: DbClient,
  input: InsertMarketSnapshotInput,
) {
  await db.insert(marketSnapshots).values({
    bestAsk:
      input.bestAsk === undefined ? null : String(input.bestAsk),
    bestBid:
      input.bestBid === undefined ? null : String(input.bestBid),
    capturedAt: input.capturedAt,
    lastPrice:
      input.lastPrice === undefined ? null : String(input.lastPrice),
    marketId: input.marketId,
    spreadBps:
      input.spreadBps === undefined ? null : String(input.spreadBps),
    tokenId: input.tokenId,
  })
}
