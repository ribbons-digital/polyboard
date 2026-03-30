import { describe, expect, it, vi } from 'vitest'
import { runDiscoveryOnce } from './discovery'

describe('runDiscoveryOnce', () => {
  it('upserts only active open markets above the volume threshold, replaces tags, and marks freshness', async () => {
    const listMarkets = vi.fn(async () => [
      {
        id: 'm1',
        conditionId: 'c1',
        question: 'Will BTC close above $100k?',
        slug: 'btc-above-100k',
        active: true,
        closed: false,
        volume: 75_000,
        liquidity: 12_000,
        category: 'Crypto',
        endDate: '2026-03-31T00:00:00.000Z',
        tokens: [{ id: 'yes', outcome: 'Yes', outcomeIndex: 0 }],
      },
      {
        id: 'm2',
        conditionId: 'c2',
        question: 'Inactive market',
        slug: 'inactive-market',
        active: false,
        closed: false,
        volume: 120_000,
        liquidity: 22_000,
        category: 'Politics',
        endDate: null,
        tokens: [{ id: 'no', outcome: 'No', outcomeIndex: 0 }],
      },
      {
        id: 'm3',
        conditionId: 'c3',
        question: 'Closed market',
        slug: 'closed-market',
        active: true,
        closed: true,
        volume: 120_000,
        liquidity: 19_000,
        category: 'Sports',
        endDate: null,
        tokens: [{ id: 'closed', outcome: 'Closed', outcomeIndex: 0 }],
      },
      {
        id: 'm4',
        conditionId: 'c4',
        question: 'Low volume market',
        slug: 'low-volume-market',
        active: true,
        closed: false,
        volume: 1_000,
        liquidity: 1_500,
        category: 'Crypto',
        endDate: null,
        tokens: [{ id: 'low', outcome: 'Low', outcomeIndex: 0 }],
      },
    ])
    const upsertMarkets = vi.fn(async () => undefined)
    const replaceTags = vi.fn(async () => undefined)
    const updateFreshness = vi.fn(async () => undefined)

    await runDiscoveryOnce({
      minVolume: 50_000,
      gammaClient: {
        listMarkets,
        getMarketTags: async (marketId: string) =>
          marketId === 'm1'
            ? [
                { slug: 'crypto', label: 'Crypto' },
                { slug: 'btc', label: 'BTC' },
              ]
            : [],
      },
      marketRepo: {
        upsertMarkets,
        replaceTags,
      },
      freshnessRepo: {
        updateFreshness,
      },
    })

    expect(listMarkets).toHaveBeenCalledWith({
      active: true,
      closed: false,
      limit: 500,
    })
    expect(upsertMarkets).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'm1',
        active: true,
        closed: false,
        volume: 75_000,
      }),
    ])
    expect(replaceTags).toHaveBeenCalledTimes(1)
    expect(replaceTags).toHaveBeenCalledWith('m1', [
      { slug: 'crypto', label: 'Crypto' },
      { slug: 'btc', label: 'BTC' },
    ])
    expect(updateFreshness).toHaveBeenCalledWith('gamma:markets', 'live')
  })

  it('continues discovery when one market tag fetch is rate-limited', async () => {
    const upsertMarkets = vi.fn(async () => undefined)
    const replaceTags = vi.fn(async () => undefined)
    const updateFreshness = vi.fn(async () => undefined)

    await expect(
      runDiscoveryOnce({
        minVolume: 50_000,
        gammaClient: {
          listMarkets: async () => [
            {
              id: 'm1',
              conditionId: 'c1',
              question: 'Market 1',
              slug: 'market-1',
              active: true,
              closed: false,
              volume: 75_000,
              liquidity: 12_000,
              category: 'Crypto',
              endDate: null,
              tokens: [{ id: 'yes', outcome: 'Yes', outcomeIndex: 0 }],
            },
            {
              id: 'm2',
              conditionId: 'c2',
              question: 'Market 2',
              slug: 'market-2',
              active: true,
              closed: false,
              volume: 82_000,
              liquidity: 9_000,
              category: 'Politics',
              endDate: null,
              tokens: [{ id: 'no', outcome: 'No', outcomeIndex: 0 }],
            },
          ],
          getMarketTags: async (marketId: string) => {
            if (marketId === 'm2') {
              throw new Error('Polymarket request failed: 429 Too Many Requests')
            }

            return [{ slug: 'crypto', label: 'Crypto' }]
          },
        },
        marketRepo: {
          upsertMarkets,
          replaceTags,
        },
        freshnessRepo: {
          updateFreshness,
        },
      }),
    ).resolves.toHaveLength(2)

    expect(upsertMarkets).toHaveBeenCalledTimes(1)
    expect(replaceTags).toHaveBeenCalledWith('m1', [
      { slug: 'crypto', label: 'Crypto' },
    ])
    expect(replaceTags).toHaveBeenCalledWith('m2', [])
    expect(updateFreshness).toHaveBeenCalledWith('gamma:markets', 'live')
  })
})
