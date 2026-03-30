import { describe, expect, it, vi } from 'vitest'
import {
  replaceOpenPositions,
  replaceTrades,
  replaceWalletEventStats,
  upsertWalletProfiles,
} from './wallets'
import {
  walletEventStats,
  walletPositionsOpen,
  walletTrades,
  wallets,
} from '../schema'

describe('upsertWalletProfiles', () => {
  it('preserves existing optional fields when an update omits them', async () => {
    const conflictSpy = vi.fn().mockResolvedValue(undefined)
    const db = {
      insert(table: unknown) {
        expect(table).toBe(wallets)

        return {
          values(values: Record<string, unknown>) {
            expect(values).toMatchObject({
              address: '0xwallet',
            })

            return {
              onConflictDoUpdate(options: {
                target: unknown
                set: Record<string, unknown>
              }) {
                expect(options.target).toBeDefined()
                expect(options.set).toMatchObject({
                  updatedAt: expect.any(Date),
                })
                expect(options.set).not.toHaveProperty('displayName')
                expect(options.set).not.toHaveProperty('profileImage')
                expect(options.set).not.toHaveProperty('verified')
                return conflictSpy()
              },
            }
          },
        }
      },
    }

    await upsertWalletProfiles(db as never, [{ address: '0xwallet' }])

    expect(conflictSpy).toHaveBeenCalledTimes(1)
  })
})

describe('replaceOpenPositions', () => {
  it('replaces rows inside a transaction', async () => {
    const callOrder: string[] = []
    const deleteWhereSpy = vi.fn(async () => {
      callOrder.push('delete')
    })
    const insertValuesSpy = vi.fn(async () => {
      callOrder.push('insert')
    })
    const tx = {
      delete(table: unknown) {
        expect(table).toBe(walletPositionsOpen)

        return {
          where: deleteWhereSpy,
        }
      },
      insert(table: unknown) {
        expect(table).toBe(walletPositionsOpen)

        return {
          values: insertValuesSpy,
        }
      },
    }
    const transactionSpy = vi.fn(
      async (callback: (transaction: typeof tx) => Promise<void>) => {
        await callback(tx)
      },
    )
    const db = {
      transaction: transactionSpy,
    }

    await replaceOpenPositions(db as never, '0xwallet', [
      {
        averagePrice: 0.5,
        currentValue: 10,
        marketId: 'market-1',
        outcome: 'Yes',
        realizedPnl: 1,
        size: 20,
        tokenId: 'token-1',
        totalPnl: 2,
      },
    ])

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1)
    expect(insertValuesSpy).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['delete', 'insert'])
  })
})

describe('replaceTrades', () => {
  it('clears existing wallet trades before reinserting fills from the latest backfill inside a transaction', async () => {
    const deleteWhereSpy = vi.fn().mockResolvedValue(undefined)
    const insertedRows: Array<Record<string, unknown>> = []
    const tx = {
      delete(table: unknown) {
        expect(table).toBe(walletTrades)

        return {
          where: deleteWhereSpy,
        }
      },
      insert(table: unknown) {
        expect(table).toBe(walletTrades)

        return {
          values(values: Record<string, unknown>) {
            insertedRows.push(values)
            return Promise.resolve()
          },
        }
      },
    }
    const transactionSpy = vi.fn(
      async (callback: (transaction: typeof tx) => Promise<void>) => {
        await callback(tx)
      },
    )

    const db = {
      transaction: transactionSpy,
    }

    await replaceTrades(db as never, '0xwallet', [
      {
        marketId: 'market-1',
        price: 0.55,
        side: 'BUY',
        size: 10,
        tokenId: 'token-1',
        tradedAt: new Date('2026-03-30T00:00:00.000Z'),
        transactionHash: '0xshared',
      },
      {
        marketId: 'market-1',
        price: 0.56,
        side: 'BUY',
        size: 5,
        tokenId: 'token-2',
        tradedAt: new Date('2026-03-30T00:00:01.000Z'),
        transactionHash: '0xshared',
      },
    ])

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1)
    expect(insertedRows).toHaveLength(2)
  })
})

describe('replaceWalletEventStats', () => {
  it('replaces event stats inside a transaction', async () => {
    const deleteWhereSpy = vi.fn().mockResolvedValue(undefined)
    const insertValuesSpy = vi.fn().mockResolvedValue(undefined)
    const tx = {
      delete(table: unknown) {
        expect(table).toBe(walletEventStats)

        return {
          where: deleteWhereSpy,
        }
      },
      insert(table: unknown) {
        expect(table).toBe(walletEventStats)

        return {
          values: insertValuesSpy,
        }
      },
    }
    const transactionSpy = vi.fn(
      async (callback: (transaction: typeof tx) => Promise<void>) => {
        await callback(tx)
      },
    )
    const db = {
      transaction: transactionSpy,
    }

    await replaceWalletEventStats(db as never, '0xwallet', [
      {
        eventSlug: 'event-a',
        realizedPnl: 4,
        totalVolume: 10,
        tradeCount: 2,
      },
    ])

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1)
    expect(insertValuesSpy).toHaveBeenCalledTimes(1)
  })
})
