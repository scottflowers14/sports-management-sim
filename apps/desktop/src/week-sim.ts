import {
  advanceSeasonWeek,
  applyCampusVisit,
  FINALIST_ANNOUNCE_LEAD,
  finalistTeamIds,
  recruitDecisionWeek,
  recruitPrestigeMultiplier,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import {
  DEFAULT_GAME_PLAN,
  deriveCpuGamePlan,
  simulateLacrosseGameWithLog,
  type GameLog,
  type LacrosseDynastyState,
  type LacrosseGamePlan,
  type LacrosseTeam,
} from '@sports-management-sim/sport-lacrosse';
import { autoCommitWeekly, processInjuries } from './dynasty-helpers';
import type { InjuredPlayer } from './dynasty-helpers';
import { computeNationalRankings } from './rankings';
import type { RankingEntry } from './rankings';
import { generateWeeklyNews, generateRecruitingNews } from './news-feed';
import type { NewsItem } from './news-feed';
import { advanceScoutingWeek } from './scouting';
import type { ScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import type { RecruitingActivity } from './recruiting-activity';
import { updateSeasonStats } from './stats';
import type { SeasonStatsMap } from './stats';

const MAX_NEWS_ITEMS = 60;

export interface WeekSimState {
  dynasty: LacrosseDynastyState;
  rankings: RankingEntry[];
  injuries: InjuredPlayer[];
  newsItems: NewsItem[];
  scouting: ScoutingState;
  recruitingActivity: RecruitingActivity;
  /** Change in the user's interest with each recruit over the last simulated week. */
  recruitTrends: Record<string, number>;
  seasonStats: SeasonStatsMap;
  gameLogs: Map<string, GameLog>;
  bestNatRank: number | null;
  lastSimWeek: number | null;
}

export function simulateOneWeek(
  state: WeekSimState,
  userGamePlan: LacrosseGamePlan = DEFAULT_GAME_PLAN,
  random: () => number = Math.random,
): WeekSimState {
  const { dynasty } = state;
  const weekToSim = dynasty.season.currentWeek;
  const prevCommittedIds = new Set(dynasty.recruits.filter((r) => r.status !== 'open').map((r) => r.id));
  const prevCommitmentTeamById = new Map(
    dynasty.recruits
      .filter((r) => r.status === 'committed' && r.committedTeamId !== undefined)
      .map((r) => [r.id, r.committedTeamId as string]),
  );
  const prevUserInterestById = new Map(
    dynasty.recruits.map((r) => [r.id, r.interestByTeamId[dynasty.userTeamId] ?? 0]),
  );
  const finalWeek = dynasty.season.schedule.reduce((max, game) => Math.max(max, game.week), 10);
  const teamMap = new Map(dynasty.season.teams.map((t) => [t.id, t.name]));

  const weekLogs = new Map<string, GameLog>();
  const planFor = (team: LacrosseTeam): LacrosseGamePlan =>
    team.id === dynasty.userTeamId ? userGamePlan : deriveCpuGamePlan(team);
  const newSeason = advanceSeasonWeek(dynasty.season, (game, homeTeam, awayTeam) => {
    const result = simulateLacrosseGameWithLog({
      homeTeam,
      awayTeam,
      random,
      homeGamePlan: planFor(homeTeam),
      awayGamePlan: planFor(awayTeam),
    });
    weekLogs.set(game.id, result.log);
    return result;
  });

  const updatedUserTeam = newSeason.teams.find((t) => t.id === dynasty.userTeamId)!;

  // Resolve campus visits against the game the recruit actually watched.
  const visitNews: NewsItem[] = [];
  let recruitsAfterVisits = dynasty.recruits;
  if (state.recruitingActivity.visitIds.length > 0) {
    const userGame = newSeason.schedule.find(
      (g) =>
        g.week === weekToSim &&
        g.status === 'final' &&
        g.result !== undefined &&
        (g.homeTeamId === dynasty.userTeamId || g.awayTeamId === dynasty.userTeamId),
    );
    const hostedHome = userGame !== undefined && userGame.homeTeamId === dynasty.userTeamId;
    const won = hostedHome && userGame.result?.winnerTeamId === dynasty.userTeamId;
    const opponentId = hostedHome ? userGame.awayTeamId : null;
    const opponentRankRaw = opponentId !== null
      ? state.rankings.find((r) => r.teamId === opponentId)?.rank ?? null
      : null;
    const opponentRank = opponentRankRaw !== null && opponentRankRaw <= 20 ? opponentRankRaw : null;
    const visitIdSet = new Set(state.recruitingActivity.visitIds);

    recruitsAfterVisits = dynasty.recruits.map((recruit) => {
      if (!visitIdSet.has(recruit.id) || recruit.status !== 'open') return recruit;
      const outcome = applyCampusVisit(recruit, dynasty.userTeamId, {
        won,
        opponentRank,
        facilities: updatedUserTeam.reputation.facilities,
        interestMultiplier: recruitPrestigeMultiplier(
          recruit.starRating,
          updatedUserTeam.reputation.nationalPrestige,
        ),
      });
      const impressionText =
        outcome.impression === 'electric'
          ? 'left campus buzzing'
          : outcome.impression === 'positive'
            ? 'enjoyed the visit'
            : 'left underwhelmed';
      const gameText = hostedHome && opponentId !== null
        ? ` after the ${won ? 'win over' : 'loss to'} ${opponentRank !== null ? `#${opponentRank} ` : ''}${teamMap.get(opponentId) ?? opponentId}`
        : '';
      visitNews.push({
        id: `visit-${weekToSim}-${visitNews.length}`,
        week: weekToSim,
        category: 'recruiting',
        headline: `Campus visit: ${recruit.position} ${recruit.name.first} ${recruit.name.last} ${impressionText}${gameText} (+${outcome.interestChange} interest)`,
      });
      return outcome.recruit;
    });
  }

  const newRecruits = autoCommitWeekly(
    recruitsAfterVisits,
    newSeason.teams,
    dynasty.userTeamId,
    weekToSim,
    random,
    finalWeek,
  );
  const newBoard = sortRecruitBoardForTeam(updatedUserTeam, newRecruits, dynasty.rosterTargets);
  const newDynasty = { ...dynasty, season: newSeason, recruits: newRecruits, recruitBoard: newBoard };

  const newRankings = computeNationalRankings(newSeason.teams, state.rankings);
  const { injuries: newInjuries, newlyInjured, recovered } = processInjuries(state.injuries, newSeason.teams, random);

  const newlyCommitted = newRecruits.filter((r) => r.status !== 'open' && !prevCommittedIds.has(r.id));

  // Recruiting drama: decommitments and recruits publicly naming finalists.
  const dramaNews: NewsItem[] = [];
  for (const recruit of newRecruits) {
    if (recruit.status === 'open' && prevCommittedIds.has(recruit.id)) {
      const formerTeamId = prevCommitmentTeamById.get(recruit.id);
      const formerName = formerTeamId !== undefined ? teamMap.get(formerTeamId) ?? formerTeamId : 'their school';
      dramaNews.push({
        id: `decommit-${weekToSim}-${dramaNews.length}`,
        week: weekToSim,
        category: 'recruiting',
        headline: `${'★'.repeat(recruit.starRating)} ${recruit.position} ${recruit.name.first} ${recruit.name.last} decommits from ${formerName}`,
      });
    }
  }
  for (const recruit of newRecruits) {
    if (recruit.status !== 'open') continue;
    if (!recruit.scholarshipOffers.some((o) => o.teamId === dynasty.userTeamId)) continue;
    if (recruit.scholarshipOffers.length < 2) continue;
    const decisionWeek = recruitDecisionWeek(recruit.id, recruit.starRating, finalWeek);
    if (weekToSim !== decisionWeek - FINALIST_ANNOUNCE_LEAD) continue;
    const finalists = finalistTeamIds(recruit).map((teamId) => teamMap.get(teamId) ?? teamId);
    dramaNews.push({
      id: `finalists-${weekToSim}-${dramaNews.length}`,
      week: weekToSim,
      category: 'recruiting',
      headline: `${recruit.position} ${recruit.name.first} ${recruit.name.last} narrows his list to ${finalists.join(', ')} — decision expected Week ${decisionWeek}`,
    });
  }

  const recruitTrends: Record<string, number> = {};
  for (const recruit of newRecruits) {
    const before = prevUserInterestById.get(recruit.id) ?? 0;
    const after = recruit.interestByTeamId[dynasty.userTeamId] ?? 0;
    if (before !== 0 || after !== 0) {
      recruitTrends[recruit.id] = after - before;
    }
  }

  const weekNews = generateWeeklyNews({
    week: weekToSim,
    season: newSeason,
    previousRankings: state.rankings,
    newRankings,
    userTeamId: dynasty.userTeamId,
    teamMap,
  });
  const recruitNews = generateRecruitingNews({
    week: weekToSim,
    recruits: newlyCommitted,
    userTeamId: dynasty.userTeamId,
    teamMap,
  });
  const injuryNews: NewsItem[] = [
    ...newlyInjured
      .filter((inj) => inj.teamId === dynasty.userTeamId)
      .map((inj, i) => ({
        id: `injury-${weekToSim}-${i}`,
        week: weekToSim,
        category: 'injury' as const,
        headline: `${inj.playerName} is out ${inj.weeksRemaining} week${inj.weeksRemaining > 1 ? 's' : ''} with an injury`,
      })),
    ...recovered
      .filter((r) => r.teamId === dynasty.userTeamId)
      .map((r, i) => ({
        id: `recovery-${weekToSim}-${i}`,
        week: weekToSim,
        category: 'injury' as const,
        headline: `${r.playerName} has returned from injury`,
      })),
  ];

  const newSeasonStats = updateSeasonStats(state.seasonStats, newSeason.schedule, newSeason.teams, weekToSim);
  const playerOfWeekNews = buildPlayerOfWeekNews(weekToSim, state.seasonStats, newSeasonStats, newSeason.teams);

  const mergedLogs = new Map(state.gameLogs);
  for (const [id, log] of weekLogs) mergedLogs.set(id, log);

  const userRank = newRankings.find((r) => r.teamId === dynasty.userTeamId)?.rank ?? null;
  const bestNatRank =
    userRank !== null && (state.bestNatRank === null || userRank < state.bestNatRank)
      ? userRank
      : state.bestNatRank;

  return {
    dynasty: newDynasty,
    rankings: newRankings,
    injuries: newInjuries,
    newsItems: [...playerOfWeekNews, ...weekNews, ...visitNews, ...recruitNews, ...dramaNews, ...injuryNews, ...state.newsItems].slice(0, MAX_NEWS_ITEMS),
    scouting: advanceScoutingWeek(state.scouting),
    recruitingActivity: emptyRecruitingActivity(),
    recruitTrends,
    seasonStats: newSeasonStats,
    gameLogs: mergedLogs,
    bestNatRank,
    lastSimWeek: weekToSim,
  };
}

function buildPlayerOfWeekNews(
  week: number,
  previousStats: SeasonStatsMap,
  newStats: SeasonStatsMap,
  teams: LacrosseTeam[],
): NewsItem[] {
  let best: { playerId: string; score: number; goals: number; assists: number } | null = null;

  for (const stats of Object.values(newStats)) {
    const prev = previousStats[stats.playerId];
    const goals = stats.goals - (prev?.goals ?? 0);
    const assists = stats.assists - (prev?.assists ?? 0);
    if (goals + assists <= 0) continue;
    const score = goals * 2 + assists;
    if (!best || score > best.score) {
      best = { playerId: stats.playerId, score, goals, assists };
    }
  }

  if (!best) return [];
  const top = best;

  for (const team of teams) {
    const player = team.roster.find((p) => p.id === top.playerId);
    if (player) {
      return [
        {
          id: `potw-${week}`,
          week,
          category: 'award' as const,
          headline: `Player of the Week: ${player.name.first} ${player.name.last} (${team.name}) — ${top.goals}G, ${top.assists}A`,
        },
      ];
    }
  }

  return [];
}

export function simulateRemainingWeeks(
  state: WeekSimState,
  userGamePlan: LacrosseGamePlan = DEFAULT_GAME_PLAN,
  random: () => number = Math.random,
): WeekSimState {
  let current = state;
  // Safety bound: a season is far shorter than 64 weeks
  for (let i = 0; i < 64; i += 1) {
    if (!current.dynasty.season.schedule.some((g) => g.status === 'scheduled')) break;
    current = simulateOneWeek(current, userGamePlan, random);
  }
  return current;
}
