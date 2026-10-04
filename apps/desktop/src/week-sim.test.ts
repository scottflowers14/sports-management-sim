import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { simulateOneWeek, simulateRemainingWeeks, type WeekSimState } from './week-sim';
import { healInjuriesOneWeek } from './dynasty-helpers';
import { createProgramStaff } from './program-staff';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function freshState(): WeekSimState {
  return {
    dynasty: createFreshLacrosseDynasty(),
    rankings: [],
    injuries: [],
    newsItems: [],
    scouting: createScoutingState(),
    recruitingActivity: emptyRecruitingActivity(),
    recruitTrends: {},
    seasonStats: emptySeasonStats(),
    gameLogs: new Map(),
    bestNatRank: null,
    lastSimWeek: null,
  };
}

describe('simulateOneWeek', () => {
  it('finalizes the current week, advances the week counter, and records side effects', () => {
    const state = freshState();
    const weekBefore = state.dynasty.season.currentWeek;

    const next = simulateOneWeek(state, undefined, seededRandom(1));

    expect(next.dynasty.season.currentWeek).toBe(weekBefore + 1);
    expect(next.lastSimWeek).toBe(weekBefore);
    const weekGames = next.dynasty.season.schedule.filter((g) => g.week === weekBefore);
    expect(weekGames.length).toBeGreaterThan(0);
    expect(weekGames.every((g) => g.status === 'final')).toBe(true);
    expect(next.rankings.length).toBeGreaterThan(0);
    expect(next.gameLogs.size).toBe(weekGames.length);
    expect(next.scouting.pointsAvailable).toBeGreaterThan(state.scouting.pointsAvailable);
    // Original state is untouched
    expect(state.dynasty.season.currentWeek).toBe(weekBefore);
    expect(state.gameLogs.size).toBe(0);
  });

  it('publishes a player of the week news item once goals are scored', () => {
    const next = simulateOneWeek(freshState(), undefined, seededRandom(5));
    const potw = next.newsItems.find((n) => n.headline.startsWith('Player of the Week:'));
    expect(potw).toBeDefined();
    expect(potw!.category).toBe('award');
    expect(potw!.headline).toMatch(/—\s\d+G, \d+A$/);
  });

  it('tracks the best national rank achieved by the user team', () => {
    const next = simulateOneWeek(freshState(), undefined, seededRandom(2));
    const userRank = next.rankings.find((r) => r.teamId === next.dynasty.userTeamId)?.rank ?? null;
    expect(next.bestNatRank).toBe(userRank);
  });
});

describe('recruiting actions in the weekly sim', () => {
  it('resolves campus visits, boosts interest, records the trend, and clears weekly activity', () => {
    const state = freshState();
    const target = state.dynasty.recruits.find((r) => r.status === 'open')!;
    const before = target.interestByTeamId[state.dynasty.userTeamId] ?? 0;

    const next = simulateOneWeek(
      { ...state, recruitingActivity: { visitIds: [target.id], pitchedIds: [] } },
      undefined,
      seededRandom(7),
    );

    const after = next.dynasty.recruits.find((r) => r.id === target.id)!;
    expect(after.interestByTeamId[next.dynasty.userTeamId] ?? 0).toBeGreaterThan(before);
    expect(next.newsItems.some((n) => n.headline.startsWith('Campus visit:'))).toBe(true);
    expect(next.recruitingActivity).toEqual({ visitIds: [], pitchedIds: [] });
    expect(next.recruitTrends[target.id]).toBeGreaterThan(0);
  });

  it('commits recruits over the season as their decision weeks arrive', () => {
    const done = simulateRemainingWeeks(freshState(), undefined, seededRandom(11));
    const committed = done.dynasty.recruits.filter((r) => r.status !== 'open');
    expect(committed.length).toBeGreaterThan(0);
    // Anyone who committed did so to a school that actually offered them.
    for (const recruit of committed) {
      const destination = recruit.committedTeamId ?? recruit.signedTeamId;
      expect(recruit.scholarshipOffers.some((o) => o.teamId === destination)).toBe(true);
    }
  });
});

describe('simulateRemainingWeeks', () => {
  it('simulates every remaining game in the season', () => {
    const done = simulateRemainingWeeks(freshState(), undefined, seededRandom(3));

    expect(done.dynasty.season.schedule.some((g) => g.status === 'scheduled')).toBe(false);
    expect(done.dynasty.season.schedule.every((g) => g.status === 'final')).toBe(true);
    const userTeam = done.dynasty.season.teams.find((t) => t.id === done.dynasty.userTeamId)!;
    expect(userTeam.record.wins + userTeam.record.losses).toBeGreaterThan(0);
  });
});

describe('healInjuriesOneWeek', () => {
  it('counts a postseason weekend against every injury and returns the healed', () => {
    const list = [
      { playerId: 'a', teamId: 't', weeksRemaining: 1, description: 'ankle sprain' },
      { playerId: 'b', teamId: 't', weeksRemaining: 3, description: 'broken hand' },
    ];
    const after = healInjuriesOneWeek(list);
    expect(after).toEqual([{ playerId: 'b', teamId: 't', weeksRemaining: 2, description: 'broken hand' }]);
    expect(healInjuriesOneWeek(healInjuriesOneWeek(after))).toEqual([]);
    expect(list[0]!.weeksRemaining).toBe(1);
  });
});

describe('practice during the season', () => {
  it('grows the user team at practice, logs the gains, and reports them in the news', () => {
    const base = freshState();
    const userTeam = base.dynasty.season.teams.find((t) => t.id === base.dynasty.userTeamId)!;
    const target = userTeam.roster.find((p) => p.ratings.potential > p.ratings.overall + 5)!;
    const primed = {
      ...base,
      dynasty: {
        ...base.dynasty,
        season: {
          ...base.dynasty.season,
          teams: base.dynasty.season.teams.map((t) =>
            t.id === userTeam.id
              ? { ...t, roster: t.roster.map((p) => (p.id === target.id ? { ...p, developmentProgress: 99 } : p)) }
              : t,
          ),
        },
      },
      practicePlan: { intensity: 'normal' as const, developmentPlans: [{ playerId: target.id, focus: 'balanced' as const }] },
    };
    const next = simulateOneWeek(primed, undefined, seededRandom(3));
    const grown = next.dynasty.season.teams.find((t) => t.id === userTeam.id)!.roster.find((p) => p.id === target.id);
    expect(grown!.ratings.overall).toBe(target.ratings.overall + 1);
    expect(next.practiceGains?.some((g) => g.playerId === target.id && g.week === base.dynasty.season.currentWeek)).toBe(true);
    const report = next.newsItems.find((n) => n.headline.startsWith('Practice report:'));
    expect(report?.headline).toContain(`${target.name.last} up to ${target.ratings.overall + 1}`);
    expect(next.practicePlan).toEqual(primed.practicePlan);
  });

  it('keeps the user staff for every week of a sim to the end of the season', () => {
    const base = freshState();
    const { staff } = createProgramStaff(base.dynasty);
    const done = simulateRemainingWeeks({ ...base, userStaff: staff }, undefined, seededRandom(2));
    expect(done.userStaff).toBe(staff);
  });

  it('hurts more players on intense practice than light', () => {
    const count = (intensity: 'light' | 'intense') => {
      let total = 0;
      for (let seed = 1; seed <= 6; seed += 1) {
        const done = simulateRemainingWeeks(
          { ...freshState(), dynasty: createFreshLacrosseDynasty({ now: () => 42 }), practicePlan: { intensity, developmentPlans: [] } },
          undefined,
          seededRandom(seed),
        );
        total += done.newsItems.filter((n) => n.category === 'injury' && !n.headline.includes('returned')).length;
      }
      return total;
    };
    expect(count('intense')).toBeGreaterThan(count('light'));
  });
});

describe('morale during the season', () => {
  it('sours a benched star and says so in the news', () => {
    const base = { ...freshState(), dynasty: createFreshLacrosseDynasty({ now: () => 42 }) };
    const userId = base.dynasty.userTeamId;
    const team = base.dynasty.season.teams.find((t) => t.id === userId)!;
    const attack = team.roster.filter((p) => p.position === 'ATT').sort((a, b) => b.ratings.overall - a.ratings.overall);
    const star = attack[0]!;
    // Bury the best attackman at the bottom of the depth chart.
    const benched = {
      ...team,
      roster: team.roster.map((p) => (p.id === star.id ? { ...p, morale: 55 } : p)),
      depthChart: { ATT: [...attack.slice(1).map((p) => p.id), star.id] },
    };
    let state: WeekSimState = {
      ...base,
      dynasty: { ...base.dynasty, season: { ...base.dynasty.season, teams: base.dynasty.season.teams.map((t) => (t.id === userId ? benched : t)) } },
    };
    for (let week = 0; week < 4; week += 1) state = simulateOneWeek(state, undefined, seededRandom(week + 1));
    const after = state.dynasty.season.teams.find((t) => t.id === userId)!.roster.find((p) => p.id === star.id)!;
    expect(after.morale).toBeLessThan(50);
    expect(state.newsItems.some((n) => n.headline.includes(`${star.name.first} ${star.name.last} is `) && /starting/.test(n.headline))).toBe(true);
  });
});

describe('redshirts during the season', () => {
  it('sits a redshirting player out of every game and lets CPU staffs redshirt before the opener', () => {
    const base = { ...freshState(), dynasty: createFreshLacrosseDynasty({ now: () => 7 }) };
    const userId = base.dynasty.userTeamId;
    const team = base.dynasty.season.teams.find((t) => t.id === userId)!;
    const star = [...team.roster].filter((p) => p.position === 'ATT').sort((a, b) => b.ratings.overall - a.ratings.overall)[0]!;
    const redshirted = { ...team, roster: team.roster.map((p) => (p.id === star.id ? { ...p, redshirtStatus: 'redshirting' as const } : p)) };
    let state: WeekSimState = {
      ...base,
      dynasty: { ...base.dynasty, season: { ...base.dynasty.season, teams: base.dynasty.season.teams.map((t) => (t.id === userId ? redshirted : t)) } },
    };
    for (let week = 0; week < 3; week += 1) state = simulateOneWeek(state, undefined, seededRandom(week + 11));
    expect(state.seasonStats[star.id]?.gamesPlayed ?? 0).toBe(0);
    const cpuRedshirts = state.dynasty.season.teams
      .filter((t) => t.id !== userId)
      .reduce((sum, t) => sum + t.roster.filter((p) => p.redshirtStatus === 'redshirting').length, 0);
    expect(cpuRedshirts).toBeGreaterThan(0);
    // The user's own calls are left alone.
    const userRedshirts = state.dynasty.season.teams.find((t) => t.id === userId)!.roster.filter((p) => p.redshirtStatus === 'redshirting');
    expect(userRedshirts.map((p) => p.id)).toEqual([star.id]);
  });
});
