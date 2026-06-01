import type { Player, Rating, Season, Team } from '@sports-management-sim/engine-core';

export type LacrossePosition = 'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO' | 'LSM';

export interface LacrossePlayerTraits {
  shooting: Rating;
  passing: Rating;
  dodging: Rating;
  stickSkills: Rating;
  offBallMovement: Rating;
  defense: Rating;
  checking: Rating;
  groundBalls: Rating;
  faceoffs?: Rating;
  goalieReflexes?: Rating;
  goaliePositioning?: Rating;
  goalieClearing?: Rating;
  preferredHand: 'left' | 'right';
}

export type LacrossePlayer = Player<LacrossePosition, LacrossePlayerTraits>;

export type LacrosseTeam = Team<LacrossePosition, LacrossePlayerTraits>;

export type LacrosseSeason = Season<LacrossePosition, LacrossePlayerTraits>;

export interface LacrosseTeamStats {
  goals: number;
  shots: number;
  shotsOnGoal: number;
  assists: number;
  turnovers: number;
  causedTurnovers: number;
  groundBalls: number;
  faceoffWins: number;
  faceoffAttempts: number;
  saves: number;
  clears: number;
  clearAttempts: number;
  penalties: number;
  penaltyMinutes: number;
}

export interface LacrossePlayerGameStats {
  playerId: string;
  teamId: string;
  goals: number;
  assists: number;
  shots: number;
  shotsOnGoal: number;
  groundBalls: number;
  turnovers: number;
  causedTurnovers: number;
  faceoffWins?: number;
  faceoffAttempts?: number;
  saves?: number;
  goalsAllowed?: number;
  penalties: number;
  penaltyMinutes: number;
}
