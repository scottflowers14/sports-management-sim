// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { loadActiveDynastySave, listDynastySaves } from './persistence';

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

async function renderStartedApp() {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /Start New Dynasty/i }));
}

beforeEach(() => {
  installMockLocalStorage();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Desktop App', () => {
  it('renders the dynasty start screen when no active save exists', () => {
    render(<App />);

    expect(screen.getByLabelText(/Dynasty start screen/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Choose Your Program/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Existing Saves/i })).toBeInTheDocument();
  });

  it('creates a new dynasty for the selected team from the start screen', async () => {
    render(<App />);

    await userEvent.selectOptions(screen.getByLabelText(/^Team$/i), 'virginia-lakes');
    await userEvent.click(screen.getByRole('button', { name: /Start New Dynasty/i }));

    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Virginia Lakes/i);
    expect(loadActiveDynastySave()?.dynasty.userTeamId).toBe('virginia-lakes');
  });

  it('renders the Week Hub dashboard after creating a dynasty', async () => {
    await renderStartedApp();

    expect(screen.getByRole('heading', { name: /Sports Management Sim/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Maryland State/i);
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week/i);
    expect(screen.getByRole('heading', { name: /Next Opponent/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Injury Report/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Recommended Actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sim Week/i })).toBeInTheDocument();
  });

  it('simulates a week and shows results', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    expect(screen.getByText(/Results/i)).toBeInTheDocument();
  });

  it('simulates the rest of the season with Sim to End', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Season$/i }));

    await userEvent.click(screen.getByRole('button', { name: /Sim to End of Season/i }));

    expect(screen.getByRole('button', { name: /Enter Conference Tournaments/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sim Week/i })).not.toBeInTheDocument();
  });

  it('plays a smoke-test career path through save, reload, tournaments, offseason, and the next season', async () => {
    await renderStartedApp();

    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));
    await userEvent.click(screen.getAllByRole('button', { name: /Scout/i })[0]!);
    await userEvent.click(screen.getAllByRole('button', { name: /Offer/i })[0]!);
    await userEvent.click(screen.getByRole('button', { name: /Save Now/i }));
    cleanup();

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week 2/i);

    await userEvent.click(screen.getByRole('button', { name: /^Season$/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim to End of Season/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enter Conference Tournaments/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim Conference Semifinals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim Conference Finals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim National Semifinals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim National Championship/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enter Offseason/i }));

    expect(screen.getByRole('button', { name: /Start 2029 Season/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Start 2029 Season/i }));
    expect(screen.getByText(/Men's College Lacrosse · Season 2029/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week 1/i);
  });

  it('shows coaching controls and persists a game plan change', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Season$/i }));

    expect(screen.getByRole('heading', { name: /^Coaching$/i })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Offensive Tempo/i), 'uptempo');
    await userEvent.selectOptions(screen.getByLabelText(/Training Focus/i), 'goalies');

    expect(screen.getByLabelText(/Offensive Tempo/i)).toHaveValue('uptempo');
    expect(await screen.findByText(/Push transition/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(loadActiveDynastySave()?.gamePlan?.tempo).toBe('uptempo');
      expect(loadActiveDynastySave()?.trainingFocus).toBe('goalies');
    });
  });

  it('switches to the team tab and shows the full roster/depth chart screen', async () => {
    await renderStartedApp();

    await userEvent.click(screen.getByRole('button', { name: /Team/i }));

    expect(screen.getByText(/Current Team/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Depth Chart/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Full Roster/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Team rating summary/i)).toHaveTextContent(/DEPTH/i);
  });

  it('lets the user edit depth chart starters', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Team/i }));

    const starterSelect = screen.getAllByLabelText(/Depth chart starter/i)[0] as HTMLSelectElement;
    const alternate = Array.from(starterSelect.options).find((option) => option.value !== starterSelect.value);
    expect(alternate).toBeTruthy();

    await userEvent.selectOptions(starterSelect, alternate?.value ?? starterSelect.value);

    expect(screen.getByLabelText(/Save controls/i)).toHaveTextContent(/Depth chart updated/i);
  });

  it('switches to the schedule tab and shows the full season schedule', async () => {
    await renderStartedApp();

    await userEvent.click(screen.getByRole('button', { name: /Schedule/i }));

    expect(screen.getByRole('heading', { name: /Full Schedule/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Next game preview/i)).toHaveTextContent(/Next Game Preview/i);
    expect(screen.getByLabelText(/Next game preview/i)).toHaveTextContent(/Overall/i);
    expect(screen.getByLabelText(/Next game preview/i)).toHaveTextContent(/Faceoff/i);
    expect(screen.getByRole('heading', { name: /^Week 1$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Scheduled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Your game/i).length).toBeGreaterThan(0);
  });

  it('saves the current dynasty to an active save slot', async () => {
    await renderStartedApp();

    await userEvent.click(screen.getByRole('button', { name: /Save Now/i }));

    const activeSave = loadActiveDynastySave();
    expect(activeSave).toBeTruthy();
    expect(activeSave?.dynasty.userTeamId).toBe('maryland-state');
    expect(listDynastySaves()).toHaveLength(1);
    expect(screen.getByLabelText(/Save controls/i)).toHaveTextContent(/Saved locally/i);
  });

  it('loads an existing local dynasty save on startup', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    await userEvent.click(screen.getByRole('button', { name: /Save Now/i }));
    cleanup();

    render(<App />);

    // App always shows StartScreen first; click Continue to resume the saved dynasty
    await userEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week 2/i);
    expect(screen.getByLabelText(/Save controls/i)).toHaveTextContent(/Loaded dynasty save/i);
  });

  it('can return to the dynasty hub and load an existing save', async () => {
    await renderStartedApp();
    const firstSave = loadActiveDynastySave();

    await userEvent.click(screen.getByRole('button', { name: /New Dynasty/i }));

    expect(screen.getByLabelText(/Dynasty start screen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load Maryland State 2028/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Load Maryland State 2028/i }));

    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Maryland State/i);
    expect(loadActiveDynastySave()?.dynasty.id).toBe(firstSave?.dynasty.id);
  });

  it('starts a fresh generated dynasty when New Dynasty creates another career', async () => {
    await renderStartedApp();
    const firstSave = loadActiveDynastySave();
    const firstRecruitId = firstSave?.dynasty.recruits[0]?.id;

    await userEvent.click(screen.getByRole('button', { name: /New Dynasty/i }));
    await userEvent.click(screen.getByRole('button', { name: /Start New Dynasty/i }));
    const secondSave = loadActiveDynastySave();

    expect(secondSave?.dynasty.seed).not.toBe(firstSave?.dynasty.seed);
    expect(secondSave?.dynasty.id).not.toBe(firstSave?.dynasty.id);
    expect(secondSave?.dynasty.recruits[0]?.id).not.toBe(firstRecruitId);
    expect(listDynastySaves()).toHaveLength(2);
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week 1/i);
  });

  it('deletes saves from the dynasty hub without touching the remaining careers', async () => {
    await renderStartedApp();
    const firstSaveId = loadActiveDynastySave()?.saveId;

    await userEvent.click(screen.getByRole('button', { name: /New Dynasty/i }));
    await userEvent.selectOptions(screen.getByLabelText(/^Team$/i), 'virginia-lakes');
    await userEvent.click(screen.getByRole('button', { name: /Start New Dynasty/i }));
    const secondSaveId = loadActiveDynastySave()?.saveId;

    await userEvent.click(screen.getByRole('button', { name: /New Dynasty/i }));

    expect(listDynastySaves()).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /Delete Maryland State 2028/i }));

    const remainingSaves = listDynastySaves();
    expect(remainingSaves).toHaveLength(1);
    expect(remainingSaves[0]?.saveId).toBe(secondSaveId);
    expect(remainingSaves[0]?.saveId).not.toBe(firstSaveId);
    expect(screen.queryByRole('button', { name: /Load Maryland State 2028/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load Virginia Lakes 2028/i })).toBeInTheDocument();
  });

  it('switches to the recruiting tab and shows scouting controls', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));
    expect(screen.getByText(/Scouting Points/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Scout/i }).length).toBeGreaterThan(0);
  });

  it('shows the weekly hub and opens a player card from a player to watch', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Season$/i }));

    const hub = screen.getByLabelText(/Weekly hub/i);
    expect(hub).toHaveTextContent(/Coach Desk/i);
    expect(screen.getByLabelText(/Win probability/i)).toBeInTheDocument();
    expect(hub).toHaveTextContent(/Players to Watch/i);

    // Click the user's player to watch to open the shared card.
    await userEvent.click(within(hub).getAllByTitle(/^View /i)[0]!);
    const panel = screen.getByLabelText(/Close player panel/i).closest('aside') as HTMLElement;
    expect(panel).toHaveTextContent(/Overall/i);
  });

  it('opens a reusable player card when a recruit name is clicked', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));

    // Click a recruit's name to open the shared player card panel.
    const nameButton = screen.getAllByTitle(/^View /i)[0]!;
    await userEvent.click(nameButton);

    const panel = screen.getByLabelText(/Close player panel/i).closest('aside') as HTMLElement;
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent(/Overall/i);
    expect(panel).toHaveTextContent(/Recruiting/i);

    await userEvent.click(screen.getByLabelText(/Close player panel/i));
    expect(screen.queryByLabelText(/Close player panel/i)).not.toBeInTheDocument();
  });

  it('pins recruits to My Board, persists the shortlist, and auto-pins on offers', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));

    // Starts on the national list with an empty board.
    await userEvent.click(screen.getByRole('button', { name: /My Board/i }));
    expect(screen.getByText(/Your board is empty/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Browse All Recruits/i }));

    // Pin one recruit, scout + offer a different one (offer should auto-pin).
    await userEvent.click(screen.getAllByRole('button', { name: /Add .* to board/i })[0]!);
    await userEvent.click(screen.getAllByRole('button', { name: /^Scout \(1 pt\)$/i })[1]!);
    // Default offer is 100% — confirm via the in-app modal (not window.confirm).
    await userEvent.click(screen.getAllByRole('button', { name: /^Offer$/i })[0]!);
    await userEvent.click(screen.getByRole('button', { name: /Yes, Offer 100%/i }));

    await userEvent.click(screen.getByRole('button', { name: /My Board/i }));
    expect(screen.getByText(/2 on board/i)).toBeInTheDocument();
    expect(screen.getByText(/1 offers out/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Remove .* from board/i })).toHaveLength(2);

    await waitFor(() => {
      expect(loadActiveDynastySave()?.shortlistIds).toHaveLength(2);
    });

    // Unpinning takes a recruit off the board.
    await userEvent.click(screen.getAllByRole('button', { name: /Remove .* from board/i })[0]!);
    expect(screen.getByText(/1 on board/i)).toBeInTheDocument();
  });

  it('tracks the scholarship budget, supports partial offers, and shows public stars for ranked recruits', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));

    expect(screen.getByText(/Scholarships 0\.00 \/ 3\.25/i)).toBeInTheDocument();
    // 4★+ recruits are nationally ranked: stars show without scouting.
    expect(screen.getAllByText(/Top 100/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: /^Scout \(1 pt\)$/i })[0]!);
    await userEvent.selectOptions(screen.getAllByLabelText(/Scholarship offer amount/i)[0]!, '50');
    await userEvent.click(screen.getAllByRole('button', { name: /^Offer$/i })[0]!);

    expect(screen.getByText(/Scholarships 0\.50 \/ 3\.25/i)).toBeInTheDocument();
    expect(screen.getByText(/Offered 50%/i)).toBeInTheDocument();
  });

  it('switches to standings and shows national rankings and conference sections', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Standings/i }));
    expect(screen.getByRole('heading', { name: /National Rankings/i })).toBeInTheDocument();
  });
});
