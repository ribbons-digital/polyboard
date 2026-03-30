import { describe, expect, it, vi } from 'vitest'
import { runBackfillOnce } from './backfill'

describe('runBackfillOnce', () => {
  it('marks wallet data live after a successful backfill run', async () => {
    const updateFreshness = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getPositions: async () => [],
        getClosedPositions: async () => [],
        getTrades: async () => [],
        getHolders: async () => [],
        getValue: async () => [{ value: 12 }],
      },
      freshnessRepo: {
        updateFreshness,
      },
      marketRepo: {
        listMarketIdsByConditionIds: async () => new Map(),
        replaceMarketHolders: vi.fn(async () => undefined),
      },
      walletRepo: {
        replaceClosedPositions: vi.fn(async () => undefined),
        replaceOpenPositions: vi.fn(async () => undefined),
        replaceTrades: vi.fn(async () => undefined),
        replaceWalletEventStats: vi.fn(async () => undefined),
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(updateFreshness).toHaveBeenCalledWith('data:wallets', 'live')
  })

  it('requests the top 50 leaderboard rows and maps documented profile fields', async () => {
    const getLeaderboard = vi.fn(async () => [
      {
        profileImage: 'https://example.com/avatar.png',
        proxyWallet: '0xwallet',
        userName: 'alice',
        verifiedBadge: true,
      },
    ])
    const upsertWalletProfiles = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard,
        getPositions: async () => [],
        getClosedPositions: async () => [],
        getTrades: async () => [],
        getHolders: async () => [],
        getValue: async () => [{ value: 12 }],
      },
      marketRepo: {
        listMarketIdsByConditionIds: async () => new Map(),
        replaceMarketHolders: vi.fn(async () => undefined),
      },
      walletRepo: {
        replaceClosedPositions: vi.fn(async () => undefined),
        replaceOpenPositions: vi.fn(async () => undefined),
        replaceTrades: vi.fn(async () => undefined),
        replaceWalletEventStats: vi.fn(async () => undefined),
        upsertWalletProfiles,
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(getLeaderboard).toHaveBeenCalledWith({ limit: 50 })
    expect(upsertWalletProfiles).toHaveBeenCalledWith([
      expect.objectContaining({
        address: '0xwallet',
        displayName: 'alice',
        profileImage: 'https://example.com/avatar.png',
        verified: true,
      }),
    ])
  })

  it('paginates positions/trades and disables taker-only trade filtering', async () => {
    const getPositions = vi
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, () => ({
          asset: 'token-1',
          avgPrice: 0.45,
          conditionId: '0xcondition',
          currentValue: 8,
          outcome: 'Yes',
          realizedPnl: 1,
          size: 10,
          totalPnl: 2,
        })),
      )
      .mockResolvedValueOnce([])
    const getClosedPositions = vi
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 50 }, () => ({
          asset: 'token-1',
          avgPrice: 0.45,
          conditionId: '0xcondition',
          eventSlug: 'event-a',
          outcome: 'Yes',
          realizedPnl: 7,
          timestamp: 1_700_000_000,
          totalBought: 10,
        })),
      )
      .mockResolvedValueOnce([])
    const getTrades = vi
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, () => ({
          asset: 'token-1',
          conditionId: '0xcondition',
          eventSlug: 'event-a',
          price: 0.55,
          proxyWallet: '0xwallet',
          side: 'BUY',
          size: 10,
          timestamp: 1_700_000_000,
          transactionHash: crypto.randomUUID(),
        })),
      )
      .mockResolvedValueOnce([])

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getPositions,
        getClosedPositions,
        getTrades,
        getHolders: async () => [],
        getValue: async () => [{ value: 12 }],
      },
      marketRepo: {
        listMarketIdsByConditionIds: async () =>
          new Map([['0xcondition', 'market-1']]),
        replaceMarketHolders: vi.fn(async () => undefined),
      },
      walletRepo: {
        replaceClosedPositions: vi.fn(async () => undefined),
        replaceOpenPositions: vi.fn(async () => undefined),
        replaceTrades: vi.fn(async () => undefined),
        replaceWalletEventStats: vi.fn(async () => undefined),
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(getPositions).toHaveBeenNthCalledWith(1, {
      limit: 500,
      offset: 0,
      user: '0xwallet',
    })
    expect(getPositions).toHaveBeenNthCalledWith(2, {
      limit: 500,
      offset: 500,
      user: '0xwallet',
    })
    expect(getClosedPositions).toHaveBeenNthCalledWith(1, {
      limit: 50,
      offset: 0,
      user: '0xwallet',
    })
    expect(getClosedPositions).toHaveBeenNthCalledWith(2, {
      limit: 50,
      offset: 50,
      user: '0xwallet',
    })
    expect(getTrades).toHaveBeenNthCalledWith(1, {
      limit: 500,
      offset: 0,
      takerOnly: false,
      user: '0xwallet',
    })
    expect(getTrades).toHaveBeenNthCalledWith(2, {
      limit: 500,
      offset: 500,
      takerOnly: false,
      user: '0xwallet',
    })
  })

  it('treats high-offset trade 400 responses as pagination exhaustion', async () => {
    const updateFreshness = vi.fn(async () => undefined)
    const getTrades = vi.fn(
      async (query?: Record<string, string | number | boolean | undefined>) => {
        const offset = Number(query?.offset ?? 0)

        if (offset < 3_500) {
          return Array.from({ length: 500 }, (_, index) => ({
            asset: 'token-1',
            conditionId: `0xcondition-${offset}-${index}`,
            eventSlug: 'event-a',
            price: 0.55,
            proxyWallet: '0xwallet',
            side: 'BUY',
            size: 10,
            timestamp: 1_700_000_000 + index,
            transactionHash: `0xtrade-${offset}-${index}`,
          }))
        }

        throw new Error('Polymarket request failed: 400 Bad Request')
      },
    )

    await expect(
      runBackfillOnce({
        dataClient: {
          getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
          getPositions: async () => [],
          getClosedPositions: async () => [],
          getTrades,
          getHolders: async () => [],
          getValue: async () => [{ value: 12 }],
        },
        freshnessRepo: {
          updateFreshness,
        },
        marketRepo: {
          listMarketIdsByConditionIds: async () => new Map(),
          replaceMarketHolders: vi.fn(async () => undefined),
        },
        walletRepo: {
          replaceClosedPositions: vi.fn(async () => undefined),
          replaceOpenPositions: vi.fn(async () => undefined),
          replaceTrades: vi.fn(async () => undefined),
          replaceWalletEventStats: vi.fn(async () => undefined),
          upsertWalletProfiles: vi.fn(async () => undefined),
          upsertWalletScore: vi.fn(async () => undefined),
        },
      }),
    ).resolves.toBeUndefined()

    expect(updateFreshness).toHaveBeenCalledWith('data:wallets', 'live')
    expect(getTrades).toHaveBeenCalledWith({
      limit: 500,
      offset: 3_500,
      takerOnly: false,
      user: '0xwallet',
    })
  })

  it('treats high-offset trade 429 responses as pagination exhaustion', async () => {
    const updateFreshness = vi.fn(async () => undefined)
    const getTrades = vi.fn(
      async (query?: Record<string, string | number | boolean | undefined>) => {
        const offset = Number(query?.offset ?? 0)

        if (offset < 3_500) {
          return Array.from({ length: 500 }, (_, index) => ({
            asset: 'token-1',
            conditionId: `0xcondition-${offset}-${index}`,
            eventSlug: 'event-a',
            price: 0.55,
            proxyWallet: '0xwallet',
            side: 'BUY',
            size: 10,
            timestamp: 1_700_000_000 + index,
            transactionHash: `0xtrade-${offset}-${index}`,
          }))
        }

        throw new Error('Polymarket request failed: 429 Too Many Requests')
      },
    )

    await expect(
      runBackfillOnce({
        dataClient: {
          getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
          getPositions: async () => [],
          getClosedPositions: async () => [],
          getTrades,
          getHolders: async () => [],
          getValue: async () => [{ value: 12 }],
        },
        freshnessRepo: {
          updateFreshness,
        },
        marketRepo: {
          listMarketIdsByConditionIds: async () => new Map(),
          replaceMarketHolders: vi.fn(async () => undefined),
        },
        walletRepo: {
          replaceClosedPositions: vi.fn(async () => undefined),
          replaceOpenPositions: vi.fn(async () => undefined),
          replaceTrades: vi.fn(async () => undefined),
          replaceWalletEventStats: vi.fn(async () => undefined),
          upsertWalletProfiles: vi.fn(async () => undefined),
          upsertWalletScore: vi.fn(async () => undefined),
        },
      }),
    ).resolves.toBeUndefined()

    expect(updateFreshness).toHaveBeenCalledWith('data:wallets', 'live')
    expect(getTrades).toHaveBeenCalledWith({
      limit: 500,
      offset: 3_500,
      takerOnly: false,
      user: '0xwallet',
    })
  })

  it('continues with other wallets when one wallet backfill is rate-limited', async () => {
    const replaceOpenPositions = vi.fn(async () => undefined)
    const updateFreshness = vi.fn(async () => undefined)

    await expect(
      runBackfillOnce({
        dataClient: {
          getLeaderboard: async () => [
            { proxyWallet: '0xrate' },
            { proxyWallet: '0xok' },
          ],
          getPositions: async (query) => {
            if (query.user === '0xrate') {
              throw new Error('Polymarket request failed: 429 Too Many Requests')
            }

            return []
          },
          getClosedPositions: async () => [],
          getTrades: async () => [],
          getHolders: async () => [],
          getValue: async () => [{ value: 12 }],
        },
        freshnessRepo: {
          updateFreshness,
        },
        marketRepo: {
          listMarketIdsByConditionIds: async () => new Map(),
          replaceMarketHolders: vi.fn(async () => undefined),
        },
        walletRepo: {
          replaceClosedPositions: vi.fn(async () => undefined),
          replaceOpenPositions,
          replaceTrades: vi.fn(async () => undefined),
          replaceWalletEventStats: vi.fn(async () => undefined),
          upsertWalletProfiles: vi.fn(async () => undefined),
          upsertWalletScore: vi.fn(async () => undefined),
        },
      }),
    ).resolves.toBeUndefined()

    expect(replaceOpenPositions).toHaveBeenCalledWith('0xok', [])
    expect(updateFreshness).toHaveBeenCalledWith('data:wallets', 'live')
  })

  it('persists nested market holder responses for mapped condition ids', async () => {
    const replaceMarketHolders = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getPositions: async () => [],
        getClosedPositions: async () => [],
        getTrades: async () => [
          {
            asset: 'token-1',
            conditionId: '0xcondition',
            eventSlug: 'event-a',
            price: 0.55,
            proxyWallet: '0xwallet',
            side: 'BUY',
            size: 10,
            timestamp: 1_700_000_000,
            transactionHash: '0xtrade',
          },
        ],
        getHolders: async () => [
          {
            holders: [
              {
                amount: 42,
                asset: 'token-1',
                proxyWallet: '0xholder',
              },
            ],
            token: 'token-1',
          },
        ],
        getValue: async () => [{ value: 12 }],
      },
      marketRepo: {
        listMarketIdsByConditionIds: async () =>
          new Map([['0xcondition', 'market-1']]),
        replaceMarketHolders,
      },
      walletRepo: {
        replaceClosedPositions: vi.fn(async () => undefined),
        replaceOpenPositions: vi.fn(async () => undefined),
        replaceTrades: vi.fn(async () => undefined),
        replaceWalletEventStats: vi.fn(async () => undefined),
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(replaceMarketHolders).toHaveBeenCalledWith('market-1', [
      {
        currentValue: undefined,
        size: 42,
        tokenId: 'token-1',
        walletAddress: '0xholder',
      },
    ])
  })

  it('refreshes market holders for markets seen only in positions', async () => {
    const replaceMarketHolders = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getPositions: async () => [
          {
            asset: 'token-1',
            avgPrice: 0.45,
            conditionId: '0xcondition',
            currentValue: 8,
            outcome: 'Yes',
            realizedPnl: 1,
            size: 10,
            totalPnl: 2,
          },
        ],
        getClosedPositions: async () => [],
        getTrades: async () => [],
        getHolders: async () => [
          {
            holders: [
              {
                amount: 42,
                asset: 'token-1',
                proxyWallet: '0xholder',
              },
            ],
            token: 'token-1',
          },
        ],
        getValue: async () => [{ value: 12 }],
      },
      marketRepo: {
        listMarketIdsByConditionIds: async () =>
          new Map([['0xcondition', 'market-1']]),
        replaceMarketHolders,
      },
      walletRepo: {
        replaceClosedPositions: vi.fn(async () => undefined),
        replaceOpenPositions: vi.fn(async () => undefined),
        replaceTrades: vi.fn(async () => undefined),
        replaceWalletEventStats: vi.fn(async () => undefined),
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(replaceMarketHolders).toHaveBeenCalledWith('market-1', [
      {
        currentValue: undefined,
        size: 42,
        tokenId: 'token-1',
        walletAddress: '0xholder',
      },
    ])
  })

  it('skips malformed trade timestamps instead of coercing them to now', async () => {
    const replaceTrades = vi.fn(async () => undefined)
    const replaceWalletEventStats = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getPositions: async () => [],
        getClosedPositions: async () => [],
        getTrades: async () => [
          {
            asset: 'token-1',
            conditionId: '0xcondition',
            price: 0.55,
            proxyWallet: '0xwallet',
            side: 'BUY',
            size: 10,
            timestamp: 'not-a-timestamp',
            transactionHash: '0xtrade',
          },
        ],
        getHolders: async () => [],
        getValue: async () => [{ value: 12 }],
      },
      marketRepo: {
        listMarketIdsByConditionIds: async () =>
          new Map([['0xcondition', 'market-1']]),
        replaceMarketHolders: vi.fn(async () => undefined),
      },
      walletRepo: {
        replaceClosedPositions: vi.fn(async () => undefined),
        replaceOpenPositions: vi.fn(async () => undefined),
        replaceTrades,
        replaceWalletEventStats,
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(replaceTrades).toHaveBeenCalledWith('0xwallet', [])
    expect(replaceWalletEventStats).toHaveBeenCalledWith('0xwallet', [])
  })

  it('builds event stats using trade counts and closed-position realized pnl', async () => {
    const replaceWalletEventStats = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getPositions: async () => [],
        getClosedPositions: async () => [
          {
            asset: 'token-1',
            avgPrice: 0.45,
            conditionId: '0xcondition',
            eventSlug: 'event-a',
            outcome: 'Yes',
            realizedPnl: 7,
            timestamp: 1_700_000_000,
            totalBought: 10,
          },
        ],
        getTrades: async () => [
          {
            asset: 'token-1',
            conditionId: '0xcondition',
            eventSlug: 'event-a',
            price: 0.55,
            proxyWallet: '0xwallet',
            side: 'BUY',
            size: 10,
            timestamp: 1_700_000_000,
            transactionHash: '0xtrade',
          },
        ],
        getHolders: async () => [],
        getValue: async () => [{ value: 12 }],
      },
      marketRepo: {
        listMarketIdsByConditionIds: async () =>
          new Map([['0xcondition', 'market-1']]),
        replaceMarketHolders: vi.fn(async () => undefined),
      },
      walletRepo: {
        replaceClosedPositions: vi.fn(async () => undefined),
        replaceOpenPositions: vi.fn(async () => undefined),
        replaceTrades: vi.fn(async () => undefined),
        replaceWalletEventStats,
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(replaceWalletEventStats).toHaveBeenCalledWith('0xwallet', [
      {
        eventSlug: 'event-a',
        realizedPnl: 7,
        totalVolume: 10,
        tradeCount: 1,
      },
    ])
  })
})
