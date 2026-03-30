import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  startRefreshScheduler,
  startRuntimeRefreshScheduler,
} from './scheduler'

describe('startRefreshScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits until the first interval tick before running recurring jobs', async () => {
    vi.useFakeTimers()

    const discovery = vi.fn(async () => undefined)
    const backfill = vi.fn(async () => undefined)
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

    expect(discovery).not.toHaveBeenCalled()
    expect(backfill).not.toHaveBeenCalled()
    expect(recompute).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(999)

    expect(discovery).not.toHaveBeenCalled()
    expect(backfill).not.toHaveBeenCalled()
    expect(recompute).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(discovery).toHaveBeenCalledTimes(1)
    expect(backfill).not.toHaveBeenCalled()
    expect(recompute).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)

    expect(recompute).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(500)

    expect(backfill).toHaveBeenCalledTimes(1)

    scheduler.stop()
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

    await vi.advanceTimersByTimeAsync(4_100)

    expect(discovery).toHaveBeenCalledTimes(4)
    expect(backfill).toHaveBeenCalledTimes(2)
    expect(recompute).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('serializes each recurring job independently when a run takes too long', async () => {
    vi.useFakeTimers()

    let resolveDiscovery: () => void = () => undefined
    const discovery = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDiscovery = resolve
        }),
    )
    const backfill = vi.fn(async () => undefined)
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

    await vi.advanceTimersByTimeAsync(1_000)

    expect(discovery).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(3_000)

    expect(discovery).toHaveBeenCalledTimes(1)
    expect(backfill).toHaveBeenCalledTimes(2)
    expect(recompute).toHaveBeenCalledTimes(2)

    resolveDiscovery()
    await vi.advanceTimersByTimeAsync(0)

    expect(discovery).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('does not run a queued rerun after stop is called', async () => {
    vi.useFakeTimers()

    let resolveDiscovery: () => void = () => undefined
    const discovery = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDiscovery = resolve
        }),
    )

    const scheduler = startRefreshScheduler({
      runDiscovery: discovery,
      runWalletBackfill: vi.fn(async () => undefined),
      runScoreRefresh: vi.fn(async () => undefined),
      discoveryIntervalMs: 1_000,
      walletIntervalMs: 2_000,
      scoreIntervalMs: 1_500,
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    })

    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(discovery).toHaveBeenCalledTimes(1)

    scheduler.stop()
    resolveDiscovery()
    await vi.advanceTimersByTimeAsync(0)

    expect(discovery).toHaveBeenCalledTimes(1)
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
        backfillBatchSize: 50,
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
    const refreshSocketSubscriptions = vi.fn(async () => undefined)

    const scheduler = startRuntimeRefreshScheduler(runtime, {
      recomputeMarketScores,
      runBackfillOnce,
      runDiscoveryOnce,
      refreshSocketSubscriptions,
    })

    expect(runDiscoveryOnce).not.toHaveBeenCalled()
    expect(runBackfillOnce).not.toHaveBeenCalled()
    expect(recomputeMarketScores).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(999)

    expect(runDiscoveryOnce).not.toHaveBeenCalled()
    expect(runBackfillOnce).not.toHaveBeenCalled()
    expect(recomputeMarketScores).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(runDiscoveryOnce).toHaveBeenCalledWith({
      freshnessRepo: runtime.repos.freshnessRepo,
      gammaClient: runtime.gammaClient,
      logger: runtime.logger,
      marketRepo: runtime.repos.marketRepo,
      minVolume: runtime.env.minMarketVolume,
    })
    expect(refreshSocketSubscriptions).toHaveBeenCalledTimes(1)
    expect(runBackfillOnce).not.toHaveBeenCalled()
    expect(recomputeMarketScores).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)

    expect(recomputeMarketScores).toHaveBeenCalledWith({
      freshnessRepo: runtime.repos.freshnessRepo,
      marketRepo: runtime.repos.marketRepo,
      settings: {
        scoreWeights: { marketStructure: 0.3, smartMoney: 0.5, timing: 0.2 },
      },
    })

    await vi.advanceTimersByTimeAsync(500)

    expect(runBackfillOnce).toHaveBeenCalledWith({
      dataClient: runtime.dataClient,
      freshnessRepo: runtime.repos.freshnessRepo,
      maxWallets: runtime.env.backfillBatchSize,
      marketRepo: runtime.repos.marketRepo,
      walletRepo: runtime.repos.walletRepo,
    })

    scheduler.stop()
  })

  it('marks a source degraded when its recurring job fails', async () => {
    vi.useFakeTimers()

    const updateFreshness = vi.fn(async () => undefined)
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
        backfillBatchSize: 50,
        discoveryIntervalMs: 1_000,
        minMarketVolume: 50_000,
        scoreRefreshIntervalMs: 1_500,
        walletRefreshIntervalMs: 2_000,
      },
      gammaClient: { getMarketTags: vi.fn(), listMarkets: vi.fn() },
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
      repos: {
        freshnessRepo: { updateFreshness },
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

    const scheduler = startRuntimeRefreshScheduler(runtime, {
      recomputeMarketScores: vi.fn(async () => {
        throw new Error('score refresh failed')
      }),
      runBackfillOnce: vi.fn(async () => {
        throw new Error('wallet backfill failed')
      }),
      runDiscoveryOnce: vi.fn(async () => {
        throw new Error('discovery failed')
      }),
    })

    await vi.advanceTimersByTimeAsync(2_000)

    expect(updateFreshness).toHaveBeenCalledWith(
      'gamma:markets',
      'degraded',
      'degraded',
    )
    expect(updateFreshness).toHaveBeenCalledWith(
      'scores:markets',
      'degraded',
      'degraded',
    )
    expect(updateFreshness).toHaveBeenCalledWith(
      'data:wallets',
      'degraded',
      'degraded',
    )

    scheduler.stop()
  })
})
