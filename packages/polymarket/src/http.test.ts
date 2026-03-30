import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchJson,
  getRateLimitProfile,
  parseRetryAfterMs,
} from './http'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('getRateLimitProfile', () => {
  it('uses strict profile for Data API position endpoints', () => {
    expect(
      getRateLimitProfile('https://data-api.polymarket.com/positions'),
    ).toMatchObject({
      key: 'data:positions',
      maxConcurrent: 2,
      minTimeMs: 80,
    })

    expect(
      getRateLimitProfile('https://data-api.polymarket.com/closed-positions'),
    ).toMatchObject({
      key: 'data:positions',
      maxConcurrent: 2,
      minTimeMs: 80,
    })
  })

  it('uses strict profile for Gamma market tag endpoints', () => {
    expect(
      getRateLimitProfile('https://gamma-api.polymarket.com/tags'),
    ).toMatchObject({
      key: 'gamma:tags',
      maxConcurrent: 2,
      minTimeMs: 80,
    })

    expect(
      getRateLimitProfile(
        'https://gamma-api.polymarket.com/markets/123456/tags',
      ),
    ).toMatchObject({
      key: 'gamma:tags',
      maxConcurrent: 2,
      minTimeMs: 80,
    })
  })
})

describe('parseRetryAfterMs', () => {
  it('parses numeric Retry-After headers as seconds', () => {
    expect(parseRetryAfterMs('1.5', 0)).toBe(1500)
  })

  it('parses HTTP-date Retry-After headers', () => {
    const now = Date.parse('2026-03-31T00:00:00.000Z')
    const retryAt = new Date(now + 2000).toUTCString()

    expect(parseRetryAfterMs(retryAt, now)).toBe(2000)
  })
})

describe('fetchJson', () => {
  it('retries once on 429 when Retry-After is zero and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'retry-after': '0' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchJson<{ ok: boolean }>('https://data-api.polymarket.com/positions'),
    ).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry on non-retryable status codes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('missing', {
        status: 404,
        statusText: 'Not Found',
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchJson('https://data-api.polymarket.com/positions'),
    ).rejects.toThrow('404 Not Found')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
