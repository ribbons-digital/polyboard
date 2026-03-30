import { createFileRoute } from '@tanstack/react-router'
import { WalletsTable } from '../../components/wallets/wallets-table'
import { DataStatus } from '../../components/status/data-status'
import { loadWalletRouteData } from '../../features/route-loaders'

export const Route = createFileRoute('/wallets/' as never)({
  loader: () => loadWalletRouteData(),
  component: WalletsPage,
})

function WalletsPage() {
  const data = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadWalletRouteData>
  >

  return (
    <section className="stack">
      <DataStatus summary={data.freshness} />
      <div className="surface hero-panel">
        <p className="eyebrow">Wallets</p>
        <h2>Historical Performance Leaderboard</h2>
        <p className="table-summary">
          Surface high-conviction accounts, specialist behavior, and clean
          win-rate profiles in one operator view.
        </p>
      </div>
      <WalletsTable rows={data.rows} />
    </section>
  )
}
