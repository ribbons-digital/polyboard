import { createDb } from '../client'
import { dataFreshness, jobRuns } from '../schema'

type DbClient = ReturnType<typeof createDb>

export async function updateFreshness(
  db: DbClient,
  sourceKey: string,
  status: string,
  completeness = 'backfilled',
) {
  const now = new Date()

  await db
    .insert(dataFreshness)
    .values({
      asOf: now,
      completeness,
      sourceKey,
      status,
    })
    .onConflictDoUpdate({
      target: dataFreshness.sourceKey,
      set: {
        asOf: now,
        completeness,
        status,
      },
    })
}

export async function startJobRun(db: DbClient, jobName: string) {
  const [row] = await db
    .insert(jobRuns)
    .values({
      details: {},
      jobName,
      startedAt: new Date(),
      status: 'running',
    })
    .returning()

  return row.id
}
