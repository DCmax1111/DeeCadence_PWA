import React from 'react'
import { render, screen } from '@testing-library/react'
import Ledger from '../Ledger'

describe('Ledger component', () => {
  test('shows sign-in prompt when no user', () => {
    render(<Ledger user={null} />)
    expect(screen.getByText(/Sign in to manage your ledger/i)).toBeInTheDocument()
  })
})
