import { describe, expect, it, vi } from 'vitest'
import {
  filterTrackedTokens,
  getRemovedTokenIds,
  getRetiredMarketIds,
  upsertMarkets,
} from './markets'
import { markets, tokens } from '../schema'

describe('getRetiredMarketIds', () => {
  it('returns active tracked markets that are missing from the latest tracked set', () => {
    expect(
      getRetiredMarketIds(['m1', 'm2', 'm3'], ['m1', 'm3']),
    ).toEqual(['m2'])
  })

  it('returns every active market when the latest tracked set is empty', () => {
    expect(getRetiredMarketIds(['m1', 'm2'], [])).toEqual(['m1', 'm2'])
  })
})

describe('getRemovedTokenIds', () => {
  it('returns token ids that should be pruned for a market before resubscribe', () => {
    expect(
      getRemovedTokenIds(['yes', 'no', 'maybe'], ['yes', 'maybe']),
    ).toEqual(['no'])
  })
})

describe('filterTrackedTokens', () => {
  it('returns only rows that are active at both the market and token level', () => {
    expect(
      filterTrackedTokens([
        {
          marketActive: true,
          marketId: 'm1',
          tokenActive: true,
          tokenId: 'yes',
        },
        {
          marketActive: true,
          marketId: 'm1',
          tokenActive: false,
          tokenId: 'no',
        },
        {
          marketActive: false,
          marketId: 'm2',
          tokenActive: true,
          tokenId: 'later',
        },
      ]),
    ).toEqual([{ marketId: 'm1', tokenId: 'yes' }])
  })
})

describe('upsertMarkets', () => {
  it('marks removed tokens inactive instead of deleting them', async () => {
    const activeMarketWhereSpy = vi.fn().mockResolvedValue([{ id: 'm1' }])
    const existingTokenWhereSpy = vi.fn().mockResolvedValue([
      { id: 'yes' },
      { id: 'no' },
    ])
    const tokenUpdateWhereSpy = vi.fn().mockResolvedValue(undefined)
    const marketUpdateWhereSpy = vi.fn().mockResolvedValue(undefined)
    const deleteSpy = vi.fn()
    let selectCallCount = 0

    const tx = {
      delete: deleteSpy,
      insert(table: unknown) {
        return {
          values(values: Record<string, unknown>) {
            if (table === markets) {
              expect(values).toMatchObject({
                active: true,
                id: 'm1',
              })

              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
              }
            }

            if (table === tokens) {
              expect(values).toMatchObject({
                marketId: 'm1',
              })

              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
              }
            }

            throw new Error('unexpected table')
          },
        }
      },
      select() {
        selectCallCount += 1

        return {
          from() {
            return {
              where:
                selectCallCount === 1
                  ? activeMarketWhereSpy
                  : existingTokenWhereSpy,
            }
          },
        }
      },
      update(table: unknown) {
        return {
          set(values: Record<string, unknown>) {
            if (table === tokens) {
              expect(values).toMatchObject({ active: false })
              expect(values.updatedAt).toBeUndefined()

              return {
                where: tokenUpdateWhereSpy,
              }
            }

            if (table === markets) {
              return {
                where: marketUpdateWhereSpy,
              }
            }

            throw new Error('unexpected table')
          },
        }
      },
    }
    const db = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => {
        await callback(tx)
      }),
    }

    await upsertMarkets(db as never, [
      {
        active: true,
        category: 'Crypto',
        closed: false,
        conditionId: 'c1',
        endDate: null,
        id: 'm1',
        liquidity: 12345,
        question: 'Will BTC stay above 100k?',
        slug: 'btc-above-100k',
        tokens: [{ id: 'yes', outcome: 'Yes', outcomeIndex: 0 }],
        volume: 98765,
      },
    ])

    expect(activeMarketWhereSpy).toHaveBeenCalledTimes(1)
    expect(existingTokenWhereSpy).toHaveBeenCalledTimes(1)
    expect(tokenUpdateWhereSpy).toHaveBeenCalledTimes(1)
    expect(marketUpdateWhereSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
