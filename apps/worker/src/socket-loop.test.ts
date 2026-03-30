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

    const loop = createMarketSocketLoop({
      logger: createLogger(),
      marketRepo: {
        insertSnapshot: vi.fn(async () => undefined),
        listTrackedTokens,
      },
      marketSocket,
    })

    await loop.start()
    expect(marketSocket.connectCalls).toEqual([['yes']])

    marketSocket.emit('close')
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_MS)

    expect(marketSocket.connectCalls).toEqual([['yes'], ['no']])
  })

  it('schedules only one reconnect when error and close fire in the same cycle', async () => {
    vi.useFakeTimers()

    const marketSocket = new FakeMarketSocket()
    const listTrackedTokens = vi
      .fn<() => Promise<Array<{ marketId: string; tokenId: string }>>>()
      .mockResolvedValue([{ marketId: 'm1', tokenId: 'yes' }])
    const logger = createLogger()

    const loop = createMarketSocketLoop({
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
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledTimes(1)
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

    const loop = createMarketSocketLoop({
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
    const subscribe = vi
      .spyOn(marketSocket, 'subscribe')
      .mockImplementationOnce(() => {
        throw new Error('socket not open')
      })

    const loop = createMarketSocketLoop({
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
  })
})
