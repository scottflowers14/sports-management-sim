import type { LacrosseSeason } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseRecruit } from '@sports-management-sim/sport-lacrosse';

export type NewsCategory = 'game' | 'recruiting' | 'rankings' | 'award' | 'injury' | 'coaching';

export interface NewsItem {
  id: string;
  week: number;
  category: NewsCategory;
  headline: string;
}

export interface RankingEntry {
  teamId: string;
  rank: number;
  score: number;
}

export interface GenerateWeeklyNewsParams {
  week: number;
  season: LacrosseSeason;
  previousRankings: RankingEntry[];
  newRankings: RankingEntry[];
  userTeamId: string;
  teamMap: Map<string, string>;
}

export interface GenerateRecruitingNewsParams {
  week: number;
  recruits: LacrosseRecruit[];
  userTeamId: string;
  teamMap: Map<string, string>;
}

export function generateWeeklyNews(params: GenerateWeeklyNewsParams): NewsItem[] {
  const { week, season, previousRankings, newRankings, userTeamId, teamMap } = params;
  const items: NewsItem[] = [];

  // Game results
  for (const game of season.schedule) {
    if (game.week !== week || game.status !== 'final' || game.result === undefined) {
      continue;
    }

    const { result } = game;
    const userInGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;

    let headline: string;

    if (userInGame) {
      const userIsHome = game.homeTeamId === userTeamId;
      const userScore = userIsHome ? result.homeScore : result.awayScore;
      const opponentScore = userIsHome ? result.awayScore : result.homeScore;
      const opponentId = userIsHome ? game.awayTeamId : game.homeTeamId;
      const userTeamName = teamMap.get(userTeamId) ?? userTeamId;
      const opponentName = teamMap.get(opponentId) ?? opponentId;
      const userWon = result.winnerTeamId === userTeamId;

      if (userWon) {
        headline = `${userTeamName} wins ${userScore}-${opponentScore} over ${opponentName}`;
      } else {
        headline = `${userTeamName} falls ${userScore}-${opponentScore} to ${opponentName}`;
      }

      if (result.overtime) {
        headline += ' (OT)';
      }
    } else {
      const winnerName = teamMap.get(result.winnerTeamId) ?? result.winnerTeamId;
      const loserName = teamMap.get(result.loserTeamId) ?? result.loserTeamId;
      const winnerIsHome = game.homeTeamId === result.winnerTeamId;
      const winnerScore = winnerIsHome ? result.homeScore : result.awayScore;
      const loserScore = winnerIsHome ? result.awayScore : result.homeScore;

      headline = `${winnerName} defeats ${loserName} ${winnerScore}-${loserScore}`;

      if (result.overtime) {
        headline += ' (OT)';
      }
    }

    items.push({
      id: `week-${week}-${items.length}`,
      week,
      category: 'game',
      headline,
    });
  }

  // Ranking changes for user team
  const prevEntry = previousRankings.find((r) => r.teamId === userTeamId);
  const newEntry = newRankings.find((r) => r.teamId === userTeamId);

  if (prevEntry !== undefined && newEntry !== undefined) {
    const userTeamName = teamMap.get(userTeamId) ?? userTeamId;
    const rankChange = prevEntry.rank - newEntry.rank; // positive = improved

    if (rankChange >= 2) {
      items.push({
        id: `week-${week}-${items.length}`,
        week,
        category: 'rankings',
        headline: `${userTeamName} rises to #${newEntry.rank} in the national poll`,
      });
    } else if (rankChange <= -2) {
      items.push({
        id: `week-${week}-${items.length}`,
        week,
        category: 'rankings',
        headline: `${userTeamName} falls to #${newEntry.rank} in the national poll`,
      });
    }
  }

  return items;
}

export function generateRecruitingNews(params: GenerateRecruitingNewsParams): NewsItem[] {
  const { week, recruits, teamMap } = params;
  const items: NewsItem[] = [];

  for (const recruit of recruits) {
    if (recruit.committedTeamId === undefined) {
      continue;
    }

    const teamName = teamMap.get(recruit.committedTeamId) ?? recruit.committedTeamId;
    const stars = '★'.repeat(recruit.starRating);
    const recruitName = `${recruit.name.first} ${recruit.name.last}`;
    const headline = `${stars} ${recruit.position} ${recruitName} commits to ${teamName}`;

    items.push({
      // Distinct prefix: game/ranking news already uses `week-${week}-${i}` ids.
      id: `commit-${week}-${items.length}`,
      week,
      category: 'recruiting',
      headline,
    });
  }

  return items;
}
