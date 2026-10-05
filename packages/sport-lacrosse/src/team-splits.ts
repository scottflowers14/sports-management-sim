import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { rivalryForGame, type Rivalry } from './rivalries';

export type TeamSplitKey =
  | 'overall'
  | 'home'
  | 'away'
  | 'conference'
  | 'nonConference'
  | 'vsWinning'
  | 'rivalry'
  | 'oneGoal'
  | 'blowouts'
  | 'overtime'
  | 'lastFive';

export const TEAM_SPLIT_LABELS: Record<TeamSplitKey, string> = {
  overall: 'Overall',
  home: 'Home',
  away: 'Away',
  conference: 'Conference',
  nonConference: 'Non-conference',
  vsWinning: 'vs winning teams',
  rivalry: 'Rivalry games',
  oneGoal: 'One-goal games',
  blowouts: 'Decided by 5+',
  overtime: 'Overtime',
  lastFive: 'Last 5',
};

export interface TeamSplit {
  key: TeamSplitKey;
  label: string;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** "Winning team" means a final record above .500 in games played so far. */
function recordsByTeam(games: readonly ScheduledGame[]): Map<string, { wins: number; losses: number }> {
  const records = new Map<string, { wins: number; losses: number }>();
  const bump = (id: string, won: boolean) => {
    const r = records.get(id) ?? { wins: 0, losses: 0 };
    if (won) r.wins += 1;
    else r.losses += 1;
    records.set(id, r);
  };
  for (const g of games) {
    if (!g.result) continue;
    bump(g.result.winnerTeamId, true);
    bump(g.result.loserTeamId, false);
  }
  return records;
}

/**
 * Regular-season splits for one team, OOTP style. Every split that has no
 * games is still returned (0-0) so the table keeps a stable shape; the
 * caller decides whether to show empty rows.
 */
export function teamSplits(
  schedule: readonly ScheduledGame[],
  teamId: string,
  rivalries: readonly Rivalry[] = [],
): TeamSplit[] {
  const finals = schedule.filter((g) => g.status === 'final' && g.result);
  const records = recordsByTeam(finals);
  const mine = finals
    .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
    .sort((a, b) => a.week - b.week);
  const lastFive = new Set(mine.slice(-5).map((g) => g.id));

  const splits = new Map<TeamSplitKey, TeamSplit>(
    (Object.keys(TEAM_SPLIT_LABELS) as TeamSplitKey[]).map((key) => [
      key,
      { key, label: TEAM_SPLIT_LABELS[key], wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
    ]),
  );

  for (const g of mine) {
    const result = g.result!;
    const home = g.homeTeamId === teamId;
    const opponentId = home ? g.awayTeamId : g.homeTeamId;
    const goalsFor = home ? result.homeScore : result.awayScore;
    const goalsAgainst = home ? result.awayScore : result.homeScore;
    const won = result.winnerTeamId === teamId;
    const margin = Math.abs(goalsFor - goalsAgainst);
    const opp = records.get(opponentId) ?? { wins: 0, losses: 0 };
    // Judge the opponent on its record outside this game so a single win over
    // a 0-0 team doesn't turn it into a "losing" team.
    const oppWins = opp.wins - (won ? 0 : 1);
    const oppLosses = opp.losses - (won ? 1 : 0);

    const keys: TeamSplitKey[] = ['overall', home ? 'home' : 'away', g.conferenceGame ? 'conference' : 'nonConference'];
    if (oppWins > oppLosses) keys.push('vsWinning');
    if (rivalryForGame(rivalries, g)) keys.push('rivalry');
    if (margin === 1) keys.push('oneGoal');
    if (margin >= 5) keys.push('blowouts');
    if (result.overtime) keys.push('overtime');
    if (lastFive.has(g.id)) keys.push('lastFive');

    for (const key of keys) {
      const split = splits.get(key)!;
      if (won) split.wins += 1;
      else split.losses += 1;
      split.goalsFor += goalsFor;
      split.goalsAgainst += goalsAgainst;
    }
  }

  return [...splits.values()];
}

export function splitGames(split: TeamSplit): number {
  return split.wins + split.losses;
}

export function splitWinPct(split: TeamSplit): number {
  const games = splitGames(split);
  return games === 0 ? 0 : split.wins / games;
}
