import { EventEmitter } from 'node:events'
import WebSocket, { type RawData } from 'ws'
import { normalizeSocketMessage } from './normalizers'
import type { MarketSocketMessage } from './types'

export interface MarketSocketEvents {
  message: [message: MarketSocketMessage]
  close: []
  error: [error: Error]
}

export class MarketSocket extends EventEmitter<MarketSocketEvents> {
  private socket?: WebSocket

  constructor(
    private readonly url = 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  ) {
    super()
  }

  connect(assetIds: string[]) {
    this.socket = new WebSocket(this.url)

    this.socket.on('open', () => {
      this.socket?.send(
        JSON.stringify({
          assets_ids: assetIds,
          custom_feature_enabled: true,
          type: 'market',
        }),
      )
    })

    this.socket.on('message', (payload: RawData) => {
      const parsed = JSON.parse(payload.toString()) as Record<string, unknown>
      this.emit('message', normalizeSocketMessage(parsed))
    })

    this.socket.on('close', () => {
      this.emit('close')
    })

    this.socket.on('error', (error: Error) => {
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
    this.socket?.close()
  }
}
