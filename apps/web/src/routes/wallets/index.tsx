import { createFileRoute } from '@tanstack/react-router'
import { WalletsTable } from '../../components/wallets/wallets-table'
import { getWalletLeaderboard } from '../../features/wallets/server'
import type { listWalletLeaderboard } from '../../features/wallets/service'

export const Route = createFileRoute('/wallets/' as never)({
  loader: () => getWalletLeaderboard(),
  component: WalletsPage,
})

function WalletsPage() {
  const rows = (Route.useLoaderData() ?? []) as Awaited<
    ReturnType<typeof listWalletLeaderboard>
  >

  return (
    <section className="stack">
      <div className="surface hero-panel">
        <p className="eyebrow">Wallets</p>
        <h2>Historical Performance Leaderboard</h2>
        <p className="table-summary">
          Surface high-conviction accounts, specialist behavior, and clean
          win-rate profiles in one operator view.
        </p>
      </div>
      <WalletsTable rows={rows} />
    </section>
  )
}
