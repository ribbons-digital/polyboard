import { describe, expect, it } from 'vitest'
import { summarizeFreshness } from './service'

describe('summarizeFreshness', () => {
  it('reports live when all core sources are live', () => {
    expect(
      summarizeFreshness([
        { sourceKey: 'gamma:markets', status: 'live' },
        { sourceKey: 'data:wallets', status: 'live' },
        { sourceKey: 'scores:markets', status: 'live' },
      ]),
    ).toEqual({
      label: 'live',
      message: 'Live Polymarket data is flowing through the worker.',
    })
  })

  it('reports fallback when any source is fallback', () => {
    expect(
      summarizeFreshness([
        { sourceKey: 'gamma:markets', status: 'live' },
        { sourceKey: 'data:wallets', status: 'fallback' },
        { sourceKey: 'scores:markets', status: 'live' },
      ]),
    ).toEqual({
      label: 'fallback',
      message: 'Using fallback seed data because live bootstrap failed.',
    })
  })

  it('reports degraded when the core sources are not all live and none are fallback', () => {
    expect(
      summarizeFreshness([
        { sourceKey: 'gamma:markets', status: 'live' },
        { sourceKey: 'data:wallets', status: 'degraded' },
        { sourceKey: 'scores:markets', status: 'live' },
      ]),
    ).toEqual({
      label: 'degraded',
      message: 'Some live sources are stale or unavailable.',
    })
  })
})
