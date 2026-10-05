import { describe, expect, it, vi } from 'vitest';
import { attendanceOf, createNewLacrosseDynasty, gateReceipts, ensureHeadCoaches, seasonAttendance, stadiumCapacity, teamCaptains } from '@sports-management-sim/sport-lacrosse';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { previewUserGame, simulateOneWeek, simulateRemainingWeeks, type WeekSimState } from './week-sim';
import { healInjuriesOneWeek, runOffseason, withSelloutFans } from './dynasty-helpers';
import { createProgramStaff } from './program-staff';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function freshState(): WeekSimState {
  return freshStateWith(createFreshLacrosseDynasty());
}

/** The same league every call: createFreshLacrosseDynasty never reuses a seed. */
function fixedDynasty(): WeekSimState['dynasty'] {
  const dynasty = createNewLacrosseDynasty({ seed: 42, userTeamId: 'maryland-state', seasonYear: 2028 });
  return { ...dynasty, season: { ...dynasty.season, teams: ensureHeadCoaches(dynasty.season.teams, dynasty.userTeamId, 2028, 42) } };
}

function freshStateWith(dynasty: WeekSimState['dynasty']): WeekSimState {
  return {
    dynasty,
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

  it('names an offensive and a defensive player of the week', () => {
    const next = simulateOneWeek(freshState(), undefined, seededRandom(5));
    const potw = next.newsItems.find((n) => n.headline.startsWith('Player of the Week:'));
    expect(potw).toBeDefined();
    expect(potw!.category).toBe('award');
    expect(potw!.headline).toMatch(/, \d+G, \d+A$/);
    expect(next.newsItems.some((n) => n.headline.startsWith('Defensive Player of the Week:'))).toBe(true);
    expect(next.weeklyHonors?.map((h) => h.kind)).toEqual(['offense', 'defense']);
    const again = simulateOneWeek(next, undefined, seededRandom(6));
    expect(again.weeklyHonors).toHaveLength(4);
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
        // Both intensities play the same league and the same box-score rolls,
        // so the only difference is practice. The test flaked ~1 run in 12
        // when box scores drew from an unpinned Math.random and the league
        // came from createFreshLacrosseDynasty, whose seed never repeats.
        const pinned = vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed + 100));
        const state: WeekSimState = { ...freshStateWith(fixedDynasty()), practicePlan: { intensity, developmentPlans: [] } };
        const done = simulateRemainingWeeks(state, undefined, seededRandom(seed));
        pinned.mockRestore();
        total += done.newsItems.filter((n) => n.category === 'injury' && !n.headline.includes('returned')).length;
      }
      return total;
    };
    expect(count('intense')).toBeGreaterThan(count('light'));
  });
});

describe('morale during the season', () => {
  it('sours a benched star and says so in the news', () => {
    // fixedDynasty, not createFreshLacrosseDynasty({ now }): the factory never reissues a seed, so `now` alone
    // gave a different league every run and the star sometimes kept his morale up.
    const base = freshStateWith(fixedDynasty());
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
    const base = freshStateWith(fixedDynasty());
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
    // ...and named their captains.
    expect(state.dynasty.season.teams.filter((t) => t.id !== userId).every((t) => teamCaptains(t).length === 2)).toBe(true);
    expect(teamCaptains(state.dynasty.season.teams.find((t) => t.id === userId)!)).toHaveLength(0);
    // The user's own calls are left alone.
    const userRedshirts = state.dynasty.season.teams.find((t) => t.id === userId)!.roster.filter((p) => p.redshirtStatus === 'redshirting');
    expect(userRedshirts.map((p) => p.id)).toEqual([star.id]);
  });
});

describe('rivalries during the season', () => {
  it('records every rivalry game in the series and reports it', () => {
    const state = simulateRemainingWeeks(freshState(), undefined, seededRandom(5));
    const series = Object.values(state.rivalrySeries ?? {});
    // Rivals share a conference, so every pair meets once in the round-robin.
    expect(series.length).toBeGreaterThanOrEqual(15);
    expect(series.every((s) => Object.values(s.wins).reduce((a, b) => a + b, 0) === 1 && s.holderId !== null)).toBe(true);
    expect(state.newsItems.some((n) => /^Rivalry: .+ wins The \w+ \w+, beating .+ \d+-\d+ \(leads the series 1-0\)$/.test(n.headline))).toBe(true);
  });
});

describe('coached games', () => {
  it('plays the first half exactly as previewed at halftime', () => {
    const state = freshStateWith(fixedDynasty());
    const plan = { tempo: 'balanced', defense: 'balanced', ride: 'standard', rotation: 'balanced' } as const;
    const preview = previewUserGame(state, plan, 1234)!;
    expect(preview).not.toBeNull();
    const half = (events: { period: unknown }[]) => events.filter((e) => e.period === 1 || e.period === 2);
    const after = simulateOneWeek(state, plan, Math.random, {
      seed: 1234,
      secondHalfPlan: { ...plan, tempo: 'uptempo', defense: 'pressure' },
    });
    const played = after.gameLogs.get(preview.game.id)!;
    expect(half(played.events)).toEqual(half(preview.log.events));
    // Same seed, same plan after the break: the whole game matches the preview.
    const unchanged = simulateOneWeek(state, plan, Math.random, { seed: 1234, secondHalfPlan: plan });
    expect(unchanged.gameLogs.get(preview.game.id)!.events).toEqual(preview.log.events);
  });
});

describe('pregame team talk', () => {
  it('adds its edge to the user game only in the week it was given', () => {
    const state = freshStateWith(fixedDynasty());
    const plan = { tempo: 'balanced', defense: 'balanced', ride: 'standard', rotation: 'balanced' } as const;
    const { year, currentWeek } = state.dynasty.season;
    // An outsized edge so the effect shows up in a single game.
    const result = { reaction: 'positive' as const, edge: { offense: 0.3, defense: 0.3 } };
    const userGoals = (s: WeekSimState) =>
      previewUserGame(s, plan, 99)!.log.events.filter((e) => e.type === 'goal' && e.teamId === s.dynasty.userTeamId).length;
    const base = userGoals(state);
    const talked = userGoals({ ...state, teamTalk: { year, week: currentWeek, tone: 'fire_up', result } });
    const stale = userGoals({ ...state, teamTalk: { year: year - 1, week: currentWeek, tone: 'fire_up', result } });
    expect(talked).toBeGreaterThan(base);
    expect(stale).toBe(base);
  });
});

describe('game-day attendance', () => {
  it('stamps a gate on every home game, within the home stadium', () => {
    const state = freshStateWith(fixedDynasty());
    const next = simulateOneWeek(state, undefined, seededRandom(3));
    const played = next.dynasty.season.schedule.filter((g) => g.week === 1 && g.status === 'final');
    expect(played.length).toBeGreaterThan(0);
    for (const g of played) {
      const gate = attendanceOf(g);
      if (g.neutralSite) {
        expect(gate).toBeUndefined();
        continue;
      }
      const home = next.dynasty.season.teams.find((t) => t.id === g.homeTeamId)!;
      expect(gate!.capacity).toBe(stadiumCapacity(home));
      expect(gate!.count).toBeGreaterThan(0);
      expect(gate!.count).toBeLessThanOrEqual(gate!.capacity);
    }
  });

  it('grows fan support from a season of sellouts', () => {
    const state = simulateRemainingWeeks(freshStateWith(fixedDynasty()), undefined, seededRandom(4));
    const { schedule, teams } = state.dynasty.season;
    const seller = teams.find((t) => (seasonAttendance(schedule, t.id)?.sellouts ?? 0) >= 2);
    expect(seller).toBeDefined();
    const after = withSelloutFans(seller!, schedule);
    expect(after.reputation.fanSupport).toBeGreaterThan(seller!.reputation.fanSupport);
    const quiet = teams.find((t) => (seasonAttendance(schedule, t.id)?.sellouts ?? 0) < 2)!;
    expect(withSelloutFans(quiet, schedule)).toBe(quiet);
  });

  it('reports the user gate receipts in the offseason summary', () => {
    const state = simulateRemainingWeeks(freshStateWith(fixedDynasty()), undefined, seededRandom(4));
    const { summary } = runOffseason(state.dynasty);
    const expected = gateReceipts(seasonAttendance(state.dynasty.season.schedule, state.dynasty.userTeamId));
    expect(summary.gate).toEqual(expected);
    expect(summary.gate!.homeGames).toBeGreaterThan(0);
    expect(summary.gate!.bonus).toBeGreaterThan(0);
  });
});
