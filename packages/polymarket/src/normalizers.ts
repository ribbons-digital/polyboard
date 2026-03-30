import {
  gammaMarketSchema,
  socketMessageSchema,
  type GammaMarket,
  type MarketSocketMessage,
  type NormalizedMarket,
} from './types'

function parseList(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value
  }

  const parsed = JSON.parse(value) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array payload')
  }

  return parsed.map((item) => String(item))
}

function parseNumeric(value: string | number): number {
  const result = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(result)) {
    throw new Error(`Expected a numeric value, received ${String(value)}`)
  }

  return result
}

function requireValue<T>(
  value: T | null | undefined,
  fieldName: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${fieldName} to be present`)
  }

  return value
}

export function normalizeGammaMarket(input: GammaMarket): NormalizedMarket {
  const market = gammaMarketSchema.parse(input)
  const outcomes = parseList(requireValue(market.outcomes, 'outcomes'))
  const tokenIds = parseList(requireValue(market.clobTokenIds, 'clobTokenIds'))

  return {
    id: requireValue(market.id, 'id'),
    conditionId: requireValue(market.conditionId, 'conditionId'),
    question: requireValue(market.question, 'question'),
    slug: requireValue(market.slug, 'slug'),
    active: requireValue(market.active, 'active'),
    closed: requireValue(market.closed, 'closed'),
    volume: parseNumeric(requireValue(market.volume, 'volume')),
    liquidity: parseNumeric(requireValue(market.liquidity, 'liquidity')),
    category: market.category ?? null,
    endDate: market.endDate ?? null,
    tokens: tokenIds.map((id, outcomeIndex) => ({
      id,
      outcome: outcomes[outcomeIndex] ?? `Outcome ${outcomeIndex + 1}`,
      outcomeIndex,
    })),
  }
}

export function normalizeGammaMarkets(
  input: GammaMarket[],
): NormalizedMarket[] {
  return input.flatMap((market) => {
    try {
      return [normalizeGammaMarket(market)]
    } catch {
      return []
    }
  })
}

export function normalizeSocketMessage(
  input: Record<string, unknown>,
): MarketSocketMessage {
  const message = socketMessageSchema.parse(input)
  const assetId = message.asset_id ?? message.assetId

  if (assetId === undefined) {
    throw new Error('Socket message is missing asset_id')
  }

  const timestampSource = message.timestamp ?? Date.now()

  return {
    assetId: String(assetId),
    bestBid:
      message.best_bid === undefined ? undefined : parseNumeric(message.best_bid),
    bestAsk:
      message.best_ask === undefined ? undefined : parseNumeric(message.best_ask),
    price: message.price === undefined ? undefined : parseNumeric(message.price),
    side: message.side,
    timestamp:
      timestampSource instanceof Date
        ? timestampSource.getTime()
        : parseNumeric(timestampSource),
  }
}
