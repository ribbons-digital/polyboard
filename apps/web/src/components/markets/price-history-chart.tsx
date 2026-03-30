import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function PriceHistoryChart({
  points,
}: {
  points: Array<{ label: string; price: number }>
}) {
  return (
    <div className="surface chart-card">
      <p className="eyebrow">Flow</p>
      <h3>Price History</h3>
      {points.length === 0 ? (
        <p className="table-summary">No price history captured for this market yet.</p>
      ) : (
        <ResponsiveContainer height={280} width="100%">
          <LineChart data={points}>
            <CartesianGrid
              stroke="rgba(255, 255, 255, 0.08)"
              strokeDasharray="4 4"
            />
            <XAxis dataKey="label" stroke="#9fb9b4" />
            <YAxis stroke="#9fb9b4" />
            <Tooltip />
            <Line
              dataKey="price"
              dot={false}
              stroke="#64d7b4"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
