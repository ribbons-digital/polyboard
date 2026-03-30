import { eq } from 'drizzle-orm'
import { createDb } from '../client'
import { appSettings, walletWatchlists } from '../schema'

type DbClient = ReturnType<typeof createDb>

export async function ensureSettingsRow(db: DbClient) {
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 1))

  if (existing.length > 0) {
    return existing[0]
  }

  const now = new Date()
  const inserted = await db
    .insert(appSettings)
    .values({ id: 1, updatedAt: now })
    .returning()

  return inserted[0]
}

export async function upsertWatchlistEntry(
  db: DbClient,
  input: { address: string; note?: string; isExcluded?: boolean },
) {
  const now = new Date()

  await db
    .insert(walletWatchlists)
    .values({
      address: input.address,
      note: input.note,
      isExcluded: input.isExcluded ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: walletWatchlists.address,
      set: {
        note: input.note,
        isExcluded: input.isExcluded ?? false,
        updatedAt: now,
      },
    })
}
