import type { GameAttendance, GameLog, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';

export interface BoxScoreData {
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  overtime: boolean;
  homeStats: LacrosseTeamStats;
  awayStats: LacrosseTeamStats;
  log?: GameLog;
  /** The home crowd; absent for neutral sites, the postseason and older saves. */
  attendance?: GameAttendance;
}
