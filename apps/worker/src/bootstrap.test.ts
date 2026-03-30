import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bootstrapWorkerData,
  createLiveBootstrapRunner,
  runWorkerBootstrap,
  shouldRunFallbackSeed,
} from './bootstrap'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('./bootstrap')
  vi.doUnmock('./jobs/analytics')
  vi.doUnmock('./jobs/backfill')
  vi.doUnmock('./jobs/discovery')
  vi.doUnmock('./runtime')
  vi.doUnmock('./scheduler')
  vi.doUnmock('./socket-loop')
  vi.unstubAllGlobals()
})

describe('shouldRunFallbackSeed', () => {
  it('returns true when bootstrap failed and the dashboard tables are unusable', () => {
    expect(
      shouldRunFallbackSeed({
        bootstrapFailed: true,
        hasFreshnessRows: false,
        hasMarketScores: false,
        hasWalletScores: false,
      }),
    ).toBe(true)
  })

  it('returns false when usable dashboard data already exists', () => {
    expect(
      shouldRunFallbackSeed({
        bootstrapFailed: true,
        hasFreshnessRows: true,
        hasMarketScores: true,
        hasWalletScores: true,
      }),
    ).toBe(false)
  })

  it('preserves mixed live and fallback freshness when bootstrap fails again', async () => {
    const getDashboardUsability = vi.fn(async () => ({
      hasFallbackRows: true,
      hasFreshnessRows: true,
      hasMarketScores: true,
      hasWalletScores: true,
    }))
    const updateFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      runWorkerBootstrap(
        {
          repos: {
            freshnessRepo: {
              getDashboardUsability,
              updateFreshness,
            },
            marketRepo: {
              listMarketIdsByConditionIds: vi.fn(),
              listSignalInputs: vi.fn(),
              replaceMarketHolders: vi.fn(),
              replaceTags: vi.fn(),
              upsertMarkets: vi.fn(),
              upsertScore: vi.fn(),
            },
            walletRepo: {
              replaceClosedPositions: vi.fn(),
              replaceOpenPositions: vi.fn(),
              replaceTrades: vi.fn(),
              replaceWalletEventStats: vi.fn(),
              upsertWalletProfiles: vi.fn(),
              upsertWalletScore: vi.fn(),
            },
          },
          seedFallback,
        },
        {
          runLiveBootstrap: vi.fn(async () => {
            throw new Error('gamma unavailable')
          }),
        },
      ),
    ).resolves.toBe('fallback')

    expect(getDashboardUsability).toHaveBeenCalledTimes(1)
    expect(seedFallback).not.toHaveBeenCalled()
    expect(updateFreshness).not.toHaveBeenCalledWith(
      'gamma:markets',
      'fallback',
      'fallback',
    )
    expect(updateFreshness).not.toHaveBeenCalledWith(
      'data:wallets',
      'fallback',
      'fallback',
    )
    expect(updateFreshness).not.toHaveBeenCalledWith(
      'scores:markets',
      'fallback',
      'fallback',
    )
    expect(updateFreshness).toHaveBeenCalledWith(
      'worker:bootstrap',
      'fallback',
      'fallback',
    )
  })

  it('reseeds when fallback freshness exists but dashboard scores are missing', async () => {
    const getDashboardUsability = vi.fn(async () => ({
      hasFallbackRows: true,
      hasFreshnessRows: true,
      hasMarketScores: false,
      hasWalletScores: true,
    }))
    const updateFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      runWorkerBootstrap(
        {
          repos: {
            freshnessRepo: {
              getDashboardUsability,
              updateFreshness,
            },
            marketRepo: {
              listMarketIdsByConditionIds: vi.fn(),
              listSignalInputs: vi.fn(),
              replaceMarketHolders: vi.fn(),
              replaceTags: vi.fn(),
              upsertMarkets: vi.fn(),
              upsertScore: vi.fn(),
            },
            walletRepo: {
              replaceClosedPositions: vi.fn(),
              replaceOpenPositions: vi.fn(),
              replaceTrades: vi.fn(),
              replaceWalletEventStats: vi.fn(),
              upsertWalletProfiles: vi.fn(),
              upsertWalletScore: vi.fn(),
            },
          },
          seedFallback,
        },
        {
          runLiveBootstrap: vi.fn(async () => {
            throw new Error('gamma unavailable')
          }),
        },
      ),
    ).resolves.toBe('fallback')

    expect(getDashboardUsability).toHaveBeenCalledTimes(1)
    expect(seedFallback).toHaveBeenCalledTimes(1)
    expect(updateFreshness).toHaveBeenCalledWith(
      'gamma:markets',
      'fallback',
      'fallback',
    )
    expect(updateFreshness).toHaveBeenCalledWith(
      'worker:bootstrap',
      'fallback',
      'fallback',
    )
  })
})

describe('bootstrapWorkerData', () => {
  it('builds the live bootstrap sequence from runtime discovery, backfill, and recompute helpers', async () => {
    const runtime = {
      dataClient: {
        getClosedPositions: vi.fn(),
        getHolders: vi.fn(),
        getLeaderboard: vi.fn(),
        getPositions: vi.fn(),
        getTrades: vi.fn(),
        getValue: vi.fn(),
      },
      env: { minMarketVolume: 50_000 },
      gammaClient: { getMarketTags: vi.fn(), listMarkets: vi.fn() },
      repos: {
        freshnessRepo: {
          getDashboardUsability: vi.fn(async () => ({
            hasFreshnessRows: true,
            hasMarketScores: true,
            hasWalletScores: true,
          })),
          updateFreshness: vi.fn(async () => undefined),
        },
        marketRepo: {
          listMarketIdsByConditionIds: vi.fn(),
          listSignalInputs: vi.fn(),
          replaceMarketHolders: vi.fn(),
          replaceTags: vi.fn(),
          upsertMarkets: vi.fn(),
          upsertScore: vi.fn(),
        },
        walletRepo: {
          replaceClosedPositions: vi.fn(),
          replaceOpenPositions: vi.fn(),
          replaceTrades: vi.fn(),
          replaceWalletEventStats: vi.fn(),
          upsertWalletProfiles: vi.fn(),
          upsertWalletScore: vi.fn(),
        },
      },
      seedFallback: vi.fn(async () => undefined),
      settingsRepo: {
        getSettings: vi.fn(async () => ({
          scoreWeights: { marketStructure: 0.35, smartMoney: 0.45, timing: 0.2 },
        })),
      },
    }
    const runDiscoveryOnce = vi.fn(async () => [])
    const runBackfillOnce = vi.fn(async () => undefined)
    const recomputeMarketScores = vi.fn(async () => undefined)

    await createLiveBootstrapRunner(runtime, {
      recomputeMarketScores,
      runBackfillOnce,
      runDiscoveryOnce,
    })()

    expect(runDiscoveryOnce).toHaveBeenCalledWith({
      freshnessRepo: runtime.repos.freshnessRepo,
      gammaClient: runtime.gammaClient,
      marketRepo: runtime.repos.marketRepo,
      minVolume: runtime.env.minMarketVolume,
    })
    expect(runBackfillOnce).toHaveBeenCalledWith({
      dataClient: runtime.dataClient,
      freshnessRepo: runtime.repos.freshnessRepo,
      marketRepo: runtime.repos.marketRepo,
      walletRepo: runtime.repos.walletRepo,
    })
    expect(runtime.settingsRepo.getSettings).toHaveBeenCalledTimes(1)
    expect(recomputeMarketScores).toHaveBeenCalledWith({
      freshnessRepo: runtime.repos.freshnessRepo,
      marketRepo: runtime.repos.marketRepo,
      settings: {
        scoreWeights: { marketStructure: 0.35, smartMoney: 0.45, timing: 0.2 },
      },
    })
  })

  it('runs live bootstrap before starting the websocket loop', async () => {
    vi.resetModules()

    const startSocket = vi.fn(async () => undefined)
    const runLiveBootstrap = vi.fn(async () => undefined)
    const runDiscoveryOnce = vi.fn(async () => undefined)
    const runBackfillOnce = vi.fn(async () => undefined)
    const recomputeMarketScores = vi.fn(async () => undefined)

    vi.doMock('./runtime', () => ({
      createRuntime: () => ({
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
            getDashboardUsability: vi.fn(async () => ({
              hasFreshnessRows: true,
              hasMarketScores: true,
              hasWalletScores: true,
            })),
            updateFreshness: vi.fn(async () => undefined),
          },
          marketRepo: {},
          walletRepo: {},
        },
        seedFallback: vi.fn(async () => undefined),
        settingsRepo: {
          getSettings: vi.fn(async () => ({ scoreWeights: {} })),
        },
      }),
    }))
    vi.doMock('./bootstrap', () => ({
      createLiveBootstrapRunner: vi.fn(() => runLiveBootstrap),
      runWorkerBootstrap: vi.fn(async () => {
        await runLiveBootstrap()
        return 'live'
      }),
      bootstrapWorkerData: vi.fn(async () => 'live'),
      shouldRunFallbackSeed: vi.fn(),
    }))
    vi.doMock('./socket-loop', () => ({
      createMarketSocketLoop: () => ({ start: startSocket, stop: vi.fn() }),
    }))
    vi.doMock('./scheduler', () => ({
      startRuntimeRefreshScheduler: vi.fn(() => ({ stop: vi.fn() })),
    }))
    vi.doMock('./jobs/discovery', () => ({
      runDiscoveryOnce,
    }))
    vi.doMock('./jobs/backfill', () => ({
      runBackfillOnce,
    }))
    vi.doMock('./jobs/analytics', () => ({
      recomputeMarketScores,
    }))

    const workerModule = await import('./index')

    expect(workerModule.startWorker).toBeTypeOf('function')

    if (typeof workerModule.startWorker !== 'function') {
      return
    }

    await workerModule.startWorker()

    expect(runLiveBootstrap).toHaveBeenCalledBefore(startSocket)
  })

  it('uses runtime freshness checks and seed fallback when coordinated bootstrap fails live discovery', async () => {
    const getDashboardUsability = vi.fn(async () => ({
      hasFreshnessRows: false,
      hasMarketScores: false,
      hasWalletScores: false,
    }))
    const updateFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      runWorkerBootstrap(
        {
          repos: {
            freshnessRepo: {
              getDashboardUsability,
              updateFreshness,
            },
            marketRepo: {
              listMarketIdsByConditionIds: vi.fn(),
              listSignalInputs: vi.fn(),
              replaceMarketHolders: vi.fn(),
              replaceTags: vi.fn(),
              upsertMarkets: vi.fn(),
              upsertScore: vi.fn(),
            },
            walletRepo: {
              replaceClosedPositions: vi.fn(),
              replaceOpenPositions: vi.fn(),
              replaceTrades: vi.fn(),
              replaceWalletEventStats: vi.fn(),
              upsertWalletProfiles: vi.fn(),
              upsertWalletScore: vi.fn(),
            },
        },
        seedFallback,
      },
      {
        runLiveBootstrap: vi.fn(async () => {
          throw new Error('gamma unavailable')
        }),
      },
    ),
    ).resolves.toBe('fallback')

    expect(getDashboardUsability).toHaveBeenCalledTimes(1)
    expect(seedFallback).toHaveBeenCalledTimes(1)
    expect(updateFreshness).toHaveBeenCalledWith(
      'gamma:markets',
      'fallback',
      'fallback',
    )
    expect(updateFreshness).toHaveBeenCalledWith(
      'data:wallets',
      'fallback',
      'fallback',
    )
    expect(updateFreshness).toHaveBeenCalledWith(
      'scores:markets',
      'fallback',
      'fallback',
    )
    expect(updateFreshness).toHaveBeenCalledWith(
      'worker:bootstrap',
      'fallback',
      'fallback',
    )
  })

  it('uses runtime helpers to decide whether dashboard data is usable', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => [],
      ok: true,
      status: 200,
      statusText: 'OK',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { createRuntime } = await import('./runtime')
    const runtime = createRuntime({
      DATABASE_URL: 'postgres://polyboard:polyboard@localhost:5432/polyboard',
      POLYBOARD_DATA_URL: 'https://data-api.polymarket.com',
    })

    expect(runtime.dataClient).toBeDefined()
    expect(runtime.repos.marketRepo.listSignalInputs).toBeTypeOf('function')
    expect(runtime.repos.marketRepo.upsertScore).toBeTypeOf('function')
    expect(runtime.repos.freshnessRepo.getDashboardUsability).toBeTypeOf('function')

    await runtime.dataClient.getLeaderboard()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://data-api.polymarket.com/v1/leaderboard',
      undefined,
    )

    vi.unstubAllGlobals()
  })

  it('returns live and marks live when live bootstrap succeeds', async () => {
    const markFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)
    const runLiveBootstrap = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => {
          throw new Error('should not be called')
        },
        markCoreFreshness: vi.fn(async () => undefined),
        markFreshness,
        runFallbackSeed: seedFallback,
        runLiveBootstrap,
      }),
    ).resolves.toBe('live')

    expect(runLiveBootstrap).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledWith('live')
    expect(seedFallback).not.toHaveBeenCalled()
  })

  it('returns fallback, runs seed, and marks fallback when live bootstrap fails and data is unusable', async () => {
    const markFreshness = vi.fn(async () => undefined)
    const markCoreFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => ({
          hasFreshnessRows: false,
          hasMarketScores: false,
          hasWalletScores: false,
        }),
        markCoreFreshness,
        markFreshness,
        runFallbackSeed: seedFallback,
        runLiveBootstrap: vi.fn(async () => {
          throw new Error('gamma unavailable')
        }),
      }),
    ).resolves.toBe('fallback')

    expect(markFreshness).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledWith('fallback')
    expect(markCoreFreshness).toHaveBeenCalledTimes(1)
    expect(markCoreFreshness).toHaveBeenCalledWith('fallback')
    expect(seedFallback).toHaveBeenCalledTimes(1)
  })

  it('returns degraded and marks degraded when live bootstrap fails and data is already usable', async () => {
    const markFreshness = vi.fn(async () => undefined)
    const markCoreFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => ({
          hasFreshnessRows: true,
          hasMarketScores: true,
          hasWalletScores: true,
        }),
        markCoreFreshness,
        markFreshness,
        runFallbackSeed: seedFallback,
        runLiveBootstrap: vi.fn(async () => {
          throw new Error('gamma unavailable')
        }),
      }),
    ).resolves.toBe('degraded')

    expect(markFreshness).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledWith('degraded')
    expect(markCoreFreshness).toHaveBeenCalledTimes(1)
    expect(markCoreFreshness).toHaveBeenCalledWith('degraded')
    expect(seedFallback).not.toHaveBeenCalled()
  })

  it('preserves the live bootstrap error when checkUsableData fails during fallback decision making', async () => {
    const bootstrapError = new Error('gamma unavailable')
    const decisionError = new Error('freshness lookup failed')
    const markCoreFreshness = vi.fn(async () => undefined)
    const markFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)

    const result = bootstrapWorkerData({
      checkUsableData: async () => {
        throw decisionError
      },
      markCoreFreshness,
      markFreshness,
      runFallbackSeed: seedFallback,
      runLiveBootstrap: vi.fn(async () => {
        throw bootstrapError
      }),
    })

    await expect(result).rejects.toBeInstanceOf(AggregateError)

    try {
      await result
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toEqual([
        bootstrapError,
        decisionError,
      ])
    }

    expect(markFreshness).not.toHaveBeenCalled()
    expect(markCoreFreshness).not.toHaveBeenCalled()
    expect(seedFallback).not.toHaveBeenCalled()
  })

  it('does not trigger fallback seeding when marking live freshness fails', async () => {
    const markFailure = new Error('freshness store unavailable')
    const markCoreFreshness = vi.fn(async () => undefined)
    const markFreshness = vi.fn(async (status: 'live' | 'fallback' | 'degraded') => {
      if (status === 'live') {
        throw markFailure
      }
    })
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => {
          throw new Error('should not be called')
        },
        markCoreFreshness,
        markFreshness,
        runFallbackSeed: seedFallback,
        runLiveBootstrap: vi.fn(async () => undefined),
      }),
    ).rejects.toMatchObject({
      cause: markFailure,
      message: 'Failed to mark live freshness after bootstrap',
    })

    expect(markFreshness).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledWith('live')
    expect(markCoreFreshness).not.toHaveBeenCalled()
    expect(seedFallback).not.toHaveBeenCalled()
  })
})
