// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('Desktop App', () => {
  it('renders the dynasty dashboard with season view by default', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /Sports Management Sim/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Maryland State/i);
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week/i);
    expect(screen.getByRole('heading', { name: /This Week/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Roster/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sim Week/i })).toBeInTheDocument();
  });

  it('simulates a week and shows results', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    expect(screen.getByText(/Results/i)).toBeInTheDocument();
  });

  it('switches to the recruiting tab and shows offer buttons', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));
    expect(screen.queryAllByRole('button', { name: /Offer Scholarship/i }).length).toBeGreaterThan(0);
  });

  it('switches to standings and shows a table', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Standings/i }));
    expect(screen.getByRole('heading', { name: /Conference Standings/i })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
