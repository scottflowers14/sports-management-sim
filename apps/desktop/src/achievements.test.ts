import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  MAX_ACHIEVEMENT_POINTS,
  TIER_POINTS,
  achievementPoints,
  achievementProgress,
  achievementWatch,
  achievementXp,
  coachRivalryRecord,
  nextProfileTitle,
  profileTitle,
  PROFILE_TITLES,
  ACHIEVEMENT_BY_ID,
  newlyUnlocked,
  profileLevel,
  type AchievementSnapshot,
} from './achievements';
import type { DynastySeasonRecord } from './history';

function season(year: number, overrides: Partial<DynastySeasonRecord> = {}): DynastySeasonRecord {
  return {
    year,
    wins: 6,
    losses: 4,
    confStanding: 3,
    natRankAtEnd: 15,
    confChampion: false,
    nationalChampion: false,
    signingClassSize: 7,
    teamName: 'Maryland State',
    ...overrides,
  };
}

function snapshot(overrides: Partial<AchievementSnapshot> = {}): AchievementSnapshot {
  return { history: [], hallOfFame: 0, proPicks: 0, abilityTiers: [], ...overrides };
}

const ids = (s: AchievementSnapshot, unlocked = {}) => newlyUnlocked(s, unlocked).map((a) => a.id);

describe('achievements', () => {
  it('has unique ids and a point value for every tier', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(MAX_ACHIEVEMENT_POINTS).toBe(ACHIEVEMENTS.reduce((n, a) => n + TIER_POINTS[a.tier], 0));
  });

  it('starts with nothing unlocked', () => {
    expect(ids(snapshot())).toEqual([]);
  });

  it('unlocks game achievements from this season as they happen', () => {
    const current = {
      games: [
        { opponentId: 'a', goalsFor: 21, goalsAgainst: 9 },
        { opponentId: 'b', goalsFor: 8, goalsAgainst: 7, opponentRank: 3 },
      ],
    };
    expect(ids(snapshot({ current }))).toEqual(['first-win', 'blowout', 'nail-biter', 'twenty-spot', 'giant-killer']);
    // A loss to a top-5 team isn't a giant-killing.
    expect(ids(snapshot({ current: { games: [{ opponentId: 'b', goalsFor: 6, goalsAgainst: 7, opponentRank: 2 }] } }))).toEqual([]);
  });

  it('counts postseason wins and lockdown defense', () => {
    const current = { games: [{ opponentId: 'a', goalsFor: 9, goalsAgainst: 4, postseason: true as const }] };
    expect(ids(snapshot({ current }))).toEqual(expect.arrayContaining(['postseason-win', 'lockdown']));
  });

  it('unlocks season achievements from finished seasons', () => {
    const history = [
      season(2030, { wins: 10, losses: 0, nationalChampion: true, confChampion: true, natRankAtEnd: 1 }),
      season(2029, { wins: 4, losses: 6 }),
    ];
    const earned = ids(snapshot({ history }));
    expect(earned).toEqual(
      expect.arrayContaining(['winning-season', 'ten-wins', 'perfect-regular-season', 'conference-title', 'top-five', 'national-title', 'turnaround']),
    );
    expect(earned).not.toContain('back-to-back');
  });

  it('needs consecutive titles for back-to-back and three for a dynasty', () => {
    const champ = { nationalChampion: true };
    expect(ids(snapshot({ history: [season(2031, champ), season(2030), season(2029, champ)] }))).not.toContain('back-to-back');
    const three = ids(snapshot({ history: [season(2031, champ), season(2030, champ), season(2029, champ)] }));
    expect(three).toEqual(expect.arrayContaining(['back-to-back', 'dynasty']));
  });

  it('only counts a turnaround at the same program', () => {
    const history = [season(2030, { wins: 9, teamName: 'Penn Grove' }), season(2029, { wins: 3 })];
    expect(ids(snapshot({ history }))).not.toContain('turnaround');
    expect(ids(snapshot({ history }))).toContain('journeyman');
  });

  it('tracks career totals across seasons and this season', () => {
    const history = Array.from({ length: 10 }, (_, i) => season(2030 - i, { wins: 9, losses: 1 }));
    const earned = ids(snapshot({ history }));
    expect(earned).toEqual(expect.arrayContaining(['fifty-wins', 'ten-seasons', 'staying-power']));
    expect(earned).not.toContain('hundred-wins');
    const tenMore = { games: Array.from({ length: 10 }, () => ({ opponentId: 'x', goalsFor: 10, goalsAgainst: 8 })) };
    expect(ids(snapshot({ history, current: tenMore }))).toContain('hundred-wins');
  });

  it('reads players, awards and coach abilities', () => {
    const history = [
      season(2030, {
        allAmericans: [{ award: 'First Team', playerName: 'A B', teamName: 'Maryland State', position: 'ATT' }],
        awards: [{ award: 'MVP', playerName: 'A B', teamName: 'Maryland State', position: 'ATT' }],
        coachOfYear: true,
      }),
    ];
    const earned = ids(snapshot({ history, hallOfFame: 1, proPicks: 5, abilityTiers: [3, 0] }));
    expect(earned).toEqual(
      expect.arrayContaining(['all-american', 'mvp', 'hall-of-famer', 'pro-pipeline', 'coach-of-year', 'first-upgrade', 'master']),
    );
  });

  it('does not repeat an unlock', () => {
    const current = { games: [{ opponentId: 'a', goalsFor: 9, goalsAgainst: 8 }] };
    const at = { year: 2028, at: '2026-10-06T00:00:00Z' };
    expect(ids(snapshot({ current }), { 'first-win': at, 'nail-biter': at })).toEqual([]);
  });

  it('adds up points into profile levels', () => {
    const at = { year: 2028, at: '' };
    expect(achievementPoints({ 'first-win': at, 'national-title': at, unknown: at })).toBe(60);
    expect(profileLevel(0)).toEqual({ level: 1, intoLevel: 0, perLevel: 100 });
    expect(profileLevel(260)).toEqual({ level: 3, intoLevel: 60, perLevel: 100 });
  });

  it('reports progress toward count-based achievements, capped at the target', () => {
    const history = [season(2030, { wins: 9, losses: 1, nationalChampion: true, proPicks: 2 }), season(2029, { wins: 7, losses: 3 })];
    const snap = snapshot({ history, proPicks: 7, challengesCompleted: 4, current: { games: [{ opponentId: 'a', goalsFor: 9, goalsAgainst: 2 }] } });
    const progress = (id: string) => achievementProgress(ACHIEVEMENT_BY_ID.get(id)!, snap);
    expect(progress('fifty-wins')).toEqual({ current: 17, target: 50 });
    expect(progress('ten-wins')).toEqual({ current: 9, target: 10 });
    expect(progress('dynasty')).toEqual({ current: 1, target: 3 });
    expect(progress('staying-power')).toEqual({ current: 2, target: 5 });
    expect(progress('pro-pipeline')).toEqual({ current: 5, target: 5 });
    expect(progress('challenge-accepted')).toEqual({ current: 4, target: 10 });
    expect(progress('national-title')).toBeNull();
  });

  it('names each profile level and points to the next title', () => {
    expect(profileTitle(1)).toBe('Rookie Coach');
    expect(profileTitle(9)).toBe('Program Builder');
    expect(profileTitle(40)).toBe('Legend of the Game');
    expect(nextProfileTitle(9)).toEqual({ level: 10, title: 'Champion' });
    expect(nextProfileTitle(16)).toBeNull();
    // The top title needs nearly every point there is, and stays reachable.
    const top = PROFILE_TITLES[PROFILE_TITLES.length - 1]!.level;
    expect(profileLevel(MAX_ACHIEVEMENT_POINTS).level).toBeGreaterThanOrEqual(top);
    expect((top - 1) * 100).toBeGreaterThanOrEqual(MAX_ACHIEVEMENT_POINTS * 0.85);
  });

  it('unlocks perfection, trifecta, postseason, award and recruiting achievements', () => {
    const g = (goalsFor: number, goalsAgainst: number, postseason = false) => ({ opponentId: 'x', goalsFor, goalsAgainst, ...(postseason ? { postseason: true as const } : {}) });
    // A title season with one loss isn't perfection; an unbeaten one is.
    const lossy = season(2028, { nationalChampion: true, games: [g(10, 8), g(7, 9), g(12, 6, true)] });
    expect(ids(snapshot({ history: [lossy] }))).not.toContain('perfection');
    const perfect = season(2029, { nationalChampion: true, games: [g(10, 8), g(12, 6, true)] });
    expect(ids(snapshot({ history: [perfect] }))).toContain('perfection');

    const conf = (year: number) => season(year, { confChampion: true });
    expect(ids(snapshot({ history: [conf(2030), conf(2029)] }))).not.toContain('conference-trifecta');
    expect(ids(snapshot({ history: [conf(2031), conf(2030), conf(2029)] }))).toContain('conference-trifecta');

    const playoffRun = season(2030, { games: Array.from({ length: 9 }, () => g(11, 9, true)) });
    const tested = ACHIEVEMENT_BY_ID.get('tournament-tested')!;
    expect(achievementProgress(tested, snapshot({ history: [playoffRun] }))).toEqual({ current: 9, target: 10 });
    expect(ids(snapshot({ history: [playoffRun], current: { games: [{ ...g(8, 7, true), opponentRank: 1 }] } }))).toContain('tournament-tested');

    const aa = (n: number) => Array.from({ length: n }, (_, i) => ({ award: '1st Team', playerName: `P${i}`, teamName: 'Maryland State', position: 'ATT' }));
    expect(ids(snapshot({ history: [season(2030, { allAmericans: aa(2) })] }))).not.toContain('all-america-factory');
    expect(ids(snapshot({ history: [season(2030, { allAmericans: aa(3) })] }))).toContain('all-america-factory');

    const award = (name: string, teamName: string) => ({ award: name, playerName: 'Star', teamName, position: 'DEF' });
    // Another program's winner doesn't count.
    expect(ids(snapshot({ history: [season(2030, { awards: [award('Defensive POY', 'Harbor City')] })] }))).not.toContain('award-season');
    const awards = [award('Defensive POY', 'Maryland State'), award('Freshman of the Year', 'Maryland State')];
    expect(ids(snapshot({ history: [season(2030, { awards })] }))).toEqual(expect.arrayContaining(['award-season', 'freshman-phenom']));

    expect(ids(snapshot({ bestCommitStars: 4 }))).not.toContain('blue-chip');
    expect(ids(snapshot({ bestCommitStars: 5 }))).toContain('blue-chip');

    const many = Array.from({ length: 20 }, (_, i) => season(2000 + i, { wins: 10, losses: 2 }));
    expect(ids(snapshot({ history: many }))).toContain('two-hundred-wins');
  });

  it('only awards The Hard Way for a title on hard', () => {
    const champ = season(2030, { nationalChampion: true });
    expect(ids(snapshot({ history: [champ], difficulty: 'normal' }))).not.toContain('hard-way');
    expect(ids(snapshot({ history: [champ] }))).not.toContain('hard-way');
    expect(ids(snapshot({ history: [champ], difficulty: 'hard' }))).toContain('hard-way');
  });

  it('builds a Hall of Fame legacy over one dynasty', () => {
    const def = ACHIEVEMENT_BY_ID.get('hall-of-fame-coach')!;
    // Ten seasons at 10-4: 100 wins + 30 margin bonus = 130.
    const steady = Array.from({ length: 10 }, (_, i) => season(2030 + i, { wins: 10, losses: 4 }));
    expect(achievementProgress(def, snapshot({ history: steady }))).toEqual({ current: 130, target: 450 });
    expect(ids(snapshot({ history: steady }))).not.toContain('hall-of-fame-coach');
    const decorated = steady.map((h, i) => ({ ...h, confChampion: true, nationalChampion: i < 4 }));
    // 130 + 10 conf titles (120) + 4 national titles (200) = 450.
    expect(ids(snapshot({ history: decorated }))).toContain('hall-of-fame-coach');
  });

  it('tracks the rivalry trophy series', () => {
    expect(ids(snapshot())).not.toContain('bragging-rights');
    const lostOnly = snapshot({ rivalry: { wins: 0, recentWins: [false] } });
    expect(ids(lostOnly)).not.toContain('bragging-rights');
    expect(ids(snapshot({ rivalry: { wins: 1, recentWins: [true] } }))).toContain('bragging-rights');

    const trophyCase = ACHIEVEMENT_BY_ID.get('trophy-case')!;
    expect(achievementProgress(trophyCase, snapshot({ rivalry: { wins: 4, recentWins: [] } }))).toEqual({ current: 4, target: 5 });
    expect(ids(snapshot({ rivalry: { wins: 5, recentWins: [] } }))).toContain('trophy-case');

    // Three straight needs the three newest meetings, not any three wins.
    expect(ids(snapshot({ rivalry: { wins: 4, recentWins: [true, false, true, true, true] } }))).not.toContain('own-the-rivalry');
    expect(ids(snapshot({ rivalry: { wins: 3, recentWins: [true, true, true] } }))).toContain('own-the-rivalry');
  });

  it('watches the locked achievements closest to unlocking', () => {
    // 45 career wins and 4 of 5 rivalry wins; 9 seasons coached.
    const history = Array.from({ length: 9 }, (_, i) => season(2030 + i, { wins: 5, losses: 5 }));
    const snap = snapshot({ history, rivalry: { wins: 4, recentWins: [true] } });
    const unlocked = Object.fromEntries(newlyUnlocked(snap, {}).map((a) => [a.id, { year: 2038, at: 'x' }]));
    const watch = achievementWatch(snap, unlocked);
    // Fewest remaining first (ties to the one further along): one season (9/10),
    // one rivalry win (4/5), then five wins to Fifty.
    expect(watch.map((w) => [w.def.id, w.target - w.current])).toEqual([
      ['ten-seasons', 1],
      ['trophy-case', 1],
      ['fifty-wins', 5],
    ]);
    // Under halfway (Century Club at 45/100) never shows; unlocked ones drop out.
    expect(achievementWatch(snap, unlocked, { max: 10 }).map((w) => w.def.id)).not.toContain('hundred-wins');
    expect(achievementWatch(snap, { ...unlocked, 'trophy-case': { year: 2038, at: 'y' } }).map((w) => w.def.id)).not.toContain('trophy-case');
  });

  it('puts an unwon trophy game first in a rivalry week', () => {
    expect(achievementWatch(snapshot(), {}, { rivalryWeek: true })[0]?.def.id).toBe('bragging-rights');
    expect(achievementWatch(snapshot(), { 'bragging-rights': { year: 2030, at: 'x' } }, { rivalryWeek: true })).toEqual([]);
    expect(achievementWatch(snapshot(), {})).toEqual([]);
  });

  it('pays half the points in coach XP', () => {
    expect(achievementXp([])).toBe(0);
    expect(achievementXp([{ tier: 'bronze' }, { tier: 'gold' }, { tier: 'platinum' }])).toBe(5 + 25 + 50);
    // Silver pays a whole 13, never a fractional 12.5.
    expect(achievementXp([{ tier: 'silver' }])).toBe(13);
  });

  it('counts only the coach\'s own trophy games at this program', () => {
    const g = (opponentId: string, goalsFor: number, goalsAgainst: number, postseason = false) => ({
      opponentId,
      goalsFor,
      goalsAgainst,
      ...(postseason ? { postseason: true as const } : {}),
    });
    const history = [
      season(2030, { games: [g('rival', 10, 8), g('other', 12, 3), g('rival', 9, 7, true)] }),
      // Coached at another program before: its rivalry games don't count here.
      season(2029, { teamName: 'Harbor City', games: [g('rival', 11, 2)] }),
      season(2028, { games: [g('rival', 6, 9)] }),
    ];
    const record = coachRivalryRecord('rival', 'Maryland State', [{ ...g('rival', 14, 13), opponentRank: null }], history);
    // This season's win, then 2030's regular-season win, then the 2028 loss; the postseason meeting is skipped.
    expect(record).toEqual({ wins: 2, recentWins: [true, true, false] });
  });
});
