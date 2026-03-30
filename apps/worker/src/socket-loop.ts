import type { MarketSocket, MarketSocketMessage } from '@polyboard/polymarket'
import type { FreshnessStatus } from '@polyboard/db'
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

interface FreshnessRepoLike {
  updateFreshness(
    sourceKey: 'ws:markets',
    status: FreshnessStatus,
    completeness?: string,
  ): Promise<void>
}

interface MarketSocketLike {
  connect: (assetIds: string[]) => void
  disconnect: () => void
  subscribe: (assetIds: string[]) => void
  unsubscribe: (assetIds: string[]) => void
  on: (
    event: 'close' | 'error' | 'message',
    listener: (...args: unknown[]) => void,
  ) => unknown
}

export function createMarketSocketLoop(deps: {
  freshnessRepo?: FreshnessRepoLike
  logger: LoggerLike
  marketRepo: MarketRepoLike
  marketSocket: MarketSocketLike | MarketSocket
}) {
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let tokenLookup = new Map<string, TrackedTokenRow>()

  const fetchTrackedTokens = async () =>
    new Map(
      (await deps.marketRepo.listTrackedTokens()).map((token) => [
        token.tokenId,
        token,
      ]),
    )

  const markWebsocketFreshness = async (
    status: FreshnessStatus,
    completeness?: string,
  ) => {
    await deps.freshnessRepo?.updateFreshness(
      'ws:markets',
      status,
      completeness,
    )
  }

  const diffTrackedTokens = (
    previousLookup: Map<string, TrackedTokenRow>,
    nextLookup: Map<string, TrackedTokenRow>,
  ) => {
    const previousTokenIds = [...previousLookup.keys()]
    const nextTokenIds = [...nextLookup.keys()]

    return {
      addedTokenIds: nextTokenIds.filter(
        (tokenId) => !previousLookup.has(tokenId),
      ),
      removedTokenIds: previousTokenIds.filter(
        (tokenId) => !nextLookup.has(tokenId),
      ),
    }
  }

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
      const nextLookup = await fetchTrackedTokens()

      deps.logger.info(
        {
          trackedTokenCount: nextLookup.size,
        },
        'starting market socket',
      )

      deps.marketSocket.connect([...nextLookup.keys()])
      tokenLookup = nextLookup
      await markWebsocketFreshness('live', 'live')
    } catch (error) {
      await markWebsocketFreshness('degraded', 'degraded')
      deps.logger.error({ err: error }, 'failed to start market socket')
      scheduleReconnect()
    }
  }

  const refreshSubscriptions = async () => {
    if (stopped) {
      return
    }

    try {
      const nextLookup = await fetchTrackedTokens()
      const { addedTokenIds, removedTokenIds } = diffTrackedTokens(
        tokenLookup,
        nextLookup,
      )

      if (removedTokenIds.length > 0) {
        deps.marketSocket.unsubscribe(removedTokenIds)
      }

      if (addedTokenIds.length > 0) {
        deps.marketSocket.subscribe(addedTokenIds)
      }

      tokenLookup = nextLookup
    } catch (error) {
      deps.logger.error(
        { err: error },
        'failed to refresh market socket subscriptions',
      )
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
    void markWebsocketFreshness('degraded', 'degraded')
    deps.logger.error({ err: error }, 'market socket error')
    scheduleReconnect()
  })

  deps.marketSocket.on('close', () => {
    void markWebsocketFreshness('degraded', 'degraded')
    deps.logger.warn('market socket closed')
    scheduleReconnect()
  })

  return {
    start: connect,
    refreshSubscriptions,
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
