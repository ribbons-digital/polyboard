import { createFileRoute, useRouter } from '@tanstack/react-router'
import { WatchlistForm } from '../components/settings/watchlist-form'
import { getAppSettings, upsertWatchlist } from '../features/settings/server'
import type { getSettings } from '../features/settings/service'

export const Route = createFileRoute('/settings' as never)({
  loader: () => getAppSettings(),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData() as Awaited<ReturnType<typeof getSettings>>
  const router = useRouter()

  return (
    <section className="stack">
      <div className="surface hero-panel">
        <p className="eyebrow">Settings</p>
        <h2>Thresholds and Watchlists</h2>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Minimum market volume</span>
            <strong>{settings.minMarketVolume.toLocaleString('en-US')}</strong>
          </div>
          <div>
            <span className="metric-label">Tracked categories</span>
            <strong>
              {settings.trackedCategories.length > 0
                ? settings.trackedCategories.join(', ')
                : 'All'}
            </strong>
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <div className="surface">
          <p className="eyebrow">Scoring weights</p>
          <h3>Current Blend</h3>
          <ul className="metric-list">
            <li>
              <span>market structure</span>
              <strong>{settings.scoreWeights.marketStructure.toFixed(2)}</strong>
            </li>
            <li>
              <span>smart money</span>
              <strong>{settings.scoreWeights.smartMoney.toFixed(2)}</strong>
            </li>
            <li>
              <span>timing</span>
              <strong>{settings.scoreWeights.timing.toFixed(2)}</strong>
            </li>
          </ul>
        </div>
        <WatchlistForm
          onSubmit={async (input) => {
            await upsertWatchlist({ data: input })
            await router.invalidate()
          }}
        />
      </div>
    </section>
  )
}
