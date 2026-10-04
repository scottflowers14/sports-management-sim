import { describe, expect, it } from 'vitest';
import { applyProDraftPrestige, draftGrade, draftSlotLabel, ordinal, PRO_DRAFT_ROUNDS, PRO_TEAMS, proDraftPrestigeBoost, runProDraft } from './pro-draft';
import type { ProDraftPick } from './pro-draft';
import type { LacrossePlayer, LacrossePosition, LacrosseTeam } from './models';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';

let nextId = 0;
function player(position: LacrossePosition, overall: number, classYear: LacrossePlayer['classYear'] = 'SR'): LacrossePlayer {
  const base = makeLacrossePlayer(nextId++, position);
  return { ...base, classYear, ratings: { ...base.ratings, overall } };
}

function team(id: string, roster: LacrossePlayer[]): LacrosseTeam {
  return { ...makeLacrosseTeam(id, []), roster };
}

describe('runProDraft', () => {
  it('drafts four rounds of departing players, best first', () => {
    const seniors = Array.from({ length: 40 }, (_, i) => player('MID', 60 + (i % 30)));
    const picks = runProDraft([team('a', seniors.slice(0, 20)), team('b', seniors.slice(20))], { year: 2030, seed: 1 });
    expect(picks).toHaveLength(PRO_DRAFT_ROUNDS * PRO_TEAMS.length);
    expect(picks.map((p) => p.overallPick)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(new Set(picks.map((p) => p.playerId)).size).toBe(32);
    // Every club picks once a round, in the same order each round.
    const firstRound = picks.filter((p) => p.round === 1).map((p) => p.proTeam);
    expect(new Set(firstRound).size).toBe(PRO_TEAMS.length);
    expect(picks.filter((p) => p.round === 3).map((p) => p.proTeam)).toEqual(firstRound);
    // Scouting noise reorders close calls, never an 89 behind a 61.
    const firstRoundAvg = picks.slice(0, 8).reduce((s, p) => s + p.overall, 0) / 8;
    const lastRoundAvg = picks.slice(24).reduce((s, p) => s + p.overall, 0) / 8;
    expect(firstRoundAvg).toBeGreaterThan(lastRoundAvg + 10);
  });

  it('only takes seniors and grad students good enough to play pro', () => {
    const roster = [player('ATT', 90, 'JR'), player('ATT', 80, 'GR'), player('ATT', 75), player('DEF', 55)];
    const picks = runProDraft([team('a', roster)], { year: 2030, seed: 1 });
    expect(picks.map((p) => p.overall).sort()).toEqual([75, 80]);
  });

  it('caps specialists', () => {
    const goalies = Array.from({ length: 10 }, () => player('GK', 90));
    const picks = runProDraft([team('a', [...goalies, ...Array.from({ length: 40 }, () => player('DEF', 65))])], { year: 2030, seed: 2 });
    expect(picks.filter((p) => p.position === 'GK')).toHaveLength(3);
    expect(picks).toHaveLength(32);
  });

  it('moves a productive senior up the board', () => {
    const quiet = player('ATT', 72);
    const star = player('ATT', 72);
    const field = Array.from({ length: 60 }, () => player('MID', 72));
    const order = (production: Record<string, number>) => {
      const picks = runProDraft([team('a', [quiet, star, ...field])], { year: 2030, seed: 5, productionByPlayerId: production });
      return picks.findIndex((p) => p.playerId === star.id);
    };
    const without = order({});
    const withBonus = order({ [star.id]: 10 });
    expect(withBonus).toBeGreaterThanOrEqual(0);
    expect(without === -1 || withBonus < without).toBe(true);
    expect(draftGrade(72, 10)).toBe(78);
    expect(draftGrade(72, 50)).toBe(78);
  });

  it('is repeatable for the same year and seed', () => {
    const roster = Array.from({ length: 40 }, (_, i) => player('MID', 60 + i));
    const teams = [team('a', roster)];
    expect(runProDraft(teams, { year: 2030, seed: 9 })).toEqual(runProDraft(teams, { year: 2030, seed: 9 }));
  });
});

function pick(collegeTeamId: string, round: number): ProDraftPick {
  return { year: 2030, round, pick: 1, overallPick: 1, proTeam: 'Harbor Hawks', playerId: `p-${round}`, name: 'X', position: 'ATT', overall: 80, collegeTeamId };
}

describe('pro draft prestige', () => {
  it('rewards a first-round pick', () => {
    expect(proDraftPrestigeBoost([pick('a', 2), pick('a', 3), pick('a', 4)], 'a')).toBe(0);
    expect(proDraftPrestigeBoost([pick('a', 1)], 'a')).toBe(1);
    expect(proDraftPrestigeBoost([pick('a', 1), pick('a', 1)], 'a')).toBe(1);
    expect(proDraftPrestigeBoost([pick('b', 1)], 'a')).toBe(0);
    const [a, b] = applyProDraftPrestige([team('a', []), team('b', [])], [pick('a', 1)]);
    expect(a!.reputation.nationalPrestige).toBe(makeLacrosseTeam('a', []).reputation.nationalPrestige + 1);
    expect(b!.reputation.nationalPrestige).toBe(makeLacrosseTeam('b', []).reputation.nationalPrestige);
  });
});

describe('draftSlotLabel', () => {
  it('names the slot', () => {
    expect(draftSlotLabel({ round: 1, pick: 3, overallPick: 3 })).toBe('Round 1, pick 3');
    expect(draftSlotLabel({ round: 2, pick: 1, overallPick: 9 })).toBe('Round 2, pick 1 (9th overall)');
    expect(draftSlotLabel({ round: 2, pick: 3, overallPick: 11 })).toBe('Round 2, pick 3 (11th overall)');
    expect(draftSlotLabel({ round: 3, pick: 6, overallPick: 22 })).toBe('Round 3, pick 6 (22nd overall)');
    expect([1, 2, 3, 4, 12, 13, 21, 23, 32].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '12th', '13th', '21st', '23rd', '32nd']);
  });
});
