import { Link } from '@tanstack/react-router'
import type { MarketsTableRow } from '../../components/markets/markets-table'
import { DataStatus } from '../../components/status/data-status'
import type { WalletsTableRow } from '../../components/wallets/wallets-table'
import type { FreshnessSummary } from '../freshness/service'

interface HomePageProps {
  markets?: MarketsTableRow[]
  summary?: FreshnessSummary
  wallets?: WalletsTableRow[]
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

function formatCompactCurrency(value: number) {
  return currencyFormatter.format(Math.round(value))
}

export function HomePage({ markets = [], summary, wallets = [] }: HomePageProps) {
  const featuredMarkets = markets.slice(0, 5)
  const featuredWallets = wallets.slice(0, 5)
  const trackedVolume = markets.reduce((total, market) => total + market.volume, 0)
  const averageWinRate =
    wallets.length === 0
      ? 0
      : wallets.reduce((total, wallet) => total + wallet.winRate, 0) / wallets.length

  return (
    <section className="stack">
      {summary ? <DataStatus summary={summary} /> : null}
      <div className="surface hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Dashboard</p>
          <h2>Live Polymarket Intelligence</h2>
          <p className="table-summary">
            Track live order flow, top traders, and market structure from one
            landing page instead of hopping between placeholder screens.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span className="metric-label">High-signal markets</span>
            <strong>{markets.length}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Tracked volume</span>
            <strong>{formatCompactCurrency(trackedVolume)}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Ranked wallets</span>
            <strong>{wallets.length}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Avg wallet win rate</span>
            <strong>{percentFormatter.format(averageWinRate * 100)}%</strong>
          </div>
        </div>
      </div>
      <div className="overview-grid">
        <article className="surface overview-card">
          <div className="overview-card__header">
            <div>
              <p className="eyebrow">Markets</p>
              <h3>Top markets right now</h3>
            </div>
            <Link className="market-link" to={"/markets" as never}>
              Open market leaderboard
            </Link>
          </div>
          <p className="table-summary">
            Highest edge-score contracts ranked by current volume and timing.
          </p>
          <ul className="overview-list">
            {featuredMarkets.map((market) => (
              <li key={market.marketId}>
                <div>
                  <Link
                    className="market-link"
                    params={{ marketId: market.marketId } as never}
                    to={"/markets/$marketId" as never}
                  >
                    {market.question}
                  </Link>
                  <div className="market-subline">
                    <span>{market.category ?? 'Uncategorized'}</span>
                    {market.tags.slice(0, 2).map((tag) => (
                      <span className="tag-pill" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="overview-list__meta">
                  <strong>{market.edgeScore.toFixed(2)}</strong>
                  <span>edge</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="surface overview-card">
          <div className="overview-card__header">
            <div>
              <p className="eyebrow">Wallets</p>
              <h3>Top wallets on the tape</h3>
            </div>
            <Link className="market-link" to={"/wallets" as never}>
              Open wallet leaderboard
            </Link>
          </div>
          <p className="table-summary">
            Strong realized PnL, clean win rates, and specialist tags at a
            glance.
          </p>
          <ul className="overview-list">
            {featuredWallets.map((wallet) => (
              <li key={wallet.address}>
                <div>
                  <Link
                    className="market-link"
                    params={{ walletId: wallet.address } as never}
                    to={"/wallets/$walletId" as never}
                  >
                    {wallet.displayName ?? wallet.address}
                  </Link>
                  <div className="market-subline">
                    <span>{wallet.address}</span>
                    {wallet.tags.slice(0, 2).map((tag) => (
                      <span className="tag-pill" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="overview-list__meta">
                  <strong>{percentFormatter.format(wallet.winRate * 100)}%</strong>
                  <span>win rate</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}
