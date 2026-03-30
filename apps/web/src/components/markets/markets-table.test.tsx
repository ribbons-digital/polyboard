import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarketsTable } from './markets-table'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}))

describe('MarketsTable', () => {
  it('renders market score columns and freshness state', () => {
    render(
      <MarketsTable
        rows={[
          {
            marketId: 'm1',
            slug: 'btc-above-100k',
            question: 'Will BTC close above $100k?',
            category: 'Crypto',
            volume: 125000,
            edgeScore: 0.72,
            timingScore: 0.68,
            tags: ['Momentum'],
            freshness: 'fresh',
          },
        ]}
      />,
    )

    expect(screen.getByText(/will btc close above/i)).toBeInTheDocument()
    expect(screen.getByText('0.72')).toBeInTheDocument()
    expect(screen.getByText(/^fresh$/i)).toBeInTheDocument()
  })
})
