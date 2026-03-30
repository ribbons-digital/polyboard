import { createDb, dataFreshness } from '@polyboard/db'

export type FreshnessLabel = 'live' | 'degraded' | 'fallback'

export interface FreshnessRow {
  sourceKey: string
  status: string
  asOf?: Date | string | null
}

export interface FreshnessSummary {
  label: FreshnessLabel
  message: string
}

const CORE_SOURCE_KEYS = [
  'gamma:markets',
  'data:wallets',
  'scores:markets',
] as const

export function summarizeFreshness(rows: FreshnessRow[]): FreshnessSummary {
  if (rows.some((row) => row.status === 'fallback')) {
    return {
      label: 'fallback',
      message: 'Using fallback seed data because live bootstrap failed.',
    }
  }

  const statusBySource = new Map(rows.map((row) => [row.sourceKey, row.status]))
  const allCoreSourcesLive = CORE_SOURCE_KEYS.every(
    (sourceKey) => statusBySource.get(sourceKey) === 'live',
  )

  if (allCoreSourcesLive) {
    return {
      label: 'live',
      message: 'Live Polymarket data is flowing through the worker.',
    }
  }

  return {
    label: 'degraded',
    message: 'Some live sources are stale or unavailable.',
  }
}

export async function getFreshnessSummary() {
  const db = createDb()
  const rows = await db.select().from(dataFreshness)

  return summarizeFreshness(rows)
}
