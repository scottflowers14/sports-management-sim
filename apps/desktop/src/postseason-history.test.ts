import { describe, expect, it } from 'vitest';
import type { DynastySeasonRecord } from './history';
import { postseasonRun, postseasonSummary } from './postseason-history';
import { postseasonRoundOf, type PostseasonRound, type SeasonGameRecord } from './series-history';

const reg = (gf: number, ga: number): SeasonGameRecord => ({ opponentId: 'x', goalsFor: gf, goalsAgainst: ga });
const post = (round: PostseasonRound, gf: number, ga: number): SeasonGameRecord => ({ opponentId: 'y', goalsFor: gf, goalsAgainst: ga, postseason: true, round });

function season(year: number, games: SeasonGameRecord[], extra: Partial<DynastySeasonRecord> = {}): DynastySeasonRecord {
  return { year, wins: 8, losses: 2, confStanding: 1, natRankAtEnd: 3, confChampion: false, nationalChampion: false, signingClassSize: 5, games, ...extra };
}

describe('postseasonRoundOf', () => {
  it('reads the round from tournament game ids', () => {
    expect(postseasonRoundOf('acc-sf1')).toBe('conf_semi');
    expect(postseasonRoundOf('big-ten-final')).toBe('conf_final');
    expect(postseasonRoundOf('ncaa-r1-8v9')).toBe('ncaa_first_round');
    expect(postseasonRoundOf('ncaa-qf-4')).toBe('ncaa_quarterfinal');
    expect(postseasonRoundOf('national-semi-2')).toBe('national_semi');
    expect(postseasonRoundOf('national-championship')).toBe('national_final');
    expect(postseasonRoundOf('g-12')).toBeNull();
  });
});

describe('postseasonRun', () => {
  it('finds the round the program went out in', () => {
    const run = postseasonRun(season(2030, [reg(10, 5), post('conf_semi', 9, 8), post('conf_final', 6, 7), post('ncaa_quarterfinal', 12, 9), post('national_semi', 8, 11)], { ncaaSeed: 3 }))!;
    expect(run).toEqual({ year: 2030, ncaaSeed: 3, finish: 'final-four', ncaaWins: 1, ncaaLosses: 1, confWins: 1, confLosses: 1 });
    expect(postseasonRun(season(2031, [post('ncaa_first_round', 4, 9)]))!.finish).toBe('first-round');
    expect(postseasonRun(season(2032, [post('national_final', 9, 10)]))!.finish).toBe('runner-up');
    expect(postseasonRun(season(2033, [post('national_final', 10, 9)], { nationalChampion: true }))!.finish).toBe('champion');
  });

  it('counts a season with no NCAA games as missed and skips old saves', () => {
    expect(postseasonRun(season(2030, [reg(5, 6), post('conf_semi', 3, 7)]))!.finish).toBe('missed');
    expect(postseasonRun(season(2030, [{ opponentId: 'y', goalsFor: 3, goalsAgainst: 7, postseason: true }]))).toBeNull();
    const noGames = season(2030, []);
    delete noGames.games;
    expect(postseasonRun(noGames)).toBeNull();
  });
});

describe('postseasonSummary', () => {
  it('totals appearances, records and deep runs', () => {
    const history = [
      season(2033, [post('ncaa_quarterfinal', 10, 9), post('national_semi', 9, 8), post('national_final', 10, 9)], { nationalChampion: true }),
      season(2032, [post('conf_semi', 5, 6)]),
      season(2031, [post('conf_semi', 8, 6), post('conf_final', 9, 6), post('ncaa_quarterfinal', 7, 10)]),
    ];
    expect(postseasonSummary(history)).toEqual({
      seasons: 3,
      appearances: 2,
      ncaaWins: 3,
      ncaaLosses: 1,
      confWins: 2,
      confLosses: 1,
      finalFours: 1,
      titleGames: 1,
      titles: 1,
      best: 'champion',
    });
    expect(postseasonSummary([]).best).toBeNull();
  });
});
