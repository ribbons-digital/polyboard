export function ScoreBreakdown({
  values,
}: {
  values: Array<{ label: string; value: number }>
}) {
  return (
    <div className="surface">
      <p className="eyebrow">Scoring</p>
      <h3>Score Breakdown</h3>
      <ul className="metric-list score-list">
        {values.map((value) => (
          <li key={value.label}>
            <span>{value.label}</span>
            <strong>{value.value.toFixed(2)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
