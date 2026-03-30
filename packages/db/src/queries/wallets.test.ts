import { describe, expect, it, vi } from 'vitest'
import { replaceTrades } from './wallets'
import { walletTrades } from '../schema'

describe('replaceTrades', () => {
  it('clears existing wallet trades before reinserting fills from the latest backfill', async () => {
    const deleteWhereSpy = vi.fn().mockResolvedValue(undefined)
    const insertedRows: Array<Record<string, unknown>> = []

    const db = {
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

    expect(deleteWhereSpy).toHaveBeenCalledTimes(1)
    expect(insertedRows).toHaveLength(2)
  })
})
