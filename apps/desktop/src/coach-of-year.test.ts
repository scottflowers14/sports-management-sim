import { describe, expect, it } from 'vitest';
import type { HeadCoach, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { buildCoachCareer, computeCoachOfYear } from './coach-of-year';
import type { DynastySeasonRecord } from './history';

function coach(last: string): HeadCoach {
  return {
    id: `coach-${last}`,
    name: { first: 'Coach', last },
    rating: 60,
    age: 50,
    hiredYear: 2025,
    wins: 0,
    losses: 0,
    careerWins: 0,
    careerLosses: 0,
    hotSeat: 0,
  };
}

function team(id: string, prestige: number, wins: number, losses: number, withCoach = true): LacrosseTeam {
  return {
    id,
    name: id,
    reputation: { nationalPrestige: prestige },
    record: { wins, losses },
    ...(withCoach ? { headCoach: coach(id) } : {}),
  } as unknown as LacrosseTeam;
}

describe('computeCoachOfYear', () => {
  it('rewards the biggest turnaround over the best record', () => {
    // League prestige averages 60: the blue blood is expected to win ~.62, the small school ~.38.
    const winner = computeCoachOfYear(
      [team('user', 60, 7, 7, false), team('blueblood', 80, 12, 2), team('smallschool', 40, 11, 3)],
      { userTeamId: 'user' },
    );
    expect(winner).toMatchObject({ teamId: 'smallschool', coachName: 'Coach smallschool', wins: 11, losses: 3 });
    expect(winner!.winsAboveExpected).toBeCloseTo(5.7, 1);
  });

  it('gives the national champion a boost', () => {
    const teams = [team('user', 60, 7, 7, false), team('blueblood', 80, 12, 2), team('smallschool', 40, 10, 4)];
    expect(computeCoachOfYear(teams, { userTeamId: 'user' })!.teamId).toBe('smallschool');
    expect(computeCoachOfYear(teams, { userTeamId: 'user', nationalChampionId: 'blueblood' })!.teamId).toBe('blueblood');
  });

  it('can go to the user, who has no CPU coach', () => {
    const winner = computeCoachOfYear([team('user', 40, 13, 1, false), team('cpu', 80, 9, 5)], { userTeamId: 'user' });
    expect(winner).toMatchObject({ teamId: 'user', coachName: null });
  });

  it('skips programs with no coach or no games', () => {
    expect(computeCoachOfYear([team('user', 60, 0, 0, false), team('cpu', 60, 0, 0), team('orphan', 20, 14, 0, false)], { userTeamId: 'user' })).toBeNull();
  });
});

function season(year: number, overrides: Partial<DynastySeasonRecord> = {}): DynastySeasonRecord {
  return {
    year,
    wins: 9,
    losses: 5,
    confStanding: 3,
    natRankAtEnd: null,
    confChampion: false,
    nationalChampion: false,
    signingClassSize: 10,
    coachName: 'Pat Riley',
    teamName: 'Alpha',
    ...overrides,
  };
}

describe('buildCoachCareer', () => {
  it('totals the career and groups seasons by program', () => {
    const history = [
      season(2031, { teamName: 'Beta', wins: 14, losses: 2, nationalChampion: true, coachOfYear: true }),
      season(2030, { wins: 12, losses: 4, confChampion: true }),
      season(2029),
      season(2028, { coachName: 'Someone Else', wins: 2, losses: 12 }),
    ];
    const career = buildCoachCareer(history, 'Pat Riley');
    expect(career).toMatchObject({ seasons: 3, wins: 35, losses: 11, confTitles: 1, nationalTitles: 1, coachOfYearYears: [2031] });
    expect(career.stints).toEqual([
      { teamName: 'Alpha', firstYear: 2029, lastYear: 2030, wins: 21, losses: 9 },
      { teamName: 'Beta', firstYear: 2031, lastYear: 2031, wins: 14, losses: 2 },
    ]);
    expect(career.bestSeason?.year).toBe(2031);
  });

  it('is empty before the first season', () => {
    expect(buildCoachCareer([], 'Pat Riley')).toMatchObject({ seasons: 0, wins: 0, stints: [], bestSeason: null });
  });
});
