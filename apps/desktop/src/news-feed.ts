import type { PortalMove } from '@sports-management-sim/engine-core';
import type { LacrosseSeason } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseRecruit } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from './ui/format';

export type NewsCategory = 'game' | 'recruiting' | 'rankings' | 'award' | 'injury' | 'coaching';

export interface NewsItem {
  id: string;
  week: number;
  category: NewsCategory;
  headline: string;
  /** About the user's program: their games, poll moves, commitments. */
  featured?: boolean;
  /** A roll-up line ("Around the league: ...") rather than a story. */
  summary?: boolean;
}

/** Two teams ranked this high meeting is a headline. */
const HEADLINE_RANK = 10;
/** A top-10 team losing to a team this many spots worse (or unranked) is an upset. */
const UPSET_RANK_GAP = 10;
/** Commitments at this star rating or better get their own headline. */
const HEADLINE_STARS = 4;

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

  // Game results: the user's game, top-10 matchups, and top-10 upsets. The
  // rest of the slate is folded into one "around the league" line.
  const prevRank = new Map(previousRankings.map((r) => [r.teamId, r.rank]));
  const label = (teamId: string) => {
    const name = teamMap.get(teamId) ?? teamId;
    const rank = prevRank.get(teamId);
    return rank !== undefined && rank <= 20 ? `#${rank} ${name}` : name;
  };
  let otherResults = 0;
  for (const game of season.schedule) {
    if (game.week !== week || game.status !== 'final' || game.result === undefined) {
      continue;
    }

    const { result } = game;
    const userInGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;
    const winnerIsHome = game.homeTeamId === result.winnerTeamId;
    const winnerScore = winnerIsHome ? result.homeScore : result.awayScore;
    const loserScore = winnerIsHome ? result.awayScore : result.homeScore;
    const ot = result.overtime ? ' (OT)' : '';

    if (userInGame) {
      const userIsHome = game.homeTeamId === userTeamId;
      const userScore = userIsHome ? result.homeScore : result.awayScore;
      const opponentScore = userIsHome ? result.awayScore : result.homeScore;
      const opponentId = userIsHome ? game.awayTeamId : game.homeTeamId;
      const userTeamName = teamMap.get(userTeamId) ?? userTeamId;
      const verb = result.winnerTeamId === userTeamId ? `wins ${userScore}-${opponentScore} over` : `falls ${userScore}-${opponentScore} to`;
      items.push({
        id: `week-${week}-${items.length}`,
        week,
        category: 'game',
        headline: `${userTeamName} ${verb} ${label(opponentId)}${ot}`,
        featured: true,
      });
      continue;
    }

    const winnerRank = prevRank.get(result.winnerTeamId) ?? Infinity;
    const loserRank = prevRank.get(result.loserTeamId) ?? Infinity;
    const isUpset = loserRank <= HEADLINE_RANK && winnerRank - loserRank >= UPSET_RANK_GAP;
    if (isUpset) {
      items.push({
        id: `week-${week}-${items.length}`,
        week,
        category: 'game',
        headline: `Upset: ${label(result.winnerTeamId)} stuns ${label(result.loserTeamId)} ${winnerScore}-${loserScore}${ot}`,
      });
    } else if (winnerRank <= HEADLINE_RANK && loserRank <= HEADLINE_RANK) {
      items.push({
        id: `week-${week}-${items.length}`,
        week,
        category: 'game',
        headline: `${label(result.winnerTeamId)} defeats ${label(result.loserTeamId)} ${winnerScore}-${loserScore}${ot}`,
      });
    } else {
      otherResults += 1;
    }
  }
  if (otherResults > 0) {
    items.push({
      id: `week-${week}-${items.length}`,
      week,
      category: 'game',
      headline: `Around the league: ${otherResults} more result${otherResults === 1 ? '' : 's'} on the Schedule screen`,
      summary: true,
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
        featured: true,
      });
    } else if (rankChange <= -2) {
      items.push({
        id: `week-${week}-${items.length}`,
        week,
        category: 'rankings',
        headline: `${userTeamName} falls to #${newEntry.rank} in the national poll`,
        featured: true,
      });
    }
  }

  return items;
}

export function generateRecruitingNews(params: GenerateRecruitingNewsParams): NewsItem[] {
  const { week, recruits, userTeamId, teamMap } = params;
  const items: NewsItem[] = [];
  let quietCommits = 0;

  // Our commitments and blue-chip recruits get headlines; the rest are one line.
  const ordered = [...recruits].sort((a, b) => b.starRating - a.starRating);
  for (const recruit of ordered) {
    if (recruit.committedTeamId === undefined) {
      continue;
    }
    const ours = recruit.committedTeamId === userTeamId;
    if (!ours && recruit.starRating < HEADLINE_STARS) {
      quietCommits += 1;
      continue;
    }

    const teamName = teamMap.get(recruit.committedTeamId) ?? recruit.committedTeamId;
    const stars = '★'.repeat(recruit.starRating);
    const recruitName = `${recruit.name.first} ${recruit.name.last}`;
    items.push({
      // Distinct prefix: game/ranking news already uses `week-${week}-${i}` ids.
      id: `commit-${week}-${items.length}`,
      week,
      category: 'recruiting',
      headline: `${ours ? 'Commitment! ' : ''}${stars} ${recruit.position} ${recruitName} commits to ${teamName}`,
      ...(ours ? { featured: true } : {}),
    });
  }

  if (quietCommits > 0) {
    items.push({
      id: `commit-${week}-${items.length}`,
      week,
      category: 'recruiting',
      headline: `${quietCommits} more recruit${quietCommits === 1 ? '' : 's'} rated 3★ or lower committed elsewhere`,
      summary: true,
    });
  }

  return items;
}

/** Transfers this high get their own headline even when they don't involve us. */
const HEADLINE_TRANSFER_OVERALL = 70;

/**
 * Season-start portal stories: every move involving our program, the biggest
 * transfers around the league, and one line for the rest.
 */
export function portalMoveNews(moves: PortalMove[], userTeamId: string, teamMap: Map<string, string>): NewsItem[] {
  const items: NewsItem[] = [];
  const name = (teamId: string) => formatTeamName(teamMap.get(teamId) ?? teamId);
  let quiet = 0;
  let departed = 0;
  const ordered = [...moves].sort((a, b) => b.overall - a.overall);
  for (const move of ordered) {
    const playerName = `${move.name.first} ${move.name.last}`;
    const who = `${move.classYear} ${move.position} ${playerName} (${move.overall} OVR)`;
    const ours = move.fromTeamId === userTeamId || move.toTeamId === userTeamId;
    if (move.outcome === 'transferred' && move.toTeamId !== undefined) {
      if (!ours && move.overall < HEADLINE_TRANSFER_OVERALL) {
        quiet += 1;
        continue;
      }
      const headline =
        move.toTeamId === userTeamId
          ? `Transfer in: ${who} joins us from ${name(move.fromTeamId)}`
          : move.fromTeamId === userTeamId
            ? `Transfer out: ${who} leaves for ${name(move.toTeamId)}`
            : `${who} transfers from ${name(move.fromTeamId)} to ${name(move.toTeamId)}`;
      items.push({ id: `portal-${move.entryId}`, week: 1, category: 'recruiting', headline, ...(ours ? { featured: true } : {}) });
    } else if (move.outcome === 'returned') {
      if (!ours) {
        quiet += 1;
        continue;
      }
      items.push({
        id: `portal-${move.entryId}`,
        week: 1,
        category: 'recruiting',
        headline: `${who} withdrew from the portal and returns to our roster`,
        featured: true,
      });
    } else if (ours) {
      items.push({
        id: `portal-${move.entryId}`,
        week: 1,
        category: 'recruiting',
        headline: `${who} left the portal for a smaller program`,
        featured: true,
      });
    } else {
      departed += 1;
    }
  }
  if (quiet > 0 || departed > 0) {
    const parts = [
      ...(quiet > 0 ? [`${quiet} more portal player${quiet === 1 ? '' : 's'} found a new home or went back`] : []),
      ...(departed > 0 ? [`${departed} left for smaller programs`] : []),
    ];
    items.push({ id: 'portal-summary', week: 1, category: 'recruiting', headline: `Around the portal: ${parts.join('; ')}`, summary: true });
  }
  return items;
}
