const POLYMARKET_DATA_URL = 'https://data-api.polymarket.com'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const CACHE_TTL_MS = 5 * 60 * 1000

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T
  }
  cache.delete(key)
  return undefined
}

function setCached<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export interface WalletPosition {
  marketId: string
  tokenId: string
  outcome: string
  size: number
  averagePrice: number
  currentValue: number
}

export interface WalletTrade {
  transactionHash: string
  marketId: string
  tokenId: string
  side: string
  price: number
  size: number
  tradedAt: Date
}

export interface WalletSummary {
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  winRate: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export async function fetchWalletPositions(walletAddress: string): Promise<WalletPosition[]> {
  const cacheKey = `positions:${walletAddress}`
  const cached = getCached<WalletPosition[]>(cacheKey)
  if (cached) return cached

  const response = await fetchJson<Array<Record<string, unknown>>>(
    `${POLYMARKET_DATA_URL}/positions?user=${encodeURIComponent(walletAddress)}&limit=100`
  )

  const positions: WalletPosition[] = response.map((row) => ({
    marketId: String(row.market ?? row.marketId ?? ''),
    tokenId: String(row.tokenId ?? row.token_id ?? ''),
    outcome: String(row.outcome ?? ''),
    size: Number(row.size ?? 0),
    averagePrice: Number(row.avgPrice ?? row.average_price ?? 0),
    currentValue: Number(row.currentValue ?? row.current_value ?? 0),
  }))

  setCached(cacheKey, positions)
  return positions
}

export async function fetchWalletTrades(walletAddress: string): Promise<WalletTrade[]> {
  const cacheKey = `trades:${walletAddress}`
  const cached = getCached<WalletTrade[]>(cacheKey)
  if (cached) return cached

  const response = await fetchJson<Array<Record<string, unknown>>>(
    `${POLYMARKET_DATA_URL}/trades?user=${encodeURIComponent(walletAddress)}&limit=100`
  )

  const trades: WalletTrade[] = response.map((row) => ({
    transactionHash: String(row.transactionHash ?? row.transaction_hash ?? ''),
    marketId: String(row.market ?? row.marketId ?? ''),
    tokenId: String(row.tokenId ?? row.token_id ?? ''),
    side: String(row.side ?? ''),
    price: Number(row.price ?? 0),
    size: Number(row.size ?? 0),
    tradedAt: new Date(String(row.tradedAt ?? row.traded_at ?? Date.now())),
  }))

  setCached(cacheKey, trades)
  return trades
}

export async function fetchWalletSummary(walletAddress: string): Promise<WalletSummary | null> {
  const cacheKey = `summary:${walletAddress}`
  const cached = getCached<WalletSummary>(cacheKey)
  if (cached) return cached

  const response = await fetchJson<Array<Record<string, unknown>>>(
    `${POLYMARKET_DATA_URL}/value?user=${encodeURIComponent(walletAddress)}`
  )

  if (!response || response.length === 0) {
    return null
  }

  const row = response[0]

  const summary: WalletSummary = {
    realizedPnl: Number(row.realizedPnl ?? row.realized_profit ?? 0),
    unrealizedPnl: Number(row.unrealizedPnl ?? row.unrealized_profit ?? 0),
    totalPnl: Number(row.totalPnl ?? row.total_profit ?? 0),
    winRate: Number(row.winRate ?? row.win_rate ?? 0) / 100,
  }

  setCached(cacheKey, summary)
  return summary
}
