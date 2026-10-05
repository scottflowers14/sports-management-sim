import type { LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import { cardFromPlayer } from './player-card-model';
import type { PlayerSeasonStats } from './stats';

export type CompareEdge = 'a' | 'b' | 'even' | null;

export interface CompareRow {
  label: string;
  a: number | null;
  b: number | null;
  /** Who is better on this row; null when one side has no value. */
  edge: CompareEdge;
  /** Stats where less is better (turnovers, goals allowed). */
  lowerIsBetter?: true;
}

export interface CompareSection {
  title: string;
  rows: CompareRow[];
}

function row(label: string, a: number | null | undefined, b: number | null | undefined, lowerIsBetter = false): CompareRow {
  const av = a ?? null;
  const bv = b ?? null;
  let edge: CompareEdge = null;
  if (av !== null && bv !== null) {
    edge = av === bv ? 'even' : (av > bv) !== lowerIsBetter ? 'a' : 'b';
  }
  return { label, a: av, b: bv, edge, ...(lowerIsBetter ? { lowerIsBetter: true as const } : {}) };
}

const STAT_ROWS: Array<[string, (s: PlayerSeasonStats) => number, boolean]> = [
  ['Games', (s) => s.gamesPlayed, false],
  ['Goals', (s) => s.goals, false],
  ['Assists', (s) => s.assists, false],
  ['Points', (s) => s.goals + s.assists, false],
  ['Shots', (s) => s.shots, false],
  ['Ground balls', (s) => s.groundBalls, false],
  ['Caused TOs', (s) => s.causedTurnovers, false],
  ['Turnovers', (s) => s.turnovers, true],
  ['Faceoff wins', (s) => s.faceoffWins, false],
  ['Saves', (s) => s.saves, false],
  ['Goals allowed', (s) => s.goalsAllowed, true],
];

/**
 * Side-by-side comparison of two players, OOTP style: ratings, the position
 * skills either one is judged on, and this season's stats. A skill only one
 * position carries shows as a dash for the other player. Stat rows both
 * players have at zero are dropped so a goalie vs attackman stays readable.
 */
export function comparePlayers(
  a: LacrossePlayer,
  b: LacrossePlayer,
  stats: { a?: PlayerSeasonStats | undefined; b?: PlayerSeasonStats | undefined } = {},
): CompareSection[] {
  const cardA = cardFromPlayer(a);
  const cardB = cardFromPlayer(b);

  const ratings = [
    row('Overall', cardA.overall, cardB.overall),
    row('Potential', cardA.potential, cardB.potential),
    ...cardA.ratings.map((r, i) => row(r.label, r.value, cardB.ratings[i]?.value)),
  ];

  const skillLabels = [...new Set([...cardA.skills, ...cardB.skills].map((s) => s.label))];
  const skills = skillLabels.map((label) =>
    row(label, cardA.skills.find((s) => s.label === label)?.value, cardB.skills.find((s) => s.label === label)?.value),
  );

  const season = STAT_ROWS.map(([label, read, lower]) =>
    row(label, stats.a ? read(stats.a) : 0, stats.b ? read(stats.b) : 0, lower),
  ).filter((r) => r.label === 'Games' || r.a !== 0 || r.b !== 0);

  return [
    { title: 'Ratings', rows: ratings },
    { title: 'Skills', rows: skills },
    { title: 'This season', rows: season },
  ];
}

/** How many rows each player wins, ignoring ties and missing values. */
export function compareTally(sections: CompareSection[]): { a: number; b: number } {
  const rows = sections.flatMap((s) => s.rows);
  return { a: rows.filter((r) => r.edge === 'a').length, b: rows.filter((r) => r.edge === 'b').length };
}
