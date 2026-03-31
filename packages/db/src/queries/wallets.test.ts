import { describe, expect, it, vi } from 'vitest'
import { upsertWalletProfiles } from './wallets'
import { wallets } from '../schema'

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
