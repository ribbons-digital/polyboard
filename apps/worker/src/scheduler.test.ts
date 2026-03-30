import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  startRefreshScheduler,
  startRuntimeRefreshScheduler,
} from './scheduler'

describe('startRefreshScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps retrying failed jobs without stopping sibling jobs', async () => {
    vi.useFakeTimers()

    const discovery = vi.fn(async () => undefined)
    const backfill = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('data api down'))
      .mockResolvedValue(undefined)
    const recompute = vi.fn(async () => undefined)

    const scheduler = startRefreshScheduler({
      runDiscovery: discovery,
      runWalletBackfill: backfill,
      runScoreRefresh: recompute,
      discoveryIntervalMs: 1_000,
      walletIntervalMs: 2_000,
      scoreIntervalMs: 1_500,
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    })

    await vi.advanceTimersByTimeAsync(2_500)

    expect(discovery).toHaveBeenCalled()
    expect(backfill).toHaveBeenCalledTimes(2)
    expect(recompute).toHaveBeenCalled()

    scheduler.stop()
  })

  it('builds recurring jobs from runtime helpers', async () => {
    vi.useFakeTimers()

    const runtime = {
      dataClient: {
        getClosedPositions: vi.fn(),
        getHolders: vi.fn(),
        getLeaderboard: vi.fn(),
        getPositions: vi.fn(),
        getTrades: vi.fn(),
        getValue: vi.fn(),
      },
      env: {
        discoveryIntervalMs: 1_000,
        minMarketVolume: 50_000,
        scoreRefreshIntervalMs: 1_500,
        walletRefreshIntervalMs: 2_000,
      },
      gammaClient: { getMarketTags: vi.fn(), listMarkets: vi.fn() },
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
      repos: {
        freshnessRepo: { updateFreshness: vi.fn(async () => undefined) },
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
      settingsRepo: {
        getSettings: vi.fn(async () => ({
          scoreWeights: { marketStructure: 0.3, smartMoney: 0.5, timing: 0.2 },
        })),
      },
    }
    const runDiscoveryOnce = vi.fn(async () => [])
    const runBackfillOnce = vi.fn(async () => undefined)
    const recomputeMarketScores = vi.fn(async () => undefined)

    const scheduler = startRuntimeRefreshScheduler(runtime, {
      recomputeMarketScores,
      runBackfillOnce,
      runDiscoveryOnce,
    })

    await vi.advanceTimersByTimeAsync(2_500)

    expect(runDiscoveryOnce).toHaveBeenCalledWith({
      freshnessRepo: runtime.repos.freshnessRepo,
      gammaClient: runtime.gammaClient,
      marketRepo: runtime.repos.marketRepo,
      minVolume: runtime.env.minMarketVolume,
    })
    expect(runBackfillOnce).toHaveBeenCalledWith({
      dataClient: runtime.dataClient,
      marketRepo: runtime.repos.marketRepo,
      walletRepo: runtime.repos.walletRepo,
    })
    expect(recomputeMarketScores).toHaveBeenCalledWith({
      marketRepo: runtime.repos.marketRepo,
      settings: {
        scoreWeights: { marketStructure: 0.3, smartMoney: 0.5, timing: 0.2 },
      },
    })

    scheduler.stop()
  })
})
