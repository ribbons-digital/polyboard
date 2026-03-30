import type { FreshnessSummary } from '../../features/freshness/service'

export function DataStatus({ summary }: { summary: FreshnessSummary }) {
  return (
    <section
      aria-label="Data status"
      className={`data-status data-status--${summary.label}`}
    >
      <span className="data-status__label">{summary.label}</span>
      <p className="data-status__message">{summary.message}</p>
    </section>
  )
}
