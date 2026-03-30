import Bottleneck from 'bottleneck'

export interface RateLimitProfile {
  key: string
  maxConcurrent: number
  minTimeMs: number
}

const DEFAULT_RATE_LIMIT_PROFILE: RateLimitProfile = {
  key: 'default',
  maxConcurrent: 4,
  minTimeMs: 25,
}

const MAX_RETRY_ATTEMPTS = 4
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])
const MAX_BACKOFF_MS = 8_000
const BASE_BACKOFF_MS = 500

const limiterByProfile = new Map<string, Bottleneck>()

function toUrl(value: string | URL) {
  return value instanceof URL ? value : new URL(value)
}

function isGammaTagsPath(pathname: string) {
  return pathname === '/tags' || /^\/markets\/[^/]+\/tags$/.test(pathname)
}

export function getRateLimitProfile(url: string | URL): RateLimitProfile {
  const parsedUrl = toUrl(url)
  const hostname = parsedUrl.hostname
  const pathname = parsedUrl.pathname

  // https://docs.polymarket.com/api-reference/rate-limits
  // We intentionally stay below documented ceilings to avoid burst-driven
  // throttling and keep bootstrap/backfill stable.
  if (hostname === 'data-api.polymarket.com') {
    if (pathname === '/positions' || pathname === '/closed-positions') {
      return {
        key: 'data:positions',
        maxConcurrent: 2,
        minTimeMs: 80,
      }
    }

    if (pathname === '/trades') {
      return {
        key: 'data:trades',
        maxConcurrent: 2,
        minTimeMs: 60,
      }
    }

    if (pathname === '/ok') {
      return {
        key: 'data:ok',
        maxConcurrent: 1,
        minTimeMs: 120,
      }
    }

    return {
      key: 'data:general',
      maxConcurrent: 3,
      minTimeMs: 20,
    }
  }

  if (hostname === 'gamma-api.polymarket.com') {
    if (isGammaTagsPath(pathname)) {
      return {
        key: 'gamma:tags',
        maxConcurrent: 2,
        minTimeMs: 80,
      }
    }

    if (pathname === '/markets') {
      return {
        key: 'gamma:markets',
        maxConcurrent: 3,
        minTimeMs: 40,
      }
    }

    if (pathname === '/events') {
      return {
        key: 'gamma:events',
        maxConcurrent: 3,
        minTimeMs: 25,
      }
    }

    return {
      key: 'gamma:general',
      maxConcurrent: 4,
      minTimeMs: 10,
    }
  }

  if (hostname === 'clob.polymarket.com') {
    return {
      key: 'clob:general',
      maxConcurrent: 4,
      minTimeMs: 10,
    }
  }

  return DEFAULT_RATE_LIMIT_PROFILE
}

function getLimiter(profile: RateLimitProfile) {
  const existing = limiterByProfile.get(profile.key)

  if (existing !== undefined) {
    return existing
  }

  const created = new Bottleneck({
    maxConcurrent: profile.maxConcurrent,
    minTime: profile.minTimeMs,
  })

  limiterByProfile.set(profile.key, created)

  return created
}

export function parseRetryAfterMs(
  retryAfter: string | null,
  nowMs = Date.now(),
) {
  if (retryAfter === null) {
    return undefined
  }

  const asNumber = Number(retryAfter)

  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.round(asNumber * 1_000)
  }

  const asDateMs = new Date(retryAfter).getTime()

  if (Number.isNaN(asDateMs)) {
    return undefined
  }

  return Math.max(0, asDateMs - nowMs)
}

function getExponentialBackoffMs(attempt: number) {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
}

function shouldRetry(status: number) {
  return RETRYABLE_STATUS_CODES.has(status)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchJsonWithRetries<T>(url: URL, init?: RequestInit) {
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, init)

    if (response.ok) {
      return (await response.json()) as T
    }

    const lastAttempt = attempt >= MAX_RETRY_ATTEMPTS

    if (!shouldRetry(response.status) || lastAttempt) {
      throw new Error(
        `Polymarket request failed (${url.toString()}): ${response.status} ${response.statusText}`,
      )
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
    const delayMs = retryAfterMs ?? getExponentialBackoffMs(attempt)

    await sleep(delayMs)
  }

  throw new Error(`Polymarket request failed (${url.toString()}): retry budget exhausted`)
}

export async function fetchJson<T>(
  url: string | URL,
  init?: RequestInit,
): Promise<T> {
  const parsedUrl = toUrl(url)
  const limiter = getLimiter(getRateLimitProfile(parsedUrl))

  return limiter.schedule(() => fetchJsonWithRetries(parsedUrl, init))
}
