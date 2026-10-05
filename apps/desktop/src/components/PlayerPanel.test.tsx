// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createNewLacrosseDynasty } from '@sports-management-sim/sport-lacrosse';
import type { PlayerSeasonStats } from '../stats';
import { PlayerPanel } from './PlayerPanel';

const player = createNewLacrosseDynasty({ seed: 3, userTeamId: 'maryland-state', seasonYear: 2028 })
  .season.teams[0]!.roster.find((p) => p.position === 'ATT')!;

function line(gamesPlayed: number, goals: number): PlayerSeasonStats {
  return {
    playerId: player.id,
    gamesPlayed,
    goals,
    assists: 4,
    shots: 40,
    groundBalls: 10,
    turnovers: 5,
    causedTurnovers: 2,
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    goalsAllowed: 0,
  };
}

const career = {
  playerId: player.id,
  name: 'Test Player',
  position: 'ATT',
  seasons: [{ year: 2028, teamName: 'maryland-state', classYear: 'JR', position: 'ATT', stats: line(10, 31) }],
};

function panel(props: Partial<Parameters<typeof PlayerPanel>[0]> = {}) {
  return render(
    <PlayerPanel
      player={player}
      isInjured={false}
      injuryData={undefined}
      playerStats={undefined}
      career={career}
      seasonYear={2029}
      onClose={() => {}}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe('PlayerPanel', () => {
  it('lists the player’s honors', () => {
    panel({ honors: [{ year: 2028, award: '1st Team All-America' }, { year: 2028, award: '1st Team All-Conference' }] });
    const honors = screen.getByLabelText('Honors');
    expect(within(honors).getByText('2028 1st Team All-America')).toBeInTheDocument();
    expect(within(honors).getByText('2028 1st Team All-Conference')).toBeInTheDocument();
  });

  it('shows the last finished season before this one starts, without counting it twice', () => {
    panel();
    expect(screen.getByText('2028 Season · 10 GP')).toBeInTheDocument();
    expect(screen.queryByText('2029*')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Honors')).not.toBeInTheDocument();
  });

  it('shows this season once games are played', () => {
    panel({ playerStats: line(3, 9) });
    expect(screen.getByText('2029 Season · 3 GP')).toBeInTheDocument();
    expect(screen.queryByText('2028 Season · 10 GP')).not.toBeInTheDocument();
    expect(screen.getByText('2029*')).toBeInTheDocument();
  });
});
