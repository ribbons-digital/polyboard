import { describe, expect, it, vi } from 'vitest'

const { createDbMock, fromMock, selectMock } = vi.hoisted(() => {
  const fromMock = vi.fn()
  const selectMock = vi.fn()
  const createDbMock = vi.fn(() => ({
    select: selectMock,
  }))

  return {
    createDbMock,
    fromMock,
    selectMock,
  }
})

vi.mock('@polyboard/db', () => ({
  createDb: createDbMock,
  dataFreshness: Symbol('dataFreshness'),
}))

import { handleHealthGet } from './health'

describe('health route', () => {
  it('returns worker bootstrap freshness rows in the payload', async () => {
    fromMock.mockResolvedValueOnce([
      {
        sourceKey: 'worker:bootstrap',
        status: 'fallback',
        updatedAt: new Date('2026-03-30T08:00:00.000Z'),
      },
    ])
    selectMock.mockReturnValueOnce({ from: fromMock })

    const response = await handleHealthGet()
    const payload = await response.json()

    expect(payload.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: 'worker:bootstrap',
          status: 'fallback',
        }),
      ]),
    )
  })

  it('marks the health payload not ok when any freshness row is degraded', async () => {
    fromMock.mockResolvedValueOnce([
      {
        sourceKey: 'gamma:markets',
        status: 'degraded',
        updatedAt: new Date('2026-03-30T08:00:00.000Z'),
      },
      {
        sourceKey: 'worker:bootstrap',
        status: 'live',
        updatedAt: new Date('2026-03-30T08:00:00.000Z'),
      },
    ])
    selectMock.mockReturnValueOnce({ from: fromMock })

    const response = await handleHealthGet()
    const payload = await response.json()

    expect(payload.ok).toBe(false)
  })
})
