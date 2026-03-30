import { EventEmitter } from 'node:events'
import WebSocket, { type RawData } from 'ws'
import { normalizeSocketMessage } from './normalizers'
import type { MarketSocketMessage } from './types'

const HEARTBEAT_INTERVAL_MS = 10_000

export interface MarketSocketEvents {
  message: [message: MarketSocketMessage]
  close: []
  error: [error: Error]
}

export class MarketSocket extends EventEmitter<MarketSocketEvents> {
  private socket?: WebSocket
  private heartbeat?: ReturnType<typeof setInterval>

  constructor(
    private readonly url = 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  ) {
    super()
  }

  connect(assetIds: string[]) {
    this.cleanupHeartbeat()
    this.socket = new WebSocket(this.url)

    this.socket.on('open', () => {
      this.socket?.send(
        JSON.stringify({
          assets_ids: assetIds,
          custom_feature_enabled: true,
          type: 'market',
        }),
      )

      this.heartbeat = setInterval(() => {
        this.socket?.send('PING')
      }, HEARTBEAT_INTERVAL_MS)
    })

    this.socket.on('message', (payload: RawData) => {
      for (const message of parseMarketSocketMessages(deserializeMarketSocketFrame(payload))) {
        this.emit('message', message)
      }
    })

    this.socket.on('close', () => {
      this.cleanupHeartbeat()
      this.emit('close')
    })

    this.socket.on('error', (error: Error) => {
      this.cleanupHeartbeat()
      this.emit('error', error)
    })
  }

  subscribe(assetIds: string[]) {
    this.socket?.send(
      JSON.stringify({
        assets_ids: assetIds,
        operation: 'subscribe',
        type: 'market',
      }),
    )
  }

  unsubscribe(assetIds: string[]) {
    this.socket?.send(
      JSON.stringify({
        assets_ids: assetIds,
        operation: 'unsubscribe',
        type: 'market',
      }),
    )
  }

  disconnect() {
    this.cleanupHeartbeat()
    this.socket?.close()
  }

  private cleanupHeartbeat() {
    if (this.heartbeat !== undefined) {
      clearInterval(this.heartbeat)
      this.heartbeat = undefined
    }
  }
}

function deserializeMarketSocketFrame(payload: RawData): unknown {
  const text = payload.toString()

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function parseMarketSocketMessages(input: unknown): MarketSocketMessage[] {
  if (input === 'PONG') {
    return []
  }

  if (typeof input !== 'object' || input === null) {
    return []
  }

  if (
    'event_type' in input &&
    input.event_type === 'price_change' &&
    'price_changes' in input &&
    Array.isArray(input.price_changes)
  ) {
    const timestamp = 'timestamp' in input ? input.timestamp : undefined

    return input.price_changes.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return []
      }

      try {
        return [
          normalizeSocketMessage({
            ...entry,
            timestamp: 'timestamp' in entry ? entry.timestamp : timestamp,
          }),
        ]
      } catch {
        return []
      }
    })
  }

  if ('event_type' in input && input.event_type === 'book') {
    const assetId = getAssetId(input)

    if (assetId === undefined) {
      return []
    }

    const bestBid = extractTopBookPrice(
      'bids' in input && Array.isArray(input.bids) ? input.bids : undefined,
    )
    const bestAsk = extractTopBookPrice(
      'asks' in input && Array.isArray(input.asks) ? input.asks : undefined,
    )

    return [
      normalizeSocketMessage({
        asset_id: assetId,
        best_bid: bestBid,
        best_ask: bestAsk,
        timestamp: 'timestamp' in input ? input.timestamp : undefined,
      }),
    ]
  }

  if ('asset_id' in input || 'assetId' in input) {
    try {
      return [normalizeSocketMessage(input as Record<string, unknown>)]
    } catch {
      return []
    }
  }

  return []
}

function extractTopBookPrice(levels: unknown[] | undefined): number | undefined {
  const firstLevel = levels?.[0]

  if (typeof firstLevel !== 'object' || firstLevel === null) {
    return undefined
  }

  if (!('price' in firstLevel)) {
    return undefined
  }

  const price =
    typeof firstLevel.price === 'number'
      ? firstLevel.price
      : Number(firstLevel.price)

  return Number.isFinite(price) ? price : undefined
}

function getAssetId(input: Record<string, unknown>): unknown {
  if ('asset_id' in input) {
    return input.asset_id
  }

  if ('assetId' in input) {
    return input.assetId
  }

  return undefined
}
