import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  MAX_ACHIEVEMENT_POINTS,
  TIER_POINTS,
  achievementPoints,
  achievementProgress,
  nextProfileTitle,
  profileTitle,
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
    expect(profileTitle(6)).toBe('Program Builder');
    expect(profileTitle(40)).toBe('Legend of the Game');
    expect(nextProfileTitle(5)).toEqual({ level: 7, title: 'Champion' });
    expect(nextProfileTitle(11)).toBeNull();
  });
});
