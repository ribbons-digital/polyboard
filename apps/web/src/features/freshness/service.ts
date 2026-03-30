import {
  createDb,
  dataFreshness,
  freshnessCoreSourceKeys,
  isFreshnessRowStale,
  normalizeFreshnessStatus,
  type FreshnessStatus,
  type FreshnessSourceKey,
} from '@polyboard/db'

export interface FreshnessSummary {
  label: FreshnessStatus
  message: string
}

export interface FreshnessRow {
  sourceKey: string
  status: string
  asOf?: Date | string | null
}

export function summarizeFreshness(
  rows: FreshnessRow[],
  now = new Date(),
): FreshnessSummary {
  const statusBySource = new Map(
    rows.map((row) => [row.sourceKey, normalizeFreshnessStatus(row.status)]),
  )
  const coreRows = freshnessCoreSourceKeys.map((sourceKey) => ({
    asOf: rows.find((row) => row.sourceKey === sourceKey)?.asOf,
    sourceKey,
    status: statusBySource.get(sourceKey),
  }))

  if (coreRows.some((row) => row.status === 'fallback')) {
    return {
      label: 'fallback',
      message: 'Using fallback seed data because live bootstrap failed.',
    }
  }

  const allCoreRowsLiveAndFresh = coreRows.every((row) => {
    if (row.status !== 'live') {
      return false
    }

    return !isFreshnessRowStale(row.sourceKey as FreshnessSourceKey, row.asOf, now)
  })

  if (allCoreRowsLiveAndFresh) {
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
