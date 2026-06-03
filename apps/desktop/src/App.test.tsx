// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { DYNASTY_SAVE_KEY } from './persistence';

function installMockLocalStorage() {
  let store: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

beforeEach(() => {
  installMockLocalStorage();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

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
    expect(screen.getByLabelText(/Team rating summary/i)).toHaveTextContent(/DEPTH/i);
  });

  it('lets the user edit depth chart starters', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Team/i }));

    const starterSelect = screen.getAllByLabelText(/Depth chart starter/i)[0] as HTMLSelectElement;
    const alternate = Array.from(starterSelect.options).find((option) => option.value !== starterSelect.value);
    expect(alternate).toBeTruthy();

    await userEvent.selectOptions(starterSelect, alternate?.value ?? starterSelect.value);

    expect(screen.getByLabelText(/Save controls/i)).toHaveTextContent(/Depth chart updated/i);
  });

  it('switches to the schedule tab and shows the full season schedule', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Schedule/i }));

    expect(screen.getByRole('heading', { name: /Full Schedule/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Next game preview/i)).toHaveTextContent(/Next Game Preview/i);
    expect(screen.getByLabelText(/Next game preview/i)).toHaveTextContent(/Overall/i);
    expect(screen.getByLabelText(/Next game preview/i)).toHaveTextContent(/Faceoff/i);
    expect(screen.getByRole('heading', { name: /^Week 1$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Scheduled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Your game/i).length).toBeGreaterThan(0);
  });

  it('saves the current dynasty to local storage', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Save Now/i }));

    const raw = localStorage.getItem(DYNASTY_SAVE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw ?? '{}')).toMatchObject({
      version: 1,
      dynasty: { userTeamId: 'maryland-state' },
    });
    expect(screen.getByLabelText(/Save controls/i)).toHaveTextContent(/Saved locally/i);
  });

  it('loads an existing local dynasty save on startup', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    await userEvent.click(screen.getByRole('button', { name: /Save Now/i }));
    cleanup();

    render(<App />);

    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week 2/i);
    expect(screen.getByLabelText(/Save controls/i)).toHaveTextContent(/Loaded local save/i);
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
