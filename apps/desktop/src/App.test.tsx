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
    expect(screen.getByLabelText(/Team rating summary/i)).toHaveTextContent(/Team OVR/i);
    expect(screen.getByLabelText(/Team rating summary/i)).toHaveTextContent(/OFF/i);
    expect(screen.getByRole('button', { name: /Sim Week/i })).toBeInTheDocument();
  });

  it('simulates a week and shows results', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    expect(screen.getByText(/Results/i)).toBeInTheDocument();
  });

  it('switches to the team tab and shows the full roster/depth chart screen', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Team/i }));

    expect(screen.getByText(/Current Team/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Depth Chart/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Full Roster/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /OVR/i })).toBeInTheDocument();
  });

  it('switches to the schedule tab and shows the full season schedule', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Schedule/i }));

    expect(screen.getByRole('heading', { name: /Full Schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Week 1$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Scheduled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Your game/i).length).toBeGreaterThan(0);
  });

  it('switches to the recruiting tab and shows scouting controls', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));
    expect(screen.getByText(/Scouting Points/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Scout/i }).length).toBeGreaterThan(0);
  });

  it('switches to standings and shows national rankings and conference sections', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Standings/i }));
    expect(screen.getByRole('heading', { name: /National Rankings/i })).toBeInTheDocument();
  });
});
