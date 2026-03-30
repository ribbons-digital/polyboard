import type { MarketSocket, MarketSocketMessage } from '@polyboard/polymarket'
import {
  handleSocketMessage,
  type SnapshotInsertInput,
} from './jobs/live-ingest'

export const RECONNECT_DELAY_MS = 1_000

interface LoggerLike {
  error: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
}

interface TrackedTokenRow {
  marketId: string
  tokenId: string
}

interface MarketRepoLike {
  insertSnapshot: (snapshot: SnapshotInsertInput) => Promise<void>
  listTrackedTokens: () => Promise<TrackedTokenRow[]>
}

interface MarketSocketLike {
  connect: (assetIds: string[]) => void
  disconnect: () => void
  on: (
    event: 'close' | 'error' | 'message',
    listener: (...args: unknown[]) => void,
  ) => unknown
}

export function createMarketSocketLoop(deps: {
  logger: LoggerLike
  marketRepo: MarketRepoLike
  marketSocket: MarketSocketLike | MarketSocket
}) {
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let tokenLookup = new Map<string, TrackedTokenRow>()

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== undefined) {
      return
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      void connect()
    }, RECONNECT_DELAY_MS)
  }

  const connect = async () => {
    if (stopped) {
      return
    }

    try {
      const trackedTokens = await deps.marketRepo.listTrackedTokens()
      tokenLookup = new Map(
        trackedTokens.map((token) => [token.tokenId, token]),
      )

      deps.logger.info(
        {
          trackedTokenCount: tokenLookup.size,
        },
        'starting market socket',
      )

      deps.marketSocket.connect([...tokenLookup.keys()])
    } catch (error) {
      deps.logger.error({ err: error }, 'failed to start market socket')
      scheduleReconnect()
    }
  }

  deps.marketSocket.on('message', async (message) => {
    try {
      await handleSocketMessage(
        tokenLookup,
        message as MarketSocketMessage,
        deps.marketRepo.insertSnapshot,
      )
    } catch (error) {
      deps.logger.error({ err: error }, 'failed to persist market snapshot')
    }
  })

  deps.marketSocket.on('error', (error) => {
    deps.logger.error({ err: error }, 'market socket error')
    scheduleReconnect()
  })

  deps.marketSocket.on('close', () => {
    deps.logger.warn('market socket closed')
    scheduleReconnect()
  })

  return {
    start: connect,
    stop: () => {
      stopped = true

      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
      }

      deps.marketSocket.disconnect()
    },
  }
}
