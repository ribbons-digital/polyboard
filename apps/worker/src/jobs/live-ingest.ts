import type { MarketSocketMessage } from '@polyboard/polymarket'

export interface TokenLookupEntry {
  marketId: string
  tokenId: string
}

export interface SnapshotInsertInput {
  marketId: string
  tokenId: string
  lastPrice?: number
  bestBid?: number
  bestAsk?: number
  spreadBps?: number
  capturedAt: Date
}

export function computeSpreadBps(bestBid?: number, bestAsk?: number) {
  if (
    bestBid === undefined ||
    bestAsk === undefined ||
    bestBid <= 0 ||
    bestAsk <= 0
  ) {
    return undefined
  }

  const midpoint = (bestBid + bestAsk) / 2

  if (midpoint <= 0) {
    return undefined
  }

  return ((bestAsk - bestBid) / midpoint) * 10_000
}

export async function handleSocketMessage(
  tokenLookup: Map<string, TokenLookupEntry>,
  input: MarketSocketMessage,
  insertSnapshot: (snapshot: SnapshotInsertInput) => Promise<void>,
) {
  const token = tokenLookup.get(input.assetId)

  if (token === undefined) {
    return
  }

  await insertSnapshot({
    marketId: token.marketId,
    tokenId: token.tokenId,
    lastPrice: input.price,
    bestBid: input.bestBid,
    bestAsk: input.bestAsk,
    spreadBps: computeSpreadBps(input.bestBid, input.bestAsk),
    capturedAt: new Date(input.timestamp),
  })
}
