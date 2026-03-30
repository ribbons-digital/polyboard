import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMarketSocketLoop,
  RECONNECT_DELAY_MS,
} from './socket-loop'

class FakeMarketSocket extends EventEmitter {
  connectCalls: string[][] = []
  disconnectCalls = 0
  subscribeCalls: string[][] = []
  unsubscribeCalls: string[][] = []

  connect(assetIds: string[]) {
    this.connectCalls.push(assetIds)
  }

  subscribe(assetIds: string[]) {
    this.subscribeCalls.push(assetIds)
  }

  unsubscribe(assetIds: string[]) {
    this.unsubscribeCalls.push(assetIds)
  }

  disconnect() {
    this.disconnectCalls += 1
  }
}

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}

describe('createMarketSocketLoop', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconnects after the socket closes using the latest tracked tokens', async () => {
    vi.useFakeTimers()

    const marketSocket = new FakeMarketSocket()
    const listTrackedTokens = vi
      .fn<() => Promise<Array<{ marketId: string; tokenId: string }>>>()
      .mockResolvedValueOnce([{ marketId: 'm1', tokenId: 'yes' }])
      .mockResolvedValueOnce([{ marketId: 'm2', tokenId: 'no' }])
    const updateFreshness = vi.fn(async () => undefined)

    const loop = createMarketSocketLoop({
      freshnessRepo: {
        updateFreshness,
      },
      logger: createLogger(),
      marketRepo: {
        insertSnapshot: vi.fn(async () => undefined),
        listTrackedTokens,
      },
      marketSocket,
    })

    await loop.start()
    expect(marketSocket.connectCalls).toEqual([['yes']])
    expect(updateFreshness).not.toHaveBeenCalled()

    marketSocket.emit('close')
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_MS)

    expect(marketSocket.connectCalls).toEqual([['yes'], ['no']])
    expect(updateFreshness).toHaveBeenCalledWith(
      'ws:markets',
      'degraded',
      'degraded',
    )
  })

  it('refreshes websocket freshness when a market message is handled', async () => {
    const marketSocket = new FakeMarketSocket()
    const listTrackedTokens = vi
      .fn<() => Promise<Array<{ marketId: string; tokenId: string }>>>()
      .mockResolvedValue([{ marketId: 'm1', tokenId: 'yes' }])
    const updateFreshness = vi.fn(async () => undefined)
    const insertSnapshot = vi.fn(async () => undefined)

    const loop = createMarketSocketLoop({
      freshnessRepo: {
        updateFreshness,
      },
      logger: createLogger(),
      marketRepo: {
        insertSnapshot,
        listTrackedTokens,
      },
      marketSocket,
    })

    await loop.start()
    updateFreshness.mockClear()

    marketSocket.emit('message', {
      assetId: 'yes',
      bestAsk: 0.51,
      bestBid: 0.49,
      price: 0.5,
      timestamp: 1_743_336_060_000,
    })

    await vi.waitFor(() => {
      expect(updateFreshness).toHaveBeenCalledWith(
        'ws:markets',
        'live',
        'live',
      )
    })
    expect(insertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        marketId: 'm1',
        tokenId: 'yes',
        lastPrice: 0.5,
      }),
    )
  })

  it('schedules only one reconnect when error and close fire in the same cycle', async () => {
    vi.useFakeTimers()

    const marketSocket = new FakeMarketSocket()
    const listTrackedTokens = vi
      .fn<() => Promise<Array<{ marketId: string; tokenId: string }>>>()
      .mockResolvedValue([{ marketId: 'm1', tokenId: 'yes' }])
    const logger = createLogger()
    const updateFreshness = vi.fn(async () => {
      throw new Error('freshness write failed')
    })
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason)
    }

    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const loop = createMarketSocketLoop({
        freshnessRepo: {
          updateFreshness,
        },
        logger,
        marketRepo: {
          insertSnapshot: vi.fn(async () => undefined),
          listTrackedTokens,
        },
        marketSocket,
      })

      await loop.start()
      expect(marketSocket.connectCalls).toEqual([['yes']])

      marketSocket.emit('error', new Error('socket failed'))
      marketSocket.emit('close')
      await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_MS)

      expect(marketSocket.connectCalls).toEqual([['yes'], ['yes']])
      expect(logger.error).toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('reconnects after startup freshness writes fail without leaking rejections', async () => {
    vi.useFakeTimers()

    const marketSocket = new FakeMarketSocket()
    const listTrackedTokens = vi
      .fn<() => Promise<Array<{ marketId: string; tokenId: string }>>>()
      .mockRejectedValueOnce(new Error('bootstrap failed'))
      .mockResolvedValueOnce([{ marketId: 'm1', tokenId: 'yes' }])
    const logger = createLogger()
    const updateFreshness = vi.fn(async () => {
      throw new Error('freshness write failed')
    })
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason)
    }

    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const loop = createMarketSocketLoop({
        freshnessRepo: {
          updateFreshness,
        },
        logger,
        marketRepo: {
          insertSnapshot: vi.fn(async () => undefined),
          listTrackedTokens,
        },
        marketSocket,
      })

      await loop.start()
      expect(marketSocket.connectCalls).toEqual([])

      await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_MS)

      expect(marketSocket.connectCalls).toEqual([['yes']])
      expect(logger.error).toHaveBeenCalled()
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('refreshes live subscriptions without waiting for a reconnect', async () => {
    const marketSocket = new FakeMarketSocket()
    const listTrackedTokens = vi
      .fn<() => Promise<Array<{ marketId: string; tokenId: string }>>>()
      .mockResolvedValueOnce([{ marketId: 'm1', tokenId: 'yes' }])
      .mockResolvedValueOnce([
        { marketId: 'm1', tokenId: 'yes' },
        { marketId: 'm2', tokenId: 'no' },
      ])
    const updateFreshness = vi.fn(async () => undefined)

    const loop = createMarketSocketLoop({
      freshnessRepo: {
        updateFreshness,
      },
      logger: createLogger(),
      marketRepo: {
        insertSnapshot: vi.fn(async () => undefined),
        listTrackedTokens,
      },
      marketSocket,
    })

    await loop.start()
    expect(marketSocket.connectCalls).toEqual([['yes']])

    await loop.refreshSubscriptions()

    expect(marketSocket.connectCalls).toEqual([['yes']])
    expect(marketSocket.subscribeCalls).toEqual([['no']])
    expect(marketSocket.unsubscribeCalls).toEqual([])
    expect(marketSocket.disconnectCalls).toBe(0)
  })

  it('retries a failed refresh with the same pending token diff', async () => {
    const marketSocket = new FakeMarketSocket()
    const listTrackedTokens = vi
      .fn<() => Promise<Array<{ marketId: string; tokenId: string }>>>()
      .mockResolvedValueOnce([{ marketId: 'm1', tokenId: 'yes' }])
      .mockResolvedValue([
        { marketId: 'm1', tokenId: 'yes' },
        { marketId: 'm2', tokenId: 'no' },
      ])
    const logger = createLogger()
    const updateFreshness = vi.fn(async () => undefined)
    const subscribe = vi
      .spyOn(marketSocket, 'subscribe')
      .mockImplementationOnce(() => {
        throw new Error('socket not open')
      })

    const loop = createMarketSocketLoop({
      freshnessRepo: {
        updateFreshness,
      },
      logger,
      marketRepo: {
        insertSnapshot: vi.fn(async () => undefined),
        listTrackedTokens,
      },
      marketSocket,
    })

    await loop.start()
    expect(marketSocket.connectCalls).toEqual([['yes']])

    await loop.refreshSubscriptions()
    await loop.refreshSubscriptions()

    expect(subscribe).toHaveBeenNthCalledWith(1, ['no'])
    expect(subscribe).toHaveBeenNthCalledWith(2, ['no'])
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(updateFreshness).toHaveBeenCalledWith(
      'ws:markets',
      'degraded',
      'degraded',
    )
  })
})
