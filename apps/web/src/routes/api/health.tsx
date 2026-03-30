import { createFileRoute } from '@tanstack/react-router'
import { createDb, dataFreshness } from '@polyboard/db'

export const Route = createFileRoute('/api/health' as never)({
  server: {
    handlers: {
      GET: async () => {
        const db = createDb()
        const freshness = await db.select().from(dataFreshness)

        return Response.json({
          checkedAt: new Date().toISOString(),
          ok: true,
          sources: freshness,
        })
      },
    },
  },
})
