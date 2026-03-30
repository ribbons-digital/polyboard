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

  if ('asset_id' in input || 'assetId' in input) {
    try {
      return [normalizeSocketMessage(input as Record<string, unknown>)]
    } catch {
      return []
    }
  }

  return []
}
