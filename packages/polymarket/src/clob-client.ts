import { fetchJson } from './http'
import {
  clobPriceHistoryIntervalSchema,
  type ClobPriceHistoryInterval,
} from './types'

export class ClobClient {
  constructor(private readonly baseUrl = 'https://clob.polymarket.com') {}

  getPriceHistory(
    assetId: string,
    interval: ClobPriceHistoryInterval = '1d',
  ) {
    const parsedInterval = clobPriceHistoryIntervalSchema.parse(interval)

    return fetchJson<{ history: Array<{ t: number; p: number }> }>(
      `${this.baseUrl}/prices-history?market=${encodeURIComponent(assetId)}&interval=${parsedInterval}`,
    )
  }
}
