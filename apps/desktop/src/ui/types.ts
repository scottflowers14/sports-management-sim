import type { LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';

export interface BoxScoreData {
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  overtime: boolean;
  homeStats: LacrosseTeamStats;
  awayStats: LacrosseTeamStats;
}
