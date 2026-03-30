import { Link } from '@tanstack/react-router'
import { WalletTagList } from './wallet-tag-list'

export interface WalletsTableRow {
  address: string
  displayName: string | null
  verified: boolean
  totalPnl: number
  winRate: number
  averagePositionSize: number
  tags: string[]
  completeness: string
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export function WalletsTable({ rows }: { rows: WalletsTableRow[] }) {
  return (
    <div className="surface table-surface">
      <div className="table-header">
        <div>
          <p className="eyebrow">Wallets</p>
          <h3>Historical performance leaderboard</h3>
        </div>
        <p className="table-summary">
          Rank tracked traders by realized edge, sizing discipline, and
          specialist tags.
        </p>
      </div>
      <div className="table-scroll">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Total PnL</th>
              <th>Win Rate</th>
              <th>Avg Size</th>
              <th>Tags</th>
              <th>Completeness</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.address}>
                <td>
                  <div className="wallet-name">
                    <Link
                      className="market-link"
                      params={{ walletId: row.address } as never}
                      to={"/wallets/$walletId" as never}
                    >
                      {row.displayName ?? row.address}
                    </Link>
                    {row.verified ? <span className="verified-pill">Verified</span> : null}
                  </div>
                  <div className="market-subline">
                    <span>{row.address}</span>
                  </div>
                </td>
                <td>{currencyFormatter.format(row.totalPnl)}</td>
                <td>{(row.winRate * 100).toFixed(1)}%</td>
                <td>{currencyFormatter.format(row.averagePositionSize)}</td>
                <td>
                  <WalletTagList tags={row.tags} />
                </td>
                <td>
                  <span className="freshness-pill freshness-pill--fresh">
                    {row.completeness}
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
