import { fetchJson } from './http'

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

export class DataClient {
  constructor(private readonly baseUrl = 'https://data-api.polymarket.com') {}

  getLeaderboard(query?: Record<string, string | number | boolean | undefined>) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/v1/leaderboard', query)}`,
    )
  }

  getPositions(
    query: string | Record<string, string | number | boolean | undefined>,
  ) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery(
        '/positions',
        typeof query === 'string' ? { user: query } : query,
      )}`,
    )
  }

  getClosedPositions(
    query: string | Record<string, string | number | boolean | undefined>,
  ) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery(
        '/closed-positions',
        typeof query === 'string' ? { user: query } : query,
      )}`,
    )
  }

  getActivity(user: string) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/activity', { user })}`,
    )
  }

  getTrades(query?: Record<string, string | number | boolean | undefined>) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/trades', query)}`,
    )
  }

  getHolders(market: string) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/holders', { market })}`,
    )
  }

  getMarketPositions(market: string) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/v1/market-positions', { market })}`,
    )
  }

  getValue(user: string) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/value', { user })}`,
    )
  }

  getOpenInterest(market: string) {
    return fetchJson<Array<Record<string, unknown>>>(
      `${this.baseUrl}${withQuery('/oi', { market })}`,
    )
  }
}
