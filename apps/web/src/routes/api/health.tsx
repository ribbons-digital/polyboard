import { createFileRoute } from '@tanstack/react-router'
import { createDb, dataFreshness } from '@polyboard/db'

export async function handleHealthGet() {
  const db = createDb()
  const freshness = await db.select().from(dataFreshness)

  return Response.json({
    checkedAt: new Date().toISOString(),
    ok: freshness.every((row) => row.status !== 'degraded'),
    sources: freshness,
  })
}

export const Route = createFileRoute('/api/health' as never)({
  server: {
    handlers: {
      GET: handleHealthGet,
    },
  },
})
