import { createFileRoute } from '@tanstack/react-router'
import { MarketsTable } from '../../components/markets/markets-table'
import { getMarketLeaderboard } from '../../features/markets/server'
import type { listMarketLeaderboard } from '../../features/markets/service'

export const Route = createFileRoute('/markets/' as never)({
  loader: () => getMarketLeaderboard({ data: { minEdge: 0.2 } }),
  component: MarketsPage,
})

function MarketsPage() {
  const rows = (Route.useLoaderData() ?? []) as Awaited<
    ReturnType<typeof listMarketLeaderboard>
  >

  return (
    <section className="stack">
      <div className="surface hero-panel">
        <p className="eyebrow">Markets</p>
        <h2>Composite Edge Leaderboard</h2>
        <p className="table-summary">
          Scan the contracts that combine structure, smart money, and timing
          into one ranked tape.
        </p>
      </div>
      <MarketsTable
        rows={rows.map((row) => ({
          ...row,
          freshness: 'fresh' as const,
        }))}
      />
    </section>
  )
}
