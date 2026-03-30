import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomePage } from './home-page'

describe('HomePage', () => {
  it('renders the primary research entry points', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', { name: /live polymarket intelligence/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/markets/i)).toBeInTheDocument()
    expect(screen.getByText(/wallets/i)).toBeInTheDocument()
    expect(screen.getByText(/settings/i)).toBeInTheDocument()
  })
})
