import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('./bootstrap')
  vi.doUnmock('./runtime')
  vi.doUnmock('./scheduler')
  vi.doUnmock('./socket-loop')
})

describe('startWorker', () => {
  it('stops the scheduler and socket loop when socket startup fails', async () => {
    const schedulerStop = vi.fn()
    const socketStop = vi.fn()
    const socketStart = vi.fn(async () => {
      throw new Error('socket startup failed')
    })
    const runtime = {
      dataClient: {},
      db: {},
      env: {
        discoveryIntervalMs: 1_000,
        minMarketVolume: 50_000,
        scoreRefreshIntervalMs: 1_500,
        walletRefreshIntervalMs: 2_000,
      },
      gammaClient: {},
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
      marketSocket: {},
      repos: {
        freshnessRepo: {
          getDashboardUsability: vi.fn(),
          updateFreshness: vi.fn(),
        },
        marketRepo: {},
        walletRepo: {},
      },
      seedFallback: vi.fn(),
      settingsRepo: {
        getSettings: vi.fn(),
      },
    }

    vi.doMock('./runtime', () => ({
      createRuntime: () => runtime,
    }))
    vi.doMock('./bootstrap', () => ({
      runWorkerBootstrap: vi.fn(async () => 'live'),
    }))
    vi.doMock('./scheduler', () => ({
      startRuntimeRefreshScheduler: vi.fn(() => ({
        stop: schedulerStop,
      })),
    }))
    vi.doMock('./socket-loop', () => ({
      createMarketSocketLoop: vi.fn(() => ({
        refreshSubscriptions: vi.fn(async () => undefined),
        start: socketStart,
        stop: socketStop,
      })),
    }))

    const { startWorker } = await import('./index')

    await expect(startWorker()).rejects.toThrow('socket startup failed')

    expect(schedulerStop).toHaveBeenCalledTimes(1)
    expect(socketStop).toHaveBeenCalledTimes(1)
  })
})
