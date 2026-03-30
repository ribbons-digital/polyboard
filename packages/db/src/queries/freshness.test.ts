import { describe, expect, it } from 'vitest'
import { summarizeDashboardUsability } from './freshness'

describe('summarizeDashboardUsability', () => {
  it('requires matched market and wallet score rows plus fresh core freshness rows', () => {
    expect(
      summarizeDashboardUsability({
        freshnessRows: [
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'gamma:markets',
            status: 'live',
          },
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'data:wallets',
            status: 'live',
          },
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'scores:markets',
            status: 'live',
          },
        ],
        marketScoreRows: [{ marketId: 'm1' }],
        walletScoreRows: [{ walletAddress: '0xabc' }],
        now: new Date('2026-03-30T12:00:00.000Z'),
      }),
    ).toEqual({
      hasFreshnessRows: true,
      hasMarketScores: true,
      hasWalletScores: true,
    })
  })

  it('counts stale freshness rows as present for bootstrap usability', () => {
    expect(
      summarizeDashboardUsability({
        freshnessRows: [
          {
            asOf: new Date('2026-03-30T11:49:50.000Z'),
            sourceKey: 'gamma:markets',
            status: 'live',
          },
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'data:wallets',
            status: 'live',
          },
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'scores:markets',
            status: 'live',
          },
        ],
        marketScoreRows: [{ marketId: 'm1' }],
        walletScoreRows: [{ walletAddress: '0xabc' }],
        now: new Date('2026-03-30T12:00:00.000Z'),
      }),
    ).toEqual({
      hasFreshnessRows: true,
      hasMarketScores: true,
      hasWalletScores: true,
    })
  })

  it('counts degraded freshness rows as present for bootstrap usability', () => {
    expect(
      summarizeDashboardUsability({
        freshnessRows: [
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'gamma:markets',
            status: 'degraded',
          },
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'data:wallets',
            status: 'degraded',
          },
          {
            asOf: new Date('2026-03-30T11:59:50.000Z'),
            sourceKey: 'scores:markets',
            status: 'degraded',
          },
        ],
        marketScoreRows: [{ marketId: 'm1' }],
        walletScoreRows: [{ walletAddress: '0xabc' }],
        now: new Date('2026-03-30T12:00:00.000Z'),
      }),
    ).toEqual({
      hasFreshnessRows: true,
      hasMarketScores: true,
      hasWalletScores: true,
    })
  })
})
