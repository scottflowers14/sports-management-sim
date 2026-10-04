// @vitest-environment jsdom
import { teamCaptains } from '@sports-management-sim/sport-lacrosse';
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
    // A preseason poll is out before any games are played.
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/#\d+ Nationally/);
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
    await userEvent.click(screen.getByRole('button', { name: /Sim NCAA First Round/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim NCAA Quarterfinals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim National Semifinals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim National Championship/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enter Offseason/i }));

    expect(screen.getByRole('button', { name: /Start 2029 Season/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Start 2029 Season/i }));
    expect(screen.getByText(/Men's College Lacrosse · Season 2029/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/User team summary/i)).toHaveTextContent(/Week 1/i);
  }, 20000);

  it('shows coaching controls and persists a game plan change', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Season$/i }));

    expect(screen.getByRole('heading', { name: /^Coaching$/i })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Offensive Tempo/i), 'uptempo');
    await userEvent.selectOptions(screen.getByLabelText(/^Ride$/i), 'aggressive');
    await userEvent.selectOptions(screen.getByLabelText(/Midfield Rotation/i), 'tight');
    await userEvent.selectOptions(screen.getByLabelText(/Training Focus/i), 'goalies');

    expect(screen.getByLabelText(/Offensive Tempo/i)).toHaveValue('uptempo');
    expect(await screen.findByText(/Push transition/i)).toBeInTheDocument();
    expect(screen.getByText(/Ten-man ride/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(loadActiveDynastySave()?.gamePlan).toEqual({ tempo: 'uptempo', defense: 'balanced', ride: 'aggressive', rotation: 'tight' });
      expect(loadActiveDynastySave()?.trainingFocus).toBe('goalies');
    });
  });

  it('switches to the team tab and shows the full roster/depth chart screen', async () => {
    await renderStartedApp();

    await userEvent.click(screen.getByRole('button', { name: /Team/i }));

    expect(screen.getByText(/Current Team/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Depth Chart/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Full Roster/i })).toBeInTheDocument();
    // The Lines card shows every unit the depth chart sends out.
    const lines = screen.getByLabelText(/^Lines$/i);
    for (const unit of ['Attack', 'Midfield 1', 'Midfield 2', 'Close Defense', 'Goalie', 'Faceoff', 'Man-Up', 'Man-Down']) {
      expect(within(lines).getByText(unit)).toBeInTheDocument();
    }
    expect(within(lines).getAllByText(/% of shifts/i).length).toBeGreaterThan(1);
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
    await userEvent.click(screen.getByRole('button', { name: /Yes, Start New/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /Yes, Start New/i }));
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
  }, 20000);

  it('switches to the recruiting tab and shows scouting controls', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));
    expect(screen.getByText(/Recruiting Hours/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Scout/i }).length).toBeGreaterThan(0);
  });

  it('pitches a scouted recruit through their revealed motivation chips', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));

    // Fully scout the first recruit to reveal what they care about.
    await userEvent.click(screen.getAllByRole('button', { name: /^Scout \(1h\)$/i })[0]!);
    await userEvent.click(screen.getAllByRole('button', { name: /^Full Scout \(1h\)$/i })[0]!);

    // Their motivations render as pitch buttons; pitching marks them worked for the week.
    const pitchButtons = screen.getAllByTitle(/^Pitch /i);
    expect(pitchButtons.length).toBeGreaterThan(0);
    await userEvent.click(pitchButtons[0]!);

    expect(screen.getByTitle(/^Pitched this week$/i)).toBeInTheDocument();
    expect(screen.getAllByTitle(/Already pitched this week/i).length).toBeGreaterThan(0);
  });

  it('runs the recruiting assistant and pages the full recruit list', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));

    const pager = screen.getAllByRole('navigation', { name: /Recruit pages/i })[0]!;
    expect(pager).toHaveTextContent(/^.*1–25 of \d+/);
    await userEvent.click(within(pager).getByRole('button', { name: /Next/i }));
    expect(screen.getAllByRole('navigation', { name: /Recruit pages/i })[0]!).toHaveTextContent(/26–50 of/);

    await userEvent.click(screen.getByRole('button', { name: /^Run Assistant$/i }));
    const report = screen.getByLabelText(/Recruiting assistant report/i);
    expect(report).toHaveTextContent(/Scouting \(\d+\)/);
    expect(screen.getByRole('button', { name: /^Run Assistant$/i })).toBeDisabled();

    // Long lists collapse to the first five.
    const more = within(report).getByRole('button', { name: /^\+\d+ more scouting reports$/ });
    const shown = () => report.querySelectorAll('.assistant-columns li').length;
    const collapsed = shown();
    await userEvent.click(more);
    expect(shown()).toBeGreaterThan(collapsed);

    // Suggested offers go out in one click and come off the list.
    const makeAll = within(report).getByRole('button', { name: /^Make All \d+ Offers$/i });
    await userEvent.click(makeAll);
    expect(within(report).queryByRole('button', { name: /^Make All/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Scholarships [1-3]\.\d\d \/ 3\.25/)).toBeInTheDocument();
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
    await userEvent.click(screen.getAllByRole('button', { name: /^Scout \(1h\)$/i })[1]!);
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
  }, 20000);

  it('tracks the scholarship budget, supports partial offers, and shows public stars for ranked recruits', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Recruiting/i }));

    expect(screen.getByText(/Scholarships 0\.00 \/ 3\.25/i)).toBeInTheDocument();
    // 4★+ recruits are nationally ranked: stars show without scouting.
    expect(screen.getAllByText(/Top 100/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: /^Scout \(1h\)$/i })[0]!);
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

  it('browses every program from the League menu and opens a program page', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Programs$/i }));
    expect(screen.getByRole('heading', { name: /^Programs$/i })).toBeInTheDocument();
    expect(screen.getByText(/36 programs/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Long Island Tech$/i }));
    expect(screen.getByText(/Program Page/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Roster \(\d+\)/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /All Programs/i }));
    expect(screen.getByText(/36 programs/i)).toBeInTheDocument();
  });

  it('opens a program page from the standings', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Standings/i }));
    const [first] = screen.getAllByRole('button', { name: /^Syracuse Heights$/i });
    await userEvent.click(first!);
    expect(screen.getByRole('heading', { name: /^Syracuse Heights$/i })).toBeInTheDocument();
  });

  it('searches league-wide players and opens a player card', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Player Search/i }));
    expect(screen.getByText(/of \d+ players/i)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Filter by position/i), 'FOGO');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(within(row).getByText('FOGO')).toBeInTheDocument();

    await userEvent.click(rows[0]!);
    expect(screen.getByLabelText(/Close player panel/i)).toBeInTheDocument();
  });

  it('advances the week from the top bar', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Advance: Week 1/i }));
    expect(screen.getByRole('button', { name: /Advance: Week 2/i })).toBeInTheDocument();
  });

  it('keeps a record book that counts the season as it is played', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /Advance: Week 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Records$/ }));
    const goals = screen.getByLabelText('Goals records');
    expect(within(goals).getAllByRole('row').length).toBeGreaterThan(0);
    expect(goals).toHaveTextContent(/Live/);
    await userEvent.click(screen.getByRole('button', { name: 'League' }));
    expect(screen.getByRole('heading', { name: 'League Records' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Career' }));
    expect(within(screen.getByLabelText('Points records')).getAllByRole('row')).toHaveLength(10);
  });

  it('reopens the offseason after a reload instead of skipping into a broken season', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Season$/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim to End of Season/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enter Conference Tournaments/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim Conference Semifinals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim Conference Finals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim NCAA First Round/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim NCAA Quarterfinals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim National Semifinals/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim National Championship/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enter Offseason/i }));
    // Wait for the debounced autosave, then reload the way a player would.
    await waitFor(() => expect(loadActiveDynastySave()?.offseasonSummary).toBeTruthy());
    // The finished season went into the saved record book, with the preseason pick.
    expect(loadActiveDynastySave()?.dynastyHistory[0]?.predictedConfFinish).toBeGreaterThan(0);
    expect(loadActiveDynastySave()?.recordBook?.league?.career.points?.length).toBeGreaterThan(0);
    expect(loadActiveDynastySave()?.hallOfFame).toEqual([]);
    cleanup();

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(screen.getByRole('button', { name: /Start 2029 Season/i })).toBeInTheDocument();

    // Simming is locked until the new season starts.
    await userEvent.click(screen.getByRole('button', { name: /Week Hub/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    expect(screen.getByRole('button', { name: /Start 2029 Season/i })).toBeInTheDocument();
  }, 20000);

  it('hires and releases assistant coaches on the Staff screen', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Staff$/ }));
    const staffCard = screen.getByLabelText('Coaching staff');
    expect(within(staffCard).getByText('Offensive Coordinator')).toBeInTheDocument();
    expect(within(staffCard).queryByText('Vacant')).not.toBeInTheDocument();

    await userEvent.click(within(staffCard).getAllByRole('button', { name: 'Release' })[0]!);
    expect(within(staffCard).getByText('Vacant')).toBeInTheDocument();
    expect(loadActiveDynastySave()).not.toBeNull();

    const pool = screen.getByLabelText('Staff candidates');
    const hireButtons = within(pool).getAllByRole('button', { name: 'Hire' }).filter((b) => !(b as HTMLButtonElement).disabled);
    expect(hireButtons.length).toBeGreaterThan(0);
    const before = within(pool).getAllByRole('button', { name: 'Hire' }).length;
    await userEvent.click(hireButtons[0]!);
    expect(within(pool).getAllByRole('button', { name: 'Hire' }).length).toBe(before - 1);
    await waitFor(() => expect(loadActiveDynastySave()?.staffCandidates?.length).toBe(before - 1));
  });

  it('spends a head coach ability point on the Staff screen', async () => {
    await renderStartedApp();
    const hoursBefore = loadActiveDynastySave()!.scouting.pointsPerWeek;
    await userEvent.click(screen.getByRole('button', { name: /^Staff$/ }));
    const card = screen.getByLabelText('Head coach abilities');
    expect(within(card).getByText(/ability point to spend/)).toBeInTheDocument();
    // Recruiter tier 1 costs the new coach's one point; tier 2 then costs two.
    await userEvent.click(within(card).getByRole('button', { name: 'Upgrade Recruiter' }));
    expect(within(card).getByText(/ability points to spend/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Upgrade Recruiter' })).toBeDisabled();
    expect(within(screen.getByLabelText('Coaching staff')).getByText('+5')).toBeInTheDocument();
    await waitFor(() => expect(loadActiveDynastySave()?.coachProfile?.abilities).toEqual({ recruiter: 1 }));
    expect(loadActiveDynastySave()!.scouting.pointsPerWeek).toBeGreaterThanOrEqual(hoursBefore);
  });

  it('swaps a non-conference opponent on the Schedule screen until the season starts', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Schedule$/ }));
    const card = screen.getByLabelText('Non-conference schedule');
    const select = within(card).getAllByRole('combobox')[0]!;
    const week = Number(select.getAttribute('aria-label')!.match(/Week (\d+)/)![1]);
    const pick = within(select).getAllByRole('option')[1]!.getAttribute('value')!;
    await userEvent.selectOptions(select, pick);
    await waitFor(() => {
      const save = loadActiveDynastySave()!;
      const game = save.dynasty.season.schedule.find(
        (g) => g.week === week && (g.homeTeamId === save.dynasty.userTeamId || g.awayTeamId === save.dynasty.userTeamId),
      )!;
      expect([game.homeTeamId, game.awayTeamId]).toContain(pick);
    });

    await userEvent.click(screen.getByRole('button', { name: /^Week Hub/ }));
    await userEvent.click(screen.getByRole('button', { name: /Sim Week/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Schedule$/ }));
    expect(within(screen.getByLabelText('Non-conference schedule')).queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getByText(/slate is locked/)).toBeInTheDocument();
  });

  it('coaches a game through halftime, and a reload returns to the locker room', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: 'Coach the Game' }));
    const dialog = screen.getByRole('dialog', { name: /Halftime|at/ });
    expect(within(dialog).getByText('Staff read')).toBeInTheDocument();
    await waitFor(() => expect(loadActiveDynastySave()?.halftime?.week).toBe(1));
    const score = within(dialog).getByRole('heading').textContent;
    cleanup();

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Continue/i }));
    const again = screen.getByRole('dialog');
    expect(within(again).getByRole('heading').textContent).toBe(score);
    await userEvent.selectOptions(within(again).getByLabelText('Second half Offensive Tempo'), 'uptempo');
    await userEvent.click(within(again).getByRole('button', { name: /Play Second Half \(1 adjustment\)/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      const save = loadActiveDynastySave()!;
      expect(save.halftime ?? null).toBeNull();
      expect(save.dynasty.season.currentWeek).toBe(2);
    });
  });

  it('sets practice intensity and development plans on the Practice screen', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Practice$/ }));
    const plans = screen.getByLabelText('Development plans');
    // A new program starts with the staff's four picks.
    expect(within(plans).getAllByRole('button', { name: 'Remove' })).toHaveLength(4);
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Practice intensity' })).getByRole('radio', { name: /Intense/ }));
    await waitFor(() => expect(loadActiveDynastySave()?.practicePlan?.intensity).toBe('intense'));

    await userEvent.click(within(plans).getAllByRole('button', { name: 'Remove' })[0]!);
    expect(within(plans).getAllByRole('button', { name: 'Remove' })).toHaveLength(3);
    const focus = within(plans).getAllByRole('combobox')[0]!;
    const option = within(focus).getAllByRole('option')[1]!;
    await userEvent.selectOptions(focus, option);
    await waitFor(() =>
      expect(loadActiveDynastySave()?.practicePlan?.developmentPlans.some((p) => p.focus !== 'balanced')).toBe(true),
    );

    const roster = screen.getByLabelText('Roster development');
    await userEvent.click(within(roster).getAllByRole('button', { name: 'Add plan' }).find((b) => !(b as HTMLButtonElement).disabled)!);
    expect(within(plans).getAllByRole('button', { name: 'Remove' })).toHaveLength(4);
    expect(within(roster).getAllByRole('button', { name: 'Add plan' }).every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('talks to players and holds a team meeting in the Locker Room', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Locker Room/ }));
    const chemistry = screen.getByLabelText('Team chemistry');
    expect(chemistry).toHaveTextContent(/Team Chemistry/);
    const table = screen.getByLabelText('Player morale');
    const firstTalk = within(table).getAllByRole('button', { name: 'Talk' })[0]!;
    await userEvent.click(firstTalk);
    expect(within(table).getAllByRole('button', { name: 'Talked' })).toHaveLength(1);
    await waitFor(() => expect(loadActiveDynastySave()?.lockerRoom?.talkedIds).toHaveLength(1));

    const meeting = within(chemistry).getByRole('button', { name: 'Hold team meeting' });
    await userEvent.click(meeting);
    expect(meeting).toBeDisabled();
    expect(chemistry).toHaveTextContent(/needs a break from meetings until week \d+/);
  });

  it('suggests redshirts before the opener and redshirts a player from the Team screen', async () => {
    await renderStartedApp();
    const actions = screen.getByRole('heading', { name: /Recommended Actions/i }).closest('article')!;
    expect(actions).toHaveTextContent(/buried on the depth chart\. Redshirt them/);
    await userEvent.click(screen.getByRole('button', { name: /^Team/ }));
    const card = screen.getByLabelText('Redshirts');
    expect(card).toHaveTextContent('Redshirting (0)');
    await userEvent.click(within(card).getAllByRole('button', { name: 'Redshirt' })[0]!);
    expect(card).toHaveTextContent('Redshirting (1)');
    expect(within(card).getByRole('button', { name: 'Remove RS' })).toBeInTheDocument();
    await waitFor(() => {
      const save = loadActiveDynastySave()!;
      const team = save.dynasty.season.teams.find((t) => t.id === save.dynasty.userTeamId)!;
      expect(team.roster.filter((p) => p.redshirtStatus === 'redshirting')).toHaveLength(1);
    });
  });

  it('names a team captain from the Locker Room', async () => {
    await renderStartedApp();
    const actions = screen.getByRole('heading', { name: /Recommended Actions/i }).closest('article')!;
    expect(actions).toHaveTextContent(/No team captains named/);
    await userEvent.click(screen.getByRole('button', { name: /^Locker Room/ }));
    const card = screen.getByLabelText('Team captains');
    expect(card).toHaveTextContent('No captains named.');
    await userEvent.click(within(card).getAllByRole('button', { name: 'Make captain' })[0]!);
    expect(within(card).getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    expect(card).toHaveTextContent(/Captains (lift|drag) everyone's morale by/);
    await waitFor(() => {
      const save = loadActiveDynastySave()!;
      expect(teamCaptains(save.dynasty.season.teams.find((t) => t.id === save.dynasty.userTeamId)!)).toHaveLength(1);
    });
  });

  it('shows the rivalry on the schedule and keeps the series after it is played', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Schedule$/ }));
    const card = screen.getByLabelText('Rivalry');
    expect(card).toHaveTextContent(/The \w+ \w+/);
    expect(card).toHaveTextContent('First meeting');
    expect(screen.getAllByText('Rivalry', { selector: '.rivalry-pill' }).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /^Season$/i }));
    await userEvent.click(screen.getByRole('button', { name: /Sim to End of Season/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Schedule$/ }));
    expect(screen.getByLabelText('Rivalry')).toHaveTextContent(/(Leads|Trails) the series [01]-[01]/);
    expect(screen.getByLabelText('Rivalry')).toHaveTextContent(/This season: (won|lost) \d+-\d+/);
    await waitFor(() => expect(Object.keys(loadActiveDynastySave()?.rivalrySeries ?? {}).length).toBeGreaterThan(0));
  });

  it('previews the season on the Week Hub until the opener', async () => {
    await renderStartedApp();
    const preview = screen.getByLabelText('Season preview');
    expect(preview).toHaveTextContent(/you're picked \d+(st|nd|rd|th)/);
    expect(within(preview).getAllByRole('listitem').length).toBeGreaterThan(10);
    await userEvent.click(screen.getByRole('button', { name: /Advance: Week 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /Week Hub/i }));
    expect(screen.queryByLabelText('Season preview')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^News/ }));
    expect(screen.getAllByText(/^Preseason poll: /).length).toBeGreaterThan(0);
  });

  it('tracks the awards race and weekly honors on the Stats screen', async () => {
    await renderStartedApp();
    for (let week = 1; week <= 2; week += 1) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`Advance: Week ${week}`, 'i') }));
    }
    await userEvent.click(screen.getByRole('button', { name: /^Stats/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Awards Race' }));
    const mvp = screen.getByLabelText('Player of the Year race');
    expect(within(mvp).getAllByRole('listitem').length).toBe(5);
    expect(within(mvp).getAllByRole('listitem')[0]).toHaveTextContent(/^Leader/);
    const honors = screen.getByLabelText('Weekly honors');
    expect(within(honors).getAllByRole('row')).toHaveLength(5);
    expect(honors).toHaveTextContent(/Defensive Player of the Week/);
  });

  it('makes a playing-time promise and calls out a broken one', async () => {
    await renderStartedApp();
    await userEvent.click(screen.getByRole('button', { name: /^Team/ }));
    // Start a backup in a position's first slot, pushing its last starter to
    // the bench. Ties go against the benched player, so use a position whose
    // last starter is rated strictly above every backup.
    const slots = within(screen.getByText('Depth Chart').closest('article')!).getAllByRole('combobox') as HTMLSelectElement[];
    const overall = (option: HTMLOptionElement) => Number(/· (\d+)/.exec(option.text)![1]);
    const slot = slots.find((candidate, index) => {
      if (index > 0 && slots[index - 1]!.options[0]!.value === candidate.options[0]!.value) return false;
      const starters = slots.filter((other) => other.options[0]!.value === candidate.options[0]!.value).length;
      const options = Array.from(candidate.options);
      return options.length > starters && options.slice(starters).every((option) => overall(option) < overall(options[starters - 1]!));
    })!;
    const starterCount = slots.filter((other) => other.options[0]!.value === slot.options[0]!.value).length;
    await userEvent.selectOptions(slot, slot.options[starterCount]!.value);
    await userEvent.click(screen.getByRole('button', { name: /^Locker Room/ }));
    const concerns = screen.getByLabelText('Player concerns');
    await userEvent.click(within(concerns).getAllByRole('button', { name: 'Promise role' })[0]!);
    expect(concerns).toHaveTextContent(/Promised a starter role by week 3/);
    for (let week = 1; week <= 3; week += 1) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`Advance: Week ${week}`, 'i') }));
    }
    await userEvent.click(screen.getByRole('button', { name: /^News/ }));
    expect(screen.getByText(/feels betrayed after a broken promise of playing time/)).toBeInTheDocument();
  });

  it('flags unfilled class spots on the Week Hub and shows class needs on Recruiting', async () => {
    await renderStartedApp();
    const actions = screen.getByRole('heading', { name: /Recommended Actions/i }).closest('article')!;
    expect(actions).toHaveTextContent(/spots? open in next year's class/);
    await userEvent.click(screen.getByRole('button', { name: /^Recruiting/ }));
    const needs = screen.getByLabelText('Class needs');
    expect(needs).toHaveTextContent(/\d+ graduating · 0 committed · \d+ spots open/);
    const chip = within(needs).getAllByRole('button')[0]!;
    await userEvent.click(chip);
    expect(chip.className).toContain('active');
  });
});
