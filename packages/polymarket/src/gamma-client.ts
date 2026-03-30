import { fetchJson } from './http'
import { normalizeGammaMarket } from './normalizers'
import type { GammaMarket, NormalizedMarket } from './types'

function withQuery(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  return queryString.length > 0 ? `${path}?${queryString}` : path
}

export class GammaClient {
  constructor(
    private readonly baseUrl = 'https://gamma-api.polymarket.com',
  ) {}

  async listMarkets(
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<NormalizedMarket[]> {
    const payload = await fetchJson<GammaMarket[]>(
      `${this.baseUrl}${withQuery('/markets', query)}`,
    )

    return payload.map(normalizeGammaMarket)
  }

  listEvents(query?: Record<string, string | number | boolean | undefined>) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/events', query)}`,
    )
  }

  getMarketTags(marketId: string) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}/markets/${encodeURIComponent(marketId)}/tags`,
    )
  }

  getPublicProfile(address: string) {
    return fetchJson<Record<string, unknown>>(
      `${this.baseUrl}${withQuery('/public-profile', { address })}`,
    )
  }
}
