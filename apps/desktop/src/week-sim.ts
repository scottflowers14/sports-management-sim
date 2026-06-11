import { advanceSeasonWeek, sortRecruitBoardForTeam } from '@sports-management-sim/engine-core';
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
import { updateSeasonStats } from './stats';
import type { SeasonStatsMap } from './stats';

const MAX_NEWS_ITEMS = 60;

export interface WeekSimState {
  dynasty: LacrosseDynastyState;
  rankings: RankingEntry[];
  injuries: InjuredPlayer[];
  newsItems: NewsItem[];
  scouting: ScoutingState;
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

  const newRecruits = autoCommitWeekly(dynasty.recruits, newSeason.teams, dynasty.userTeamId, weekToSim, random);
  const updatedUserTeam = newSeason.teams.find((t) => t.id === dynasty.userTeamId)!;
  const newBoard = sortRecruitBoardForTeam(updatedUserTeam, newRecruits, dynasty.rosterTargets);
  const newDynasty = { ...dynasty, season: newSeason, recruits: newRecruits, recruitBoard: newBoard };

  const newRankings = computeNationalRankings(newSeason.teams, state.rankings);
  const { injuries: newInjuries, newlyInjured, recovered } = processInjuries(state.injuries, newSeason.teams, random);

  const newlyCommitted = newRecruits.filter((r) => r.status !== 'open' && !prevCommittedIds.has(r.id));

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
    newsItems: [...playerOfWeekNews, ...weekNews, ...recruitNews, ...injuryNews, ...state.newsItems].slice(0, MAX_NEWS_ITEMS),
    scouting: advanceScoutingWeek(state.scouting),
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
