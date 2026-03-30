import { describe, expect, it, vi } from 'vitest'
import {
  bootstrapWorkerData,
  shouldRunFallbackSeed,
} from './bootstrap'

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
})

describe('bootstrapWorkerData', () => {
  it('returns live and marks live when live bootstrap succeeds', async () => {
    const markFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)
    const runLiveBootstrap = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => {
          throw new Error('should not be called')
        },
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
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => ({
          hasFreshnessRows: false,
          hasMarketScores: false,
          hasWalletScores: false,
        }),
        markFreshness,
        runFallbackSeed: seedFallback,
        runLiveBootstrap: vi.fn(async () => {
          throw new Error('gamma unavailable')
        }),
      }),
    ).resolves.toBe('fallback')

    expect(markFreshness).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledWith('fallback')
    expect(seedFallback).toHaveBeenCalledTimes(1)
  })

  it('returns degraded and marks degraded when live bootstrap fails and data is already usable', async () => {
    const markFreshness = vi.fn(async () => undefined)
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => ({
          hasFreshnessRows: true,
          hasMarketScores: true,
          hasWalletScores: true,
        }),
        markFreshness,
        runFallbackSeed: seedFallback,
        runLiveBootstrap: vi.fn(async () => {
          throw new Error('gamma unavailable')
        }),
      }),
    ).resolves.toBe('degraded')

    expect(markFreshness).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledWith('degraded')
    expect(seedFallback).not.toHaveBeenCalled()
  })

  it('does not trigger fallback seeding when marking live freshness fails', async () => {
    const markFreshness = vi.fn(async (status: 'live' | 'fallback' | 'degraded') => {
      if (status === 'live') {
        throw new Error('freshness store unavailable')
      }
    })
    const seedFallback = vi.fn(async () => undefined)

    await expect(
      bootstrapWorkerData({
        checkUsableData: async () => {
          throw new Error('should not be called')
        },
        markFreshness,
        runFallbackSeed: seedFallback,
        runLiveBootstrap: vi.fn(async () => undefined),
      }),
    ).rejects.toThrow('Failed to mark live freshness after bootstrap')

    expect(markFreshness).toHaveBeenCalledTimes(1)
    expect(markFreshness).toHaveBeenCalledWith('live')
    expect(seedFallback).not.toHaveBeenCalled()
  })
})
