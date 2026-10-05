import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { DynastySeasonRecord } from './history';
import { tournamentGames, type TournamentState } from './tournament';

/** One of the user's games, kept in season history for head-to-head series. */
export interface SeasonGameRecord {
  opponentId: string;
  goalsFor: number;
  goalsAgainst: number;
  postseason?: true;
}

export interface SeriesRecord {
  opponentId: string;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Most recent meeting, with the season it was played in. */
  last: { year: number; won: boolean; goalsFor: number; goalsAgainst: number; postseason: boolean } | null;
  /** Current streak in the series, e.g. { won: true, count: 3 } for W3. */
  streak: { won: boolean; count: number } | null;
}

/** Every final game the team played this season, regular season then postseason. */
export function userSeasonGames(
  schedule: readonly ScheduledGame[],
  tournament: TournamentState | null | undefined,
  teamId: string,
): SeasonGameRecord[] {
  const regular = schedule
    .filter((g) => g.status === 'final' && g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => a.week - b.week)
    .map((g): SeasonGameRecord => {
      const home = g.homeTeamId === teamId;
      return {
        opponentId: home ? g.awayTeamId : g.homeTeamId,
        goalsFor: home ? g.result!.homeScore : g.result!.awayScore,
        goalsAgainst: home ? g.result!.awayScore : g.result!.homeScore,
      };
    });
  const postseason = tournament
    ? tournamentGames(tournament)
        .filter((g) => g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId))
        .map((g): SeasonGameRecord => {
          const won = g.result!.winnerId === teamId;
          return {
            opponentId: g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId,
            goalsFor: won ? g.result!.winnerScore : g.result!.loserScore,
            goalsAgainst: won ? g.result!.loserScore : g.result!.winnerScore,
            postseason: true,
          };
        })
    : [];
  return [...regular, ...postseason];
}

/**
 * Head-to-head series against every opponent the coach has faced, from past
 * seasons in history plus this season's games so far. Seasons saved before
 * game records existed simply don't count.
 */
export function allSeries(
  history: readonly DynastySeasonRecord[],
  current: { year: number; games: readonly SeasonGameRecord[] } | null = null,
): Map<string, SeriesRecord> {
  const seasons = [...history]
    .sort((a, b) => a.year - b.year)
    .map((h) => ({ year: h.year, games: h.games ?? [] }));
  if (current) seasons.push({ year: current.year, games: [...current.games] });

  const series = new Map<string, SeriesRecord>();
  for (const season of seasons) {
    for (const game of season.games) {
      const won = game.goalsFor > game.goalsAgainst;
      const s =
        series.get(game.opponentId) ??
        { opponentId: game.opponentId, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, last: null, streak: null };
      if (won) s.wins += 1;
      else s.losses += 1;
      s.goalsFor += game.goalsFor;
      s.goalsAgainst += game.goalsAgainst;
      s.last = {
        year: season.year,
        won,
        goalsFor: game.goalsFor,
        goalsAgainst: game.goalsAgainst,
        postseason: game.postseason === true,
      };
      s.streak = s.streak && s.streak.won === won ? { won, count: s.streak.count + 1 } : { won, count: 1 };
      series.set(game.opponentId, s);
    }
  }
  return series;
}

export function formatSeries(s: SeriesRecord | undefined): string {
  if (!s || s.wins + s.losses === 0) return 'First meeting';
  const lead = s.wins > s.losses ? 'lead' : s.wins < s.losses ? 'trail' : 'tied';
  return `${s.wins}-${s.losses} (${lead})`;
}

export function formatStreak(s: SeriesRecord): string {
  return s.streak ? `${s.streak.won ? 'W' : 'L'}${s.streak.count}` : '-';
}
