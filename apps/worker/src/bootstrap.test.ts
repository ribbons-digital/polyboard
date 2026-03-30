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
  it('runs the fallback seed when live bootstrap fails and data is unusable', async () => {
    const seedFallback = vi.fn(async () => undefined)

    await bootstrapWorkerData({
      checkUsableData: async () => ({
        hasFreshnessRows: false,
        hasMarketScores: false,
        hasWalletScores: false,
      }),
      markFreshness: vi.fn(async () => undefined),
      runFallbackSeed: seedFallback,
      runLiveBootstrap: vi.fn(async () => {
        throw new Error('gamma unavailable')
      }),
    })

    expect(seedFallback).toHaveBeenCalledTimes(1)
  })
})
