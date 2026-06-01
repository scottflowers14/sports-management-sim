// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('Desktop App', () => {
  it('renders the playable dynasty dashboard from engine state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Sports Management Sim/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Maryland State/i);
    expect(screen.getByText(/Current Week/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Roster/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Recruiting Board/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Schedule/i })).toBeInTheDocument();
  });
});
