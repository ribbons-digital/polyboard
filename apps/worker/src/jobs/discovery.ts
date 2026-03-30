import type { FreshnessStatus } from '@polyboard/db'
import type { NormalizedMarket } from '@polyboard/polymarket'

export interface MarketTag {
  slug: string
  label: string
}

export interface DiscoveryMarketRepo {
  upsertMarkets(rows: NormalizedMarket[]): Promise<void>
  replaceTags(marketId: string, tags: MarketTag[]): Promise<void>
}

export interface DiscoveryFreshnessRepo {
  updateFreshness(
    sourceKey: string,
    status: FreshnessStatus,
    completeness?: string,
  ): Promise<void>
}

export interface DiscoveryDeps {
  minVolume: number
  logger?: {
    warn?: (...args: unknown[]) => void
  }
  gammaClient: {
    listMarkets(
      query?: Record<string, string | number | boolean | undefined>,
    ): Promise<NormalizedMarket[]>
    getMarketTags(marketId: string): Promise<Array<Record<string, unknown>>>
  }
  marketRepo: DiscoveryMarketRepo
  freshnessRepo: DiscoveryFreshnessRepo
}

function normalizeTag(input: Record<string, unknown>): MarketTag | null {
  const slug = input.slug
  const label = input.label

  if (typeof slug !== 'string' || typeof label !== 'string') {
    return null
  }

  return { slug, label }
}

export async function runDiscoveryOnce(deps: DiscoveryDeps) {
  const markets = await deps.gammaClient.listMarkets({
    active: true,
    closed: false,
    limit: 500,
  })
  const tracked = markets.filter(
    (market) =>
      market.active &&
      !market.closed &&
      Number.isFinite(market.volume) &&
      market.volume >= deps.minVolume,
  )

  await deps.marketRepo.upsertMarkets(tracked)

  for (const market of tracked) {
    let rawTags: Array<Record<string, unknown>> = []

    try {
      rawTags = await deps.gammaClient.getMarketTags(market.id)
    } catch (error) {
      deps.logger?.warn?.(
        {
          err: error,
          marketId: market.id,
        },
        'failed to fetch market tags; continuing with empty tags',
      )
    }

    const tags = rawTags.flatMap((tag) => {
      const normalized = normalizeTag(tag)
      return normalized === null ? [] : [normalized]
    })

    await deps.marketRepo.replaceTags(market.id, tags)
  }

  await deps.freshnessRepo.updateFreshness('gamma:markets', 'live')

  return tracked
}
