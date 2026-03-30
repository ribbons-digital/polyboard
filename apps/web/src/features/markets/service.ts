import {
  createDb,
  getMarketDetailData,
  markets,
  marketScores,
  marketTags,
} from '@polyboard/db'
import { and, desc, eq, gte, ilike, sql } from 'drizzle-orm'

export interface MarketFilterInput {
  minEdge?: number
  category?: string
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

  return db
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
}

export async function getMarketDetail(marketId: string) {
  const db = createDb()
  const detail = await getMarketDetailData(db, marketId)

  return {
    ...detail,
    market: detail.market
      ? {
          ...detail.market,
          metadata: toRecord(detail.market.metadata),
        }
      : detail.market,
  }
}
