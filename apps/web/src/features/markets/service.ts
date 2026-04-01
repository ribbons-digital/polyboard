import {
  createDb,
  getMarketDetailData,
  markets,
  marketSnapshots,
  marketScores,
  marketTags,
} from '@polyboard/db'
import { and, asc, desc, eq, gte, ilike, sql } from 'drizzle-orm'

export interface MarketFilterInput {
  category?: string
  limit?: number
  minEdge?: number
  search?: string
}

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

function formatTimeLabel(timestamp: Date) {
  return timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function applyMarketFilters<
  T extends {
    category: string | null
    edgeScore: number
    marketId: string
  },
>(rows: T[], filters: MarketFilterInput) {
  return rows.filter((row) => {
    if (filters.minEdge !== undefined && row.edgeScore < filters.minEdge) {
      return false
    }

    if (filters.category !== undefined && row.category !== filters.category) {
      return false
    }

    if (filters.search !== undefined) {
      if (!row.marketId.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
    }

    return true
  })
}

export async function listMarketLeaderboard(filters: MarketFilterInput) {
  const db = createDb()

  const query = db
    .select({
      category: markets.category,
      edgeScore: sql<number>`(${marketScores.edgeScore})::float`,
      marketId: markets.id,
      question: markets.question,
      slug: markets.slug,
      tags: sql<string[]>`coalesce(array_remove(array_agg(distinct ${marketTags.label}), null), '{}')`,
      timingScore: sql<number>`(${marketScores.timingScore})::float`,
      volume: sql<number>`(${markets.volume})::float`,
    })
    .from(markets)
    .innerJoin(marketScores, eq(marketScores.marketId, markets.id))
    .leftJoin(marketTags, eq(marketTags.marketId, markets.id))
    .where(
      and(
        filters.minEdge !== undefined
          ? gte(marketScores.edgeScore, String(filters.minEdge))
          : undefined,
        filters.category !== undefined
          ? eq(markets.category, filters.category)
          : undefined,
        filters.search !== undefined
          ? ilike(markets.question, `%${filters.search}%`)
          : undefined,
      ),
    )
    .groupBy(
      markets.id,
      markets.slug,
      markets.question,
      markets.category,
      markets.volume,
      marketScores.edgeScore,
      marketScores.timingScore,
    )
    .orderBy(desc(marketScores.edgeScore))

  return filters.limit === undefined ? query : query.limit(filters.limit)
}

export async function getMarketDetail(marketId: string) {
  const db = createDb()
  const [score] = await db
    .select({
      marketStructure: sql<number>`(${marketScores.marketStructureScore})::float`,
      smartMoney: sql<number>`(${marketScores.smartMoneyScore})::float`,
      timing: sql<number>`(${marketScores.timingScore})::float`,
    })
    .from(marketScores)
    .where(eq(marketScores.marketId, marketId))
  const snapshots = await db
    .select({
      capturedAt: marketSnapshots.capturedAt,
      price: sql<number>`coalesce((${marketSnapshots.lastPrice})::float, 0)`,
    })
    .from(marketSnapshots)
    .where(eq(marketSnapshots.marketId, marketId))
    .orderBy(asc(marketSnapshots.capturedAt))
  const detail = await getMarketDetailData(db, marketId)
  const priceHistory = snapshots
    .filter((snapshot) => snapshot.price > 0)
    .map((snapshot) => ({
      label: formatTimeLabel(snapshot.capturedAt),
      price: snapshot.price,
    }))
  const fallbackHistory = (detail.recentTrades ?? []).slice(0, 8).reverse().map((trade) => ({
    label: formatTimeLabel(trade.tradedAt),
    price: Number(trade.price),
  }))

  return {
    ...detail,
    market: detail.market
      ? {
          ...detail.market,
          metadata: toRecord(detail.market.metadata),
        }
      : detail.market,
    priceHistory: priceHistory.length > 0 ? priceHistory : fallbackHistory,
    scoreBreakdown: score
      ? [
          { label: 'market structure', value: score.marketStructure },
          { label: 'smart money', value: score.smartMoney },
          { label: 'timing', value: score.timing },
        ]
      : [],
  }
}
