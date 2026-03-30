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
    status: 'live' | 'degraded' | 'fallback',
  ): Promise<void>
}

export interface DiscoveryDeps {
  minVolume: number
  gammaClient: {
    listMarkets(): Promise<NormalizedMarket[]>
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
  const markets = await deps.gammaClient.listMarkets()
  const tracked = markets.filter(
    (market) =>
      market.active &&
      !market.closed &&
      Number.isFinite(market.volume) &&
      market.volume >= deps.minVolume,
  )

  await deps.marketRepo.upsertMarkets(tracked)

  for (const market of tracked) {
    const rawTags = await deps.gammaClient.getMarketTags(market.id)
    const tags = rawTags.flatMap((tag) => {
      const normalized = normalizeTag(tag)
      return normalized === null ? [] : [normalized]
    })

    await deps.marketRepo.replaceTags(market.id, tags)
  }

  await deps.freshnessRepo.updateFreshness('gamma:markets', 'live')

  return tracked
}
