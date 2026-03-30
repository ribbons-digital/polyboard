import { describe, expect, it } from 'vitest'
import { buildWorkerHealth } from './health'

describe('buildWorkerHealth', () => {
  it('returns healthy status for normal backlog sizes', () => {
    expect(
      buildWorkerHealth({
        backlogSize: 42,
        lastDiscoveryAt: new Date('2026-03-30T00:00:00Z'),
      }),
    ).toMatchObject({
      backlogSize: 42,
      lastDiscoveryAt: '2026-03-30T00:00:00.000Z',
      lastSocketMessageAt: null,
      status: 'healthy',
    })
  })

  it('returns degraded status once backlog crosses the threshold', () => {
    expect(
      buildWorkerHealth({
        backlogSize: 501,
      }),
    ).toMatchObject({
      backlogSize: 501,
      status: 'degraded',
    })
  })
})
