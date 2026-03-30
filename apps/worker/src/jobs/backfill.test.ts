import { describe, expect, it, vi } from 'vitest'
import { runBackfillOnce } from './backfill'

describe('runBackfillOnce', () => {
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

  it('skips malformed trade timestamps instead of coercing them to now', async () => {
    const replaceTrades = vi.fn(async () => undefined)

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
        replaceWalletEventStats: vi.fn(async () => undefined),
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(replaceTrades).toHaveBeenCalledWith('0xwallet', [])
  })
})
