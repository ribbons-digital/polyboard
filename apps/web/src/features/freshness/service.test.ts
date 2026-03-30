import { describe, expect, it } from 'vitest'
import { summarizeFreshness } from './service'

describe('summarizeFreshness', () => {
  it('reports live when all core sources are live', () => {
    const now = new Date('2026-03-30T12:00:30.000Z')
    expect(
      summarizeFreshness([
        {
          asOf: new Date('2026-03-30T12:00:00.000Z'),
          sourceKey: 'gamma:markets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:10.000Z'),
          sourceKey: 'data:wallets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:20.000Z'),
          sourceKey: 'scores:markets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:25.000Z'),
          sourceKey: 'ws:markets',
          status: 'live',
        },
      ], now),
    ).toEqual({
      label: 'live',
      message: 'Live Polymarket data is flowing through the worker.',
    })
  })

  it('normalizes legacy fresh core rows to live', () => {
    const now = new Date('2026-03-30T12:00:30.000Z')
    expect(
      summarizeFreshness([
        {
          asOf: new Date('2026-03-30T12:00:00.000Z'),
          sourceKey: 'gamma:markets',
          status: 'fresh',
        },
        {
          asOf: new Date('2026-03-30T12:00:10.000Z'),
          sourceKey: 'data:wallets',
          status: 'fresh',
        },
        {
          asOf: new Date('2026-03-30T12:00:20.000Z'),
          sourceKey: 'scores:markets',
          status: 'fresh',
        },
        {
          asOf: new Date('2026-03-30T12:00:25.000Z'),
          sourceKey: 'ws:markets',
          status: 'fresh',
        },
      ], now),
    ).toEqual({
      label: 'live',
      message: 'Live Polymarket data is flowing through the worker.',
    })
  })

  it('marks stale core rows degraded even when their status is live', () => {
    expect(
      summarizeFreshness(
        [
          {
            sourceKey: 'gamma:markets',
            status: 'live',
            asOf: new Date('2026-03-30T11:49:00.000Z'),
          },
          {
            sourceKey: 'data:wallets',
            status: 'live',
            asOf: new Date('2026-03-30T11:59:00.000Z'),
          },
          {
            sourceKey: 'scores:markets',
            status: 'live',
            asOf: new Date('2026-03-30T11:59:30.000Z'),
          },
        ],
        new Date('2026-03-30T12:00:00.000Z'),
      ),
    ).toEqual({
      label: 'degraded',
      message: 'Some live sources are stale or unavailable.',
    })
  })

  it('marks a stale websocket row degraded even when the core rows are live', () => {
    const now = new Date('2026-03-30T12:00:30.000Z')
    expect(
      summarizeFreshness([
        {
          asOf: new Date('2026-03-30T12:00:00.000Z'),
          sourceKey: 'gamma:markets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:10.000Z'),
          sourceKey: 'data:wallets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:20.000Z'),
          sourceKey: 'scores:markets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T11:57:00.000Z'),
          sourceKey: 'ws:markets',
          status: 'live',
        },
      ], now),
    ).toEqual({
      label: 'degraded',
      message: 'Some live sources are stale or unavailable.',
    })
  })

  it('reports fallback when a core source is fallback', () => {
    const now = new Date('2026-03-30T12:00:30.000Z')
    expect(
      summarizeFreshness([
        {
          asOf: new Date('2026-03-30T12:00:00.000Z'),
          sourceKey: 'gamma:markets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:10.000Z'),
          sourceKey: 'data:wallets',
          status: 'fallback',
        },
        {
          asOf: new Date('2026-03-30T12:00:20.000Z'),
          sourceKey: 'scores:markets',
          status: 'live',
        },
      ], now),
    ).toEqual({
      label: 'fallback',
      message: 'Using fallback seed data because live bootstrap failed.',
    })
  })

  it('ignores fallback rows outside the core sources', () => {
    const now = new Date('2026-03-30T12:00:30.000Z')
    expect(
      summarizeFreshness([
        {
          asOf: new Date('2026-03-30T12:00:00.000Z'),
          sourceKey: 'gamma:markets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:10.000Z'),
          sourceKey: 'data:wallets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:20.000Z'),
          sourceKey: 'scores:markets',
          status: 'live',
        },
        {
          asOf: new Date('2026-03-30T12:00:25.000Z'),
          sourceKey: 'ws:markets',
          status: 'live',
        },
        { sourceKey: 'worker:bootstrap', status: 'fallback' },
      ], now),
    ).toEqual({
      label: 'live',
      message: 'Live Polymarket data is flowing through the worker.',
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
