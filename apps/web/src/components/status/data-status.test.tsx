import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataStatus } from './data-status'

describe('DataStatus', () => {
  it('renders the fallback status summary', () => {
    render(
      <DataStatus
        summary={{
          label: 'fallback',
          message: 'Using fallback seed data because live bootstrap failed.',
        }}
      />,
    )

    expect(screen.getByText(/^fallback$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/using fallback seed data because live bootstrap failed/i),
    ).toBeInTheDocument()
  })
})
