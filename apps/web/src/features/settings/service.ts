import {
  createDb,
  ensureSettingsRow,
  upsertWatchlistEntry,
} from '@polyboard/db'

const defaultScoreWeights = {
  marketStructure: 0.4,
  smartMoney: 0.4,
  timing: 0.2,
} as const

function toScoreWeights(value: unknown) {
  const record =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return {
    marketStructure:
      typeof record.marketStructure === 'number'
        ? record.marketStructure
        : defaultScoreWeights.marketStructure,
    smartMoney:
      typeof record.smartMoney === 'number'
        ? record.smartMoney
        : defaultScoreWeights.smartMoney,
    timing:
      typeof record.timing === 'number'
        ? record.timing
        : defaultScoreWeights.timing,
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

export async function getSettings() {
  const db = createDb()
  const settings = await ensureSettingsRow(db)

  return {
    ...settings,
    scoreWeights: toScoreWeights(settings.scoreWeights),
    trackedCategories: toStringArray(settings.trackedCategories),
  }
}

export async function saveWatchlistEntry(input: {
  address: string
  note?: string
  isExcluded?: boolean
}) {
  const db = createDb()
  return upsertWatchlistEntry(db, input)
}
