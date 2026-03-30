import { Link } from '@tanstack/react-router'

export interface MarketsTableRow {
  marketId: string
  slug: string
  question: string
  category: string | null
  volume: number
  edgeScore: number
  timingScore: number
  tags: string[]
  freshness?: 'fresh' | 'stale' | 'degraded'
}

const volumeFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export function MarketsTable({ rows }: { rows: MarketsTableRow[] }) {
  return (
    <div className="surface table-surface">
      <div className="table-header">
        <div>
          <p className="eyebrow">Live ranking</p>
          <h3>High-signal markets</h3>
        </div>
        <p className="table-summary">
          Sorted by edge score with timing, volume, and freshness context.
        </p>
      </div>
      <div className="table-scroll">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Category</th>
              <th>Volume</th>
              <th>Edge</th>
              <th>Timing</th>
              <th>Freshness</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.marketId}>
                <td>
                  <Link
                    className="market-link"
                    params={{ marketId: row.marketId } as never}
                    to={"/markets/$marketId" as never}
                  >
                    {row.question}
                  </Link>
                  <div className="market-subline">
                    <span>{row.slug}</span>
                    {row.tags.slice(0, 2).map((tag) => (
                      <span className="tag-pill" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{row.category ?? 'Uncategorized'}</td>
                <td>{volumeFormatter.format(row.volume)}</td>
                <td>{row.edgeScore.toFixed(2)}</td>
                <td>{row.timingScore.toFixed(2)}</td>
                <td>
                  <span className={`freshness-pill freshness-pill--${row.freshness ?? 'fresh'}`}>
                    {row.freshness ?? 'fresh'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
