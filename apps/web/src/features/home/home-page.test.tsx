import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './home-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

describe('HomePage', () => {
  it('renders dashboard sections for markets and wallets', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', { name: /live polymarket intelligence/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /top markets right now/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /top wallets on the tape/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open market leaderboard/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open wallet leaderboard/i }),
    ).toBeInTheDocument()
  })

  it('renders the live data status banner when freshness is available', () => {
    render(
      <HomePage
        summary={{
          label: 'live',
          message: 'Live Polymarket data is flowing through the worker.',
        }}
      />,
    )

    expect(
      screen.getByRole('region', { name: /data status/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^live$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/live polymarket data is flowing through the worker/i),
    ).toBeInTheDocument()
  })

  it('removes the redundant settings teaser card', () => {
    const view = render(<HomePage />)

    expect(
      view.queryAllByText(/tune thresholds, score weights, and watchlists/i),
    ).toHaveLength(0)
  })
})
