import type { GameResult } from '@sports-management-sim/engine-core';
import type { LacrosseTeam, LacrosseTeamStats } from './models';
import { calculateLacrosseTeamRating, type LacrosseTeamRating } from './team-rating';

export type RandomSource = () => number;

export interface SimulateLacrosseGameInput {
  homeTeam: LacrosseTeam;
  awayTeam: LacrosseTeam;
  random?: RandomSource;
}

export type LacrosseGameResult = GameResult<LacrosseTeamStats>;

export function simulateLacrosseGame({
  homeTeam,
  awayTeam,
  random = Math.random,
}: SimulateLacrosseGameInput): LacrosseGameResult {
  const homeRating = calculateLacrosseTeamRating(homeTeam);
  const awayRating = calculateLacrosseTeamRating(awayTeam);
  const homePossessionEdge = (homeRating.faceoff - awayRating.faceoff) / 12;

  const homePossessions = Math.round(44 + Math.floor(random() * 12) + homePossessionEdge);
  const awayPossessions = Math.round(44 + Math.floor(random() * 12) - homePossessionEdge);

  let homeScore = simulateGoals(homePossessions, homeRating, awayRating, random);
  let awayScore = simulateGoals(awayPossessions, awayRating, homeRating, random);
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

  return {
    homeScore,
    awayScore,
    winnerTeamId: homeWon ? homeTeam.id : awayTeam.id,
    loserTeamId: homeWon ? awayTeam.id : homeTeam.id,
    overtime,
    teamStats: {
      home: createTeamStats(homeScore, homePossessions, homeRating, awayRating, random),
      away: createTeamStats(awayScore, awayPossessions, awayRating, homeRating, random),
    },
  };
}

function simulateGoals(
  possessions: number,
  offenseRating: LacrosseTeamRating,
  defenseRating: LacrosseTeamRating,
  random: RandomSource,
): number {
  const ratingEdge = offenseRating.offense - defenseRating.defense;
  const goalieEdge = offenseRating.offense - defenseRating.goalie;
  const scoringChance = clamp(0.23 + ratingEdge / 320 + goalieEdge / 900, 0.1, 0.48);
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
  const shotsOnGoal = Math.min(shots, goals + Math.floor((shots - goals) * (0.42 + teamRating.offense / 500 + random() * 0.16)));
  const faceoffAttempts = possessions;
  const faceoffWinRate = clamp(0.5 + (teamRating.faceoff - opponentRating.faceoff) / 180, 0.28, 0.72);
  const faceoffWins = Math.floor(faceoffAttempts * faceoffWinRate);

  return {
    goals,
    shots,
    shotsOnGoal,
    assists: Math.floor(goals * (0.45 + random() * 0.35)),
    turnovers: Math.floor(possessions * (0.18 + random() * 0.14)),
    causedTurnovers: Math.floor(possessions * (0.1 + random() * 0.1)),
    groundBalls: Math.floor(possessions * (0.45 + random() * 0.3)),
    faceoffWins,
    faceoffAttempts,
    saves: Math.floor((shots - goals) * (0.35 + random() * 0.3)),
    clears: Math.floor(possessions * (0.72 + random() * 0.18)),
    clearAttempts: possessions,
    penalties: Math.floor(random() * 5),
    penaltyMinutes: Math.floor(random() * 5),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
