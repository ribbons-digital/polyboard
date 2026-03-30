import { createFileRoute } from '@tanstack/react-router'
import { WalletTagList } from '../../components/wallets/wallet-tag-list'
import { getWalletById } from '../../features/wallets/server'
import type { getWalletDetail } from '../../features/wallets/service'

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export const Route = createFileRoute('/wallets/$walletId' as never)({
  loader: ({ params }) =>
    getWalletById({ data: { address: (params as { walletId: string }).walletId } }),
  component: WalletDetailPage,
})

function WalletDetailPage() {
  const detail = Route.useLoaderData() as Awaited<ReturnType<typeof getWalletDetail>>

  if (!detail?.wallet) {
    return <div className="surface">Wallet not found.</div>
  }

  return (
    <section className="stack">
      <div className="surface hero-panel">
        <p className="eyebrow">Wallet</p>
        <h2>{detail.wallet.displayName ?? detail.wallet.address}</h2>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Verified</span>
            <strong>{detail.wallet.verified ? 'Yes' : 'No'}</strong>
          </div>
          <div>
            <span className="metric-label">Total PnL</span>
            <strong>{numberFormatter.format(Number(detail.score?.totalPnl ?? 0))}</strong>
          </div>
          <div>
            <span className="metric-label">Win Rate</span>
            <strong>{(Number(detail.score?.winRate ?? 0) * 100).toFixed(1)}%</strong>
          </div>
        </div>
      </div>
      <div className="surface">
        <p className="eyebrow">Signal profile</p>
        <h3>Specialized Tags</h3>
        <WalletTagList tags={detail.score?.tags ?? []} />
      </div>
      <div className="detail-grid">
        <div className="surface">
          <p className="eyebrow">Open positions</p>
          <h3>Current Exposure</h3>
          <ul className="metric-list">
            {detail.openPositions.map((position) => (
              <li key={position.id}>
                <span>{position.outcome}</span>
                <strong>{Number(position.size).toFixed(2)}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="surface">
          <p className="eyebrow">Closed history</p>
          <h3>Recent Wins and Losses</h3>
          <ul className="metric-list">
            {detail.closedPositions.slice(0, 10).map((position) => (
              <li key={position.id}>
                <span>{position.outcome}</span>
                <strong>{Number(position.realizedPnl).toFixed(2)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="surface">
        <p className="eyebrow">Event analytics</p>
        <h3>Category Footprint</h3>
        <ul className="metric-list">
          {detail.eventStats.map((event) => (
            <li key={event.eventSlug}>
              <span>{event.eventSlug}</span>
              <strong>{event.tradeCount} trades</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
