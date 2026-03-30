import { eq } from 'drizzle-orm'
import { createDb } from '../client'
import { marketSnapshots, marketTags, markets, tokens } from '../schema'

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

export async function upsertMarkets(db: DbClient, rows: UpsertMarketInput[]) {
  if (rows.length === 0) {
    return
  }

  const now = new Date()

  await db.transaction(async (tx) => {
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

      for (const token of row.tokens) {
        await tx
          .insert(tokens)
          .values({
            id: token.id,
            marketId: row.id,
            outcome: token.outcome,
            outcomeIndex: token.outcomeIndex,
          })
          .onConflictDoUpdate({
            target: tokens.id,
            set: {
              marketId: row.id,
              outcome: token.outcome,
              outcomeIndex: token.outcomeIndex,
            },
          })
      }
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
  return db
    .select({
      marketId: markets.id,
      tokenId: tokens.id,
    })
    .from(markets)
    .innerJoin(tokens, eq(tokens.marketId, markets.id))
    .where(eq(markets.active, true))
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
