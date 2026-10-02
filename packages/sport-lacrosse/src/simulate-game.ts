import type { GameResult } from '@sports-management-sim/engine-core';
import { DEFAULT_GAME_PLAN, getGamePlanModifiers, type LacrosseGamePlan } from './game-plan';
import type { LacrossePlayerGameStats, LacrosseTeam, LacrosseTeamStats } from './models';
import { generateLacrossePlayerStats, type LacrosseScoringPlay } from './player-stats';
import { calculateLacrosseTeamRating, type LacrosseTeamRating } from './team-rating';

export type RandomSource = () => number;

export interface SimulateLacrosseGameInput {
  homeTeam: LacrosseTeam;
  awayTeam: LacrosseTeam;
  random?: RandomSource;
  homeGamePlan?: LacrosseGamePlan;
  awayGamePlan?: LacrosseGamePlan;
  /** Championship-weekend games are played at a neutral site: no home edge. */
  neutralSite?: boolean;
}

/**
 * Home teams score a little more often (crowd, familiarity, last change).
 * Worth about half a goal a game, so home teams win about 57% of even matchups.
 */
export const HOME_SCORING_EDGE = 0.012;

export type LacrosseGameResult = GameResult<LacrosseTeamStats>;

/** Individual stat lines and goal-by-goal scoring for both sides of one game. */
export interface LacrosseGamePlayerDetail {
  home: LacrossePlayerGameStats[];
  away: LacrossePlayerGameStats[];
  homeScoring: LacrosseScoringPlay[];
  awayScoring: LacrosseScoringPlay[];
}

export function simulateLacrosseGame(input: SimulateLacrosseGameInput): LacrosseGameResult {
  return simulateLacrosseGameDetailed(input).result;
}

/**
 * Simulate a game and also attribute the box score to individual players via
 * the depth chart. The player detail is returned separately from the result so
 * callers can keep stored schedules lean.
 */
export function simulateLacrosseGameDetailed(input: SimulateLacrosseGameInput): {
  result: LacrosseGameResult;
  players: LacrosseGamePlayerDetail;
} {
  const random = input.random ?? Math.random;
  const result = simulateTeamResult({ ...input, random });
  const stats = result.teamStats!;
  const home = generateLacrossePlayerStats(input.homeTeam, stats.home, result.awayScore, random);
  const away = generateLacrossePlayerStats(input.awayTeam, stats.away, result.homeScore, random);
  return {
    result,
    players: { home: home.players, away: away.players, homeScoring: home.scoringPlays, awayScoring: away.scoringPlays },
  };
}

function simulateTeamResult({
  homeTeam,
  awayTeam,
  random = Math.random,
  homeGamePlan = DEFAULT_GAME_PLAN,
  awayGamePlan = DEFAULT_GAME_PLAN,
  neutralSite = false,
}: SimulateLacrosseGameInput): LacrosseGameResult {
  const homeEdge = neutralSite ? 0 : HOME_SCORING_EDGE;
  const homeRating = calculateLacrosseTeamRating(homeTeam);
  const awayRating = calculateLacrosseTeamRating(awayTeam);
  const homePossessionEdge = (homeRating.faceoff - awayRating.faceoff) / 12;
  const homeMods = getGamePlanModifiers(homeGamePlan);
  const awayMods = getGamePlanModifiers(awayGamePlan);

  const homePossessions = Math.max(
    30,
    Math.round(44 + Math.floor(random() * 12) + homePossessionEdge + homeMods.ownPossessions + awayMods.oppPossessions),
  );
  const awayPossessions = Math.max(
    30,
    Math.round(44 + Math.floor(random() * 12) - homePossessionEdge + awayMods.ownPossessions + homeMods.oppPossessions),
  );

  let homeScore = simulateGoals(homePossessions, homeRating, awayRating, random, homeMods.ownScoringChance + awayMods.oppScoringChance + homeEdge);
  let awayScore = simulateGoals(awayPossessions, awayRating, homeRating, random, awayMods.ownScoringChance + homeMods.oppScoringChance);
  let overtime = false;

  if (homeScore === awayScore) {
    overtime = true;
    if (random() >= 0.5) {
      homeScore += 1;
    } else {
      awayScore += 1;
    }
  }

  const homeWon = homeScore > awayScore;
  const homeStats = createTeamStats(homeScore, homePossessions, homeRating, awayRating, random);
  const awayStats = createTeamStats(awayScore, awayPossessions, awayRating, homeRating, random);

  // Each side's saves are the opponent's shots on goal that didn't go in.
  homeStats.saves = Math.max(0, awayStats.shotsOnGoal - awayScore);
  awayStats.saves = Math.max(0, homeStats.shotsOnGoal - homeScore);

  // Faceoffs open every quarter and follow every goal, and both sides take the same draws.
  const faceoffs = 4 + homeScore + awayScore - 1 + (overtime ? 1 : 0);
  const homeFaceoffRate = clamp(0.5 + (homeRating.faceoff - awayRating.faceoff) / 120, 0.22, 0.78);
  let homeFaceoffWins = 0;
  for (let i = 0; i < faceoffs; i += 1) {
    if (random() < homeFaceoffRate) homeFaceoffWins += 1;
  }
  homeStats.faceoffAttempts = faceoffs;
  awayStats.faceoffAttempts = faceoffs;
  homeStats.faceoffWins = homeFaceoffWins;
  awayStats.faceoffWins = faceoffs - homeFaceoffWins;

  return {
    homeScore,
    awayScore,
    winnerTeamId: homeWon ? homeTeam.id : awayTeam.id,
    loserTeamId: homeWon ? awayTeam.id : homeTeam.id,
    overtime,
    teamStats: { home: homeStats, away: awayStats },
  };
}

function simulateGoals(
  possessions: number,
  offenseRating: LacrosseTeamRating,
  defenseRating: LacrosseTeamRating,
  random: RandomSource,
  chanceModifier = 0,
): number {
  const ratingEdge = offenseRating.offense - defenseRating.defense;
  const goalieEdge = offenseRating.offense - defenseRating.goalie;
  const scoringChance = clamp(0.23 + ratingEdge / 320 + goalieEdge / 900 + chanceModifier, 0.1, 0.48);
  let goals = 0;

  for (let possession = 0; possession < possessions; possession += 1) {
    if (random() < scoringChance) {
      goals += 1;
    }
  }

  return goals;
}

function createTeamStats(
  goals: number,
  possessions: number,
  teamRating: LacrosseTeamRating,
  opponentRating: LacrosseTeamRating,
  random: RandomSource,
): LacrosseTeamStats {
  const shotRate = clamp(0.42 + teamRating.offense / 360 - opponentRating.defense / 520, 0.28, 0.72);
  const shots = goals + Math.floor(possessions * (shotRate + random() * 0.12));
  const penalties = Math.floor(random() * 6);
  const shotsOnGoal = Math.min(shots, goals + Math.floor((shots - goals) * (0.42 + teamRating.offense / 500 + random() * 0.16)));

  return {
    goals,
    shots,
    shotsOnGoal,
    assists: Math.floor(goals * (0.45 + random() * 0.35)),
    turnovers: Math.floor(possessions * (0.18 + random() * 0.14)),
    causedTurnovers: Math.floor(possessions * (0.1 + random() * 0.1)),
    groundBalls: Math.floor(possessions * (0.45 + random() * 0.3)),
    // Faceoffs and saves depend on both teams; simulateTeamResult fills them in.
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    clears: Math.floor(possessions * (0.72 + random() * 0.18)),
    clearAttempts: possessions,
    penalties,
    // Most fouls are 30-second technicals; personals run 1–3 minutes.
    penaltyMinutes: penaltyMinutesFor(penalties, random),
  };
}

function penaltyMinutesFor(penalties: number, random: RandomSource): number {
  let seconds = 0;
  for (let i = 0; i < penalties; i += 1) {
    const roll = random();
    seconds += roll < 0.6 ? 30 : roll < 0.9 ? 60 : roll < 0.97 ? 120 : 180;
  }
  return Math.round((seconds / 60) * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
