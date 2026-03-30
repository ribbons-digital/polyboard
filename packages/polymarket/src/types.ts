import { z } from 'zod'

export const gammaMarketSchema = z.object({
  id: z.string(),
  conditionId: z.string(),
  question: z.string(),
  slug: z.string(),
  active: z.boolean(),
  closed: z.boolean(),
  volume: z.union([z.string(), z.number()]),
  liquidity: z.union([z.string(), z.number()]),
  category: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  outcomes: z.union([z.string(), z.array(z.string())]),
  clobTokenIds: z.union([z.string(), z.array(z.string())]),
})

export type GammaMarket = z.infer<typeof gammaMarketSchema>

export const socketMessageSchema = z.object({
  asset_id: z.union([z.string(), z.number()]).optional(),
  assetId: z.union([z.string(), z.number()]).optional(),
  best_bid: z.union([z.string(), z.number()]).optional(),
  best_ask: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
})

export type RawSocketMessage = z.infer<typeof socketMessageSchema>

export interface NormalizedToken {
  id: string
  outcome: string
  outcomeIndex: number
}

export interface NormalizedMarket {
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
  tokens: NormalizedToken[]
}

export interface MarketSocketMessage {
  assetId: string
  bestBid?: number
  bestAsk?: number
  price?: number
  side?: 'BUY' | 'SELL'
  timestamp: number
}

export const clobPriceHistoryIntervalSchema = z.enum([
  'max',
  'all',
  '1m',
  '1h',
  '6h',
  '1d',
  '1w',
])

export type ClobPriceHistoryInterval = z.infer<
  typeof clobPriceHistoryIntervalSchema
>
