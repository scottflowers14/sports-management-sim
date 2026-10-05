// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { RESULT_RANK_CUTOFF, ResultRow } from './ResultRow';

const game: ScheduledGame = {
  id: 'g1',
  seasonYear: 2028,
  week: 2,
  homeTeamId: 'home',
  awayTeamId: 'away',
  conferenceGame: false,
  status: 'final',
  result: { homeScore: 12, awayScore: 9, winnerTeamId: 'home', loserTeamId: 'away', overtime: false },
};
const teamMap = new Map([
  ['home', 'Harbor City'],
  ['away', 'Ocean State'],
]);

afterEach(cleanup);

describe('ResultRow', () => {
  it('tags ranked teams with their national rank, like a scoreboard', () => {
    const ranks: Record<string, number> = { home: 4, away: RESULT_RANK_CUTOFF + 3 };
    render(<ul><ResultRow game={game} teamMap={teamMap} userTeamId="me" rankOf={(id) => ranks[id] ?? null} /></ul>);
    expect(screen.getByText('#4')).toBeInTheDocument();
    expect(screen.queryByText(`#${RESULT_RANK_CUTOFF + 3}`)).not.toBeInTheDocument();
  });

  it('shows no ranks without a poll', () => {
    render(<ul><ResultRow game={game} teamMap={teamMap} userTeamId="me" /></ul>);
    expect(screen.queryByText(/^#\d+$/)).not.toBeInTheDocument();
  });
});
