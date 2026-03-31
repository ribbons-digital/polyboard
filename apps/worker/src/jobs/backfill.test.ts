import { describe, expect, it, vi } from 'vitest'
import { runBackfillOnce } from './backfill'

describe('runBackfillOnce', () => {
  it('marks wallet data live after a successful backfill run', async () => {
    const updateFreshness = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getValue: async () => [{ realizedPnl: 100, totalPnl: 200, winRate: 60 }],
      },
      freshnessRepo: {
        updateFreshness,
      },
      walletRepo: {
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(updateFreshness).toHaveBeenCalledWith('data:wallets', 'live')
  })

  it('requests the top 20 leaderboard rows and maps documented profile fields', async () => {
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
        getValue: async () => [{ totalPnl: 100 }],
      },
      walletRepo: {
        upsertWalletProfiles,
        upsertWalletScore: vi.fn(async () => undefined),
      },
    })

    expect(getLeaderboard).toHaveBeenCalledWith({ limit: 20 })
    expect(upsertWalletProfiles).toHaveBeenCalledWith([
      expect.objectContaining({
        address: '0xwallet',
        displayName: 'alice',
        profileImage: 'https://example.com/avatar.png',
        verified: true,
      }),
    ])
  })

  it('upserts wallet scores with summary data from getValue', async () => {
    const upsertWalletScore = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getValue: async () => [
          {
            realizedPnl: 5000,
            unrealizedPnl: 1000,
            totalPnl: 6000,
            winRate: 75,
            averagePositionSize: 500,
          },
        ],
      },
      walletRepo: {
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore,
      },
    })

    expect(upsertWalletScore).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: '0xwallet',
        realizedPnl: 5000,
        unrealizedPnl: 1000,
        totalPnl: 6000,
        winRate: 0.75,
        averagePositionSize: 500,
        completeness: 'backfilled',
      }),
    )
  })

  it('derives wallet tags based on performance metrics', async () => {
    const upsertWalletScore = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
        getValue: async () => [
          {
            totalPnl: 50000,
            winRate: 65,
            averagePositionSize: 2000,
          },
        ],
      },
      walletRepo: {
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore,
      },
    })

    expect(upsertWalletScore).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining(['high-performer', 'consistent', 'high-conviction']),
      }),
    )
  })

  it('throws when all wallets are rate-limited', async () => {
    const rateLimitError = new Error('429 Too Many Requests')

    await expect(
      runBackfillOnce({
        dataClient: {
          getLeaderboard: async () => [{ proxyWallet: '0xwallet' }],
          getValue: async () => {
            throw rateLimitError
          },
        },
        walletRepo: {
          upsertWalletProfiles: vi.fn(async () => undefined),
          upsertWalletScore: vi.fn(async () => undefined),
        },
      }),
    ).rejects.toThrow('Wallet backfill was rate-limited for all selected wallets')
  })

  it('continues processing other wallets when one is rate-limited', async () => {
    const rateLimitError = new Error('429 Too Many Requests')
    const upsertWalletScore = vi.fn(async () => undefined)

    await runBackfillOnce({
      dataClient: {
        getLeaderboard: async () => [
          { proxyWallet: '0xwallet1' },
          { proxyWallet: '0xwallet2' },
        ],
        getValue: vi.fn(async () => [{ totalPnl: 100 }]),
      },
      walletRepo: {
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore,
      },
    })

    // Both wallets should be processed since none threw
    expect(upsertWalletScore).toHaveBeenCalledTimes(2)
  })

  it('respects maxWallets parameter', async () => {
    const getLeaderboard = vi.fn(async () => [
      { proxyWallet: '0xwallet1' },
      { proxyWallet: '0xwallet2' },
      { proxyWallet: '0xwallet3' },
    ])
    const upsertWalletScore = vi.fn(async () => undefined)

    await runBackfillOnce({
      maxWallets: 2,
      dataClient: {
        getLeaderboard,
        getValue: async () => [{ totalPnl: 100 }],
      },
      walletRepo: {
        upsertWalletProfiles: vi.fn(async () => undefined),
        upsertWalletScore,
      },
    })

    expect(getLeaderboard).toHaveBeenCalledWith({ limit: 2 })
  })
})
