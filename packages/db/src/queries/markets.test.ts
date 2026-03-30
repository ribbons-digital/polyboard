import { describe, expect, it } from 'vitest'
import {
  getRemovedTokenIds,
  getRetiredMarketIds,
} from './markets'

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
