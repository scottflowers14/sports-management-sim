import type { GameResult } from '@sports-management-sim/engine-core';
import type { LacrosseTeam, LacrosseTeamStats } from './models';

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
  const homeStrength = averageOverall(homeTeam);
  const awayStrength = averageOverall(awayTeam);

  const homePossessions = 40 + Math.floor(random() * 16);
  const awayPossessions = 40 + Math.floor(random() * 16);

  let homeScore = simulateGoals(homePossessions, homeStrength, awayStrength, random);
  let awayScore = simulateGoals(awayPossessions, awayStrength, homeStrength, random);
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
      home: createTeamStats(homeScore, homePossessions, random),
      away: createTeamStats(awayScore, awayPossessions, random),
    },
  };
}

function averageOverall(team: LacrosseTeam): number {
  if (team.roster.length === 0) {
    return 0;
  }

  return team.roster.reduce((sum, player) => sum + player.ratings.overall, 0) / team.roster.length;
}

function simulateGoals(possessions: number, offenseStrength: number, defenseStrength: number, random: RandomSource): number {
  const scoringChance = clamp(0.18 + offenseStrength / 500 - defenseStrength / 700, 0.12, 0.42);
  let goals = 0;

  for (let possession = 0; possession < possessions; possession += 1) {
    if (random() < scoringChance) {
      goals += 1;
    }
  }

  return goals;
}

function createTeamStats(goals: number, possessions: number, random: RandomSource): LacrosseTeamStats {
  const shots = goals + Math.floor(possessions * (0.35 + random() * 0.25));
  const shotsOnGoal = Math.min(shots, goals + Math.floor((shots - goals) * (0.45 + random() * 0.25)));
  const faceoffAttempts = possessions;
  const faceoffWins = Math.floor(faceoffAttempts * (0.35 + random() * 0.3));

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
