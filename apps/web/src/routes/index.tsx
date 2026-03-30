import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

export function HomePage() {
  return (
    <section className="hero-grid">
      <div className="hero-card">
        <p className="eyebrow">Dashboard</p>
        <h2>Live Polymarket Intelligence</h2>
        <p>
          Track live order flow, strong traders, and fresh edge signals from one
          screen.
        </p>
      </div>
      <div className="quick-links">
        <article className="surface">
          <h3>Markets</h3>
          <p>Rank active contracts by composite edge score.</p>
        </article>
        <article className="surface">
          <h3>Wallets</h3>
          <p>Inspect PnL, win rate, position sizes, and specialist tags.</p>
        </article>
        <article className="surface">
          <h3>Settings</h3>
          <p>Tune thresholds, score weights, and watchlists.</p>
        </article>
      </div>
    </section>
  )
}
