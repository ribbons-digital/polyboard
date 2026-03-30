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
  const statusBySource = new Map(
    rows.map((row) => [row.sourceKey, normalizeStatus(row.status)]),
  )
  const coreStatuses = CORE_SOURCE_KEYS.map((sourceKey) =>
    statusBySource.get(sourceKey),
  )
  const allCoreSourcesLive = coreStatuses.every((status) => status === 'live')

  if (coreStatuses.some((status) => status === 'fallback')) {
    return {
      label: 'fallback',
      message: 'Using fallback seed data because live bootstrap failed.',
    }
  }

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

function normalizeStatus(status: string) {
  return status === 'fresh' ? 'live' : status
}

export async function getFreshnessSummary() {
  const db = createDb()
  const rows = await db.select().from(dataFreshness)

  return summarizeFreshness(rows)
}
