import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../Header';

describe('Header component', () => {
  test('renders auth controls and disables magic link button when email is empty', () => {
    render(<Header user={null} theme="system" setTheme={jest.fn()} />);

    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeDisabled();
    expect(screen.getByLabelText(/theme mode/i)).toHaveValue('system');
  });
});
