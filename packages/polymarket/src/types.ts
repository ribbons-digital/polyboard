import { z } from 'zod'

export const gammaMarketSchema = z.object({
  id: z.string().nullable().optional(),
  conditionId: z.string().nullable().optional(),
  question: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  active: z.boolean().nullable().optional(),
  closed: z.boolean().nullable().optional(),
  volume: z.union([z.string(), z.number()]).nullable().optional(),
  liquidity: z.union([z.string(), z.number()]).nullable().optional(),
  category: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  outcomes: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  clobTokenIds: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
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
  '1m',
  '1h',
  '6h',
  '1d',
  '1w',
])

export type ClobPriceHistoryInterval = z.infer<
  typeof clobPriceHistoryIntervalSchema
>
