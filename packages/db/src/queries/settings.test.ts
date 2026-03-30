import { describe, expect, it, vi } from 'vitest'
import { ensureSettingsRow, upsertWatchlistEntry } from './settings'
import { wallets, walletWatchlists } from '../schema'

describe('ensureSettingsRow', () => {
  it('returns the inserted singleton row when no settings row exists yet', async () => {
    const insertedRow = {
      id: 1,
      minMarketVolume: 50000,
      scoreWeights: {
        marketStructure: 0.4,
        smartMoney: 0.4,
        timing: 0.2,
      },
      trackedCategories: [],
      updatedAt: new Date('2026-03-30T00:00:00.000Z'),
    }

    const selectSpy = vi.fn()
    const db = {
      insert() {
        return {
          values() {
            return {
              onConflictDoNothing() {
                return {
                  returning: vi.fn().mockResolvedValue([insertedRow]),
                }
              },
            }
          },
        }
      },
      select: selectSpy,
    }

    await expect(ensureSettingsRow(db as never)).resolves.toEqual(insertedRow)
    expect(selectSpy).not.toHaveBeenCalled()
  })

  it('falls back to selecting the existing singleton row when insert does nothing', async () => {
    const existingRow = {
      id: 1,
      minMarketVolume: 75000,
      scoreWeights: {
        marketStructure: 0.5,
        smartMoney: 0.3,
        timing: 0.2,
      },
      trackedCategories: ['politics'],
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    }

    const whereSpy = vi.fn().mockResolvedValue([existingRow])
    const fromSpy = vi.fn(() => ({
      where: whereSpy,
    }))
    const selectSpy = vi.fn(() => ({
      from: fromSpy,
    }))
    const db = {
      insert() {
        return {
          values() {
            return {
              onConflictDoNothing() {
                return {
                  returning: vi.fn().mockResolvedValue([]),
                }
              },
            }
          },
        }
      },
      select: selectSpy,
    }

    await expect(ensureSettingsRow(db as never)).resolves.toEqual(existingRow)
    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(fromSpy).toHaveBeenCalledTimes(1)
    expect(whereSpy).toHaveBeenCalledTimes(1)
  })
})

describe('upsertWatchlistEntry', () => {
  it('ensures a wallet row exists before upserting a watchlist entry for an unseen address', async () => {
    const callOrder: string[] = []
    const walletConflictSpy = vi.fn().mockResolvedValue(undefined)
    const watchlistConflictSpy = vi.fn().mockResolvedValue(undefined)

    const tx = {
      insert(table: unknown) {
        return {
          values(values: Record<string, unknown>) {
            if (table === wallets) {
              callOrder.push('wallets')
              expect(values).toMatchObject({
                address: '0xabc',
              })
              expect(values.updatedAt).toBeInstanceOf(Date)

              return {
                onConflictDoNothing(options: { target: unknown }) {
                  expect(options.target).toBeDefined()
                  return walletConflictSpy()
                },
              }
            }

            if (table === walletWatchlists) {
              callOrder.push('wallet_watchlists')
              expect(values).toMatchObject({
                address: '0xabc',
                note: 'manual add',
                isExcluded: true,
              })
              expect(values.createdAt).toBeInstanceOf(Date)
              expect(values.updatedAt).toBeInstanceOf(Date)

              return {
                onConflictDoUpdate(options: { target: unknown; set: Record<string, unknown> }) {
                  expect(options.target).toBeDefined()
                  expect(options.set).toMatchObject({
                    note: 'manual add',
                    isExcluded: true,
                  })
                  expect(options.set.updatedAt).toBeInstanceOf(Date)
                  return watchlistConflictSpy()
                },
              }
            }

            throw new Error('unexpected table')
          },
        }
      },
    }

    const transactionSpy = vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => {
      await callback(tx)
    })
    const db = {
      transaction: transactionSpy,
    }

    await upsertWatchlistEntry(db as never, {
      address: '0xabc',
      note: 'manual add',
      isExcluded: true,
    })

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(walletConflictSpy).toHaveBeenCalledTimes(1)
    expect(watchlistConflictSpy).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['wallets', 'wallet_watchlists'])
  })
})
