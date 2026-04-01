import { createFileRoute } from '@tanstack/react-router'
import { PriceHistoryChart } from '../../components/markets/price-history-chart'
import { ScoreBreakdown } from '../../components/markets/score-breakdown'
import { getMarketById } from '../../features/markets/server'
import type { getMarketDetail } from '../../features/markets/service'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export const Route = createFileRoute('/markets/$marketId' as never)({
  loader: ({ params }) =>
    getMarketById({ data: { marketId: (params as { marketId: string }).marketId } }),
  component: MarketDetailPage,
})

function MarketDetailPage() {
  const detail = Route.useLoaderData() as Awaited<
    ReturnType<typeof getMarketDetail>
  >

  if (!detail?.market) {
    return <div className="surface">Market not found.</div>
  }

  const holders = detail.holders ?? []
  const recentTrades = detail.recentTrades ?? []

  return (
    <section className="stack">
      <div className="surface hero-panel">
        <p className="eyebrow">{detail.market.category ?? 'Market'}</p>
        <h2>{detail.market.question}</h2>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Condition ID</span>
            <strong>{detail.market.conditionId}</strong>
          </div>
          <div>
            <span className="metric-label">Volume</span>
            <strong>{currencyFormatter.format(Number(detail.market.volume))}</strong>
          </div>
          <div>
            <span className="metric-label">Status</span>
            <strong>{detail.market.closed ? 'Closed' : 'Active'}</strong>
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <PriceHistoryChart points={detail.priceHistory} />
        <ScoreBreakdown values={detail.scoreBreakdown} />
      </div>
      {holders.length > 0 && (
        <div className="detail-grid">
          <div className="surface">
            <p className="eyebrow">Holdings</p>
            <h3>Top Holders</h3>
            <ul className="metric-list">
              {holders.map((holder) => (
                <li key={`${holder.walletAddress}-${holder.tokenId}`}>
                  <span>{holder.walletAddress}</span>
                  <strong>{Number(holder.size).toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface">
            <p className="eyebrow">Recent fills</p>
            <h3>Trade Activity</h3>
            <ul className="metric-list">
              {recentTrades.map((trade) => (
                <li key={trade.id}>
                  <span>{trade.walletAddress}</span>
                  <strong>
                    {trade.side} {Number(trade.size).toFixed(2)} @{' '}
                    {Number(trade.price).toFixed(3)}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
