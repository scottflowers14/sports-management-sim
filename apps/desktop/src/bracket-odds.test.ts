import { describe, expect, it } from 'vitest';
import type { NcaaEntry, TournamentGame, TournamentState } from './tournament';
import { formatOdds, ncaaOdds } from './bracket-odds';

const ids = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);
const field: NcaaEntry[] = ids.map((teamId, i) => ({ teamId, seed: i + 1, bid: 'at-large', rpi: 0.7 - i * 0.01 }));
// Seed n is rated 90 - n: better seeds are better teams.
const ratingOf = (id: string) => 90 - Number(id.slice(1));
const g = (id: string, home: string, away: string, winner?: string): TournamentGame => ({
  id,
  homeTeamId: home,
  awayTeamId: away,
  conferenceId: null,
  ...(winner ? { result: { winnerId: winner, loserId: winner === home ? away : home, winnerScore: 10, loserScore: 8, overtime: false } } : {}),
});
const firstRound: TournamentState = {
  phase: 'ncaa_first_round',
  conferenceBrackets: [],
  ncaaField: field,
  ncaaFirstRound: [g('a', 't8', 't9'), g('b', 't5', 't12'), g('c', 't6', 't11'), g('d', 't7', 't10')],
};
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('ncaaOdds', () => {
  it('fills every round exactly once across the field', () => {
    const odds = ncaaOdds(firstRound, ratingOf)!;
    expect(odds).toHaveLength(12);
    expect(sum(odds.map((o) => o.quarterfinal!))).toBeCloseTo(8);
    expect(sum(odds.map((o) => o.finalFour))).toBeCloseTo(4);
    expect(sum(odds.map((o) => o.titleGame))).toBeCloseTo(2);
    expect(sum(odds.map((o) => o.champion))).toBeCloseTo(1);
  });

  it('gives byes a sure quarterfinal and favors better seeds', () => {
    const odds = ncaaOdds(firstRound, ratingOf)!;
    expect(odds.slice(0, 4).every((o) => o.quarterfinal === 1)).toBe(true);
    const champ = odds.map((o) => o.champion);
    for (let i = 1; i < champ.length; i++) expect(champ[i - 1]!).toBeGreaterThan(champ[i]!);
    // Each team's chances only shrink round by round.
    for (const o of odds) expect(o.quarterfinal!).toBeGreaterThanOrEqual(o.finalFour);
    for (const o of odds) expect(o.titleGame).toBeGreaterThanOrEqual(o.champion);
  });

  it('updates as games are played and zeroes out eliminated teams', () => {
    const qf: TournamentState = {
      ...firstRound,
      phase: 'ncaa_quarterfinals',
      ncaaFirstRound: [g('a', 't8', 't9', 't9'), g('b', 't5', 't12', 't12'), g('c', 't6', 't11', 't6'), g('d', 't7', 't10', 't7')],
      ncaaQuarterfinals: [g('q1', 't1', 't9'), g('q2', 't4', 't12'), g('q3', 't3', 't6'), g('q4', 't2', 't7')],
    };
    const odds = ncaaOdds(qf, ratingOf)!;
    const of = (id: string) => odds.find((o) => o.teamId === id)!;
    expect(of('t8')).toMatchObject({ quarterfinal: 0, finalFour: 0, champion: 0 });
    expect(of('t12').quarterfinal).toBe(1);
    expect(sum(odds.map((o) => o.champion))).toBeCloseTo(1);

    const final: TournamentState = { ...qf, phase: 'national_final', nationalGame: g('n', 't1', 't12') };
    const fOdds = ncaaOdds(final, ratingOf)!;
    expect(fOdds.find((o) => o.teamId === 't12')!.titleGame).toBe(1);
    expect(fOdds.find((o) => o.teamId === 't1')!.champion).toBeGreaterThan(0.5);

    const done = ncaaOdds({ ...final, phase: 'complete', nationalGame: g('n', 't1', 't12', 't12'), nationalChampion: 't12' }, ratingOf)!;
    expect(done.find((o) => o.teamId === 't12')!.champion).toBe(1);
    expect(done.find((o) => o.teamId === 't1')!.champion).toBe(0);
  });

  it('handles a final-four league and waits for the field', () => {
    const four: TournamentState = {
      phase: 'national_semis',
      conferenceBrackets: [],
      ncaaField: field.slice(0, 4),
      nationalSemiFinal1: g('s1', 't1', 't4'),
      nationalSemiFinal2: g('s2', 't2', 't3'),
    };
    const odds = ncaaOdds(four, ratingOf)!;
    expect(odds.every((o) => o.quarterfinal === null && o.finalFour === 1)).toBe(true);
    expect(sum(odds.map((o) => o.champion))).toBeCloseTo(1);
    expect(ncaaOdds({ phase: 'conf_semis', conferenceBrackets: [] }, ratingOf)).toBeNull();
  });

  it('formats odds for the table', () => {
    expect(formatOdds(1)).toBe('✓');
    expect(formatOdds(0)).toBe('Out');
    expect(formatOdds(0.003)).toBe('<1%');
    expect(formatOdds(0.234)).toBe('23%');
    expect(formatOdds(null)).toBe('–');
  });
});
