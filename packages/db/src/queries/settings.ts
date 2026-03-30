import { eq } from 'drizzle-orm'
import { createDb } from '../client'
import { appSettings, wallets, walletWatchlists } from '../schema'

type DbClient = ReturnType<typeof createDb>

export async function ensureSettingsRow(db: DbClient) {
  const now = new Date()
  const inserted = await db
    .insert(appSettings)
    .values({ id: 1, updatedAt: now })
    .onConflictDoNothing({
      target: appSettings.id,
    })
    .returning()

  if (inserted.length > 0) {
    return inserted[0]
  }

  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 1))

  return existing[0]
}

export async function upsertWatchlistEntry(
  db: DbClient,
  input: { address: string; note?: string; isExcluded?: boolean },
) {
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .insert(wallets)
      .values({
        address: input.address,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: wallets.address,
      })

    await tx
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
  })
}
