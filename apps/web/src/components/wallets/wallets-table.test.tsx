import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WalletsTable } from './wallets-table'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}))

describe('WalletsTable', () => {
  it('renders pnl, win rate, and tag columns', () => {
    render(
      <WalletsTable
        rows={[
          {
            address: '0xabc',
            displayName: 'Macro Whale',
            verified: true,
            totalPnl: 184000,
            winRate: 0.71,
            averagePositionSize: 18000,
            tags: ['high-conviction', 'event-specialist'],
            completeness: 'backfilled',
          },
        ]}
      />,
    )

    expect(screen.getByText(/macro whale/i)).toBeInTheDocument()
    expect(screen.getByText(/184,000/)).toBeInTheDocument()
    expect(screen.getByText(/event-specialist/i)).toBeInTheDocument()
  })
})
