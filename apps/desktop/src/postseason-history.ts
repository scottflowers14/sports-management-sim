import type { DynastySeasonRecord } from './history';
import type { PostseasonRound, SeasonGameRecord } from './series-history';

/** How far the program went in the NCAA tournament. */
export type NcaaFinish = 'champion' | 'runner-up' | 'final-four' | 'quarterfinal' | 'first-round' | 'missed';

export const NCAA_FINISH_LABELS: Record<NcaaFinish, string> = {
  champion: 'Champion',
  'runner-up': 'Runner-up',
  'final-four': 'Final Four',
  quarterfinal: 'Quarterfinal',
  'first-round': 'First round',
  missed: 'Missed',
};

export interface PostseasonRun {
  year: number;
  ncaaSeed: number | null;
  finish: NcaaFinish;
  ncaaWins: number;
  ncaaLosses: number;
  confWins: number;
  confLosses: number;
}

const NCAA_ROUNDS: ReadonlySet<PostseasonRound> = new Set(['ncaa_first_round', 'ncaa_quarterfinal', 'national_semi', 'national_final']);

const won = (g: SeasonGameRecord) => g.goalsFor > g.goalsAgainst;

/**
 * A season's postseason run. Null for seasons saved before games carried
 * their round, since the finish can't be told apart from the box scores.
 */
export function postseasonRun(record: DynastySeasonRecord): PostseasonRun | null {
  if (!record.games) return null;
  const post = record.games.filter((g) => g.postseason);
  if (post.some((g) => !g.round)) return null;
  const ncaa = post.filter((g) => g.round && NCAA_ROUNDS.has(g.round));
  const conf = post.filter((g) => g.round === 'conf_semi' || g.round === 'conf_final');
  const last = ncaa.at(-1);
  let finish: NcaaFinish = 'missed';
  if (record.nationalChampion) finish = 'champion';
  else if (last && !won(last)) {
    finish =
      last.round === 'national_final'
        ? 'runner-up'
        : last.round === 'national_semi'
          ? 'final-four'
          : last.round === 'ncaa_quarterfinal'
            ? 'quarterfinal'
            : 'first-round';
  }
  return {
    year: record.year,
    ncaaSeed: record.ncaaSeed ?? null,
    finish,
    ncaaWins: ncaa.filter(won).length,
    ncaaLosses: ncaa.length - ncaa.filter(won).length,
    confWins: conf.filter(won).length,
    confLosses: conf.length - conf.filter(won).length,
  };
}

export interface PostseasonSummary {
  /** Seasons with a known postseason run. */
  seasons: number;
  appearances: number;
  ncaaWins: number;
  ncaaLosses: number;
  confWins: number;
  confLosses: number;
  finalFours: number;
  titleGames: number;
  titles: number;
  /** Best finish so far, or null with no tracked seasons. */
  best: NcaaFinish | null;
}

const FINISH_ORDER: NcaaFinish[] = ['champion', 'runner-up', 'final-four', 'quarterfinal', 'first-round', 'missed'];

/** Career postseason totals across every season with a known run. */
export function postseasonSummary(history: readonly DynastySeasonRecord[]): PostseasonSummary {
  const runs = history.map(postseasonRun).filter((r): r is PostseasonRun => r !== null);
  const count = (...f: NcaaFinish[]) => runs.filter((r) => f.includes(r.finish)).length;
  const best = runs.length ? FINISH_ORDER.find((f) => runs.some((r) => r.finish === f))! : null;
  return {
    seasons: runs.length,
    appearances: runs.filter((r) => r.finish !== 'missed').length,
    ncaaWins: runs.reduce((s, r) => s + r.ncaaWins, 0),
    ncaaLosses: runs.reduce((s, r) => s + r.ncaaLosses, 0),
    confWins: runs.reduce((s, r) => s + r.confWins, 0),
    confLosses: runs.reduce((s, r) => s + r.confLosses, 0),
    finalFours: count('champion', 'runner-up', 'final-four'),
    titleGames: count('champion', 'runner-up'),
    titles: count('champion'),
    best,
  };
}
