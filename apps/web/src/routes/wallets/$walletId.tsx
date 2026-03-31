import { createFileRoute } from '@tanstack/react-router'
import { WalletTagList } from '../../components/wallets/wallet-tag-list'
import { getWalletById } from '../../features/wallets/server'

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export const Route = createFileRoute('/wallets/$walletId' as never)({
  loader: ({ params }) =>
    getWalletById({ data: { address: (params as { walletId: string }).walletId } }),
  component: WalletDetailPage,
})

function WalletDetailPage() {
  const detail = Route.useLoaderData()

  return (
    <section className="stack">
      <div className="surface hero-panel">
        <p className="eyebrow">Wallet</p>
        <h2>{detail.address}</h2>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Total PnL</span>
            <strong>{numberFormatter.format(Number(detail.score?.totalPnl ?? detail.summary?.totalPnl ?? 0))}</strong>
          </div>
          <div>
            <span className="metric-label">Win Rate</span>
            <strong>{(Number(detail.score?.winRate ?? detail.summary?.winRate ?? 0) * 100).toFixed(1)}%</strong>
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
          <p className="eyebrow">Positions</p>
          <h3>Current Exposure</h3>
          <ul className="metric-list">
            {detail.positions.length === 0 ? (
              <li>No positions data available</li>
            ) : (
              detail.positions.map((position, index) => (
                <li key={index}>
                  <span>{position.outcome}</span>
                  <strong>{Number(position.size).toFixed(2)}</strong>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="surface">
          <p className="eyebrow">Recent Trades</p>
          <h3>Latest Activity</h3>
          <ul className="metric-list">
            {detail.recentTrades.length === 0 ? (
              <li>No recent trades</li>
            ) : (
              detail.recentTrades.map((trade, index) => (
                <li key={index}>
                  <span>{trade.side}</span>
                  <strong>{Number(trade.size).toFixed(2)} @ {Number(trade.price).toFixed(3)}</strong>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
