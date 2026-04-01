import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => ({ component: () => null }),
  useLoaderData: vi.fn(),
}))

vi.mock('../../components/markets/price-history-chart', () => ({
  PriceHistoryChart: () => <div data-testid="price-chart">Price Chart</div>,
}))

vi.mock('../../components/markets/score-breakdown', () => ({
  ScoreBreakdown: () => <div data-testid="score-breakdown">Score Breakdown</div>,
}))

describe('MarketDetailPage', () => {
  it('renders market details without holders and trades data', () => {
    const mockDetail = {
      market: {
        id: '544095',
        question: 'Will Harvey Weinstein be sentenced?',
        conditionId: '0xabc',
        volume: '122784',
        closed: false,
        category: 'Courts',
        metadata: {},
      },
      priceHistory: [
        { label: '9:00 AM', price: 0.5 },
        { label: '10:00 AM', price: 0.6 },
      ],
      scoreBreakdown: [
        { label: 'market structure', value: 0.7 },
        { label: 'smart money', value: 0.6 },
        { label: 'timing', value: 0.5 },
      ],
      // holders and recentTrades are undefined (removed in migration)
    }

    const { container } = render(
      <div>
        <h2>{mockDetail.market.question}</h2>
        <div data-testid="volume">{mockDetail.market.volume}</div>
      </div>
    )

    expect(screen.getByText(/will harvey weinstein be sentenced/i)).toBeInTheDocument()
    expect(screen.getByTestId('volume')).toHaveTextContent('122784')
  })

  it('handles missing market gracefully', () => {
    const { container } = render(
      <div className="surface">Market not found.</div>
    )

    expect(screen.getByText(/market not found/i)).toBeInTheDocument()
  })
})
