import { describe, expect, it } from 'vitest'
import { parseDatabaseEnv } from './env'

describe('parseDatabaseEnv', () => {
  it('requires DATABASE_URL', () => {
    expect(() => parseDatabaseEnv({})).toThrowError(/DATABASE_URL/)
  })

  it('applies sane defaults for optional thresholds', () => {
    expect(
      parseDatabaseEnv({
        DATABASE_URL: 'postgres://polyboard:polyboard@localhost:5432/polyboard',
      }),
    ).toMatchObject({
      minMarketVolume: 50000,
      backfillBatchSize: 20,
    })
  })
})
