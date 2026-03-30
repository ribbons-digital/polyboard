import { createFileRoute } from '@tanstack/react-router'
import { MarketsTable } from '../../components/markets/markets-table'
import { DataStatus } from '../../components/status/data-status'
import { loadMarketRouteData } from '../../features/route-loaders'

export const Route = createFileRoute('/markets/' as never)({
  loader: () => loadMarketRouteData(),
  component: MarketsPage,
})

function MarketsPage() {
  const data = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadMarketRouteData>
  >

  return (
    <section className="stack">
      <DataStatus summary={data.freshness} />
      <div className="surface hero-panel">
        <p className="eyebrow">Markets</p>
        <h2>Composite Edge Leaderboard</h2>
        <p className="table-summary">
          Scan the contracts that combine structure, smart money, and timing
          into one ranked tape.
        </p>
      </div>
      <MarketsTable
        rows={data.rows.map((row) => ({
          ...row,
          freshness: 'fresh' as const,
        }))}
      />
    </section>
  )
}
