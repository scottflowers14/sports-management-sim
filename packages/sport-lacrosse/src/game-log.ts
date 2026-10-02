import type { LacrossePlayerGameStats } from './models';
import { simulatePossessionGame } from './possession-sim';
import type { LacrosseGamePlayerDetail, LacrosseGameResult, SimulateLacrosseGameInput } from './possession-sim';

export type GamePeriod = 1 | 2 | 3 | 4 | 'OT';

export type GameEventType = 'faceoff' | 'shot' | 'save' | 'goal' | 'turnover' | 'penalty' | 'period_end';

export interface GameEvent {
  id: string;
  period: GamePeriod;
  /** Seconds elapsed since the start of this period (0–900 for regular quarters, 0–240 for OT) */
  timeElapsed: number;
  type: GameEventType;
  /** The team the play belongs to: the shooter's, the faceoff winner's, the penalized side's. */
  teamId: string;
  playerId?: string;
  assistPlayerId?: string;
  homeScore: number;
  awayScore: number;
  description: string;
  isKeyPlay: boolean;
}

export interface ExtraManLine {
  goals: number;
  chances: number;
}

export interface GameLog {
  homeTeamId: string;
  awayTeamId: string;
  events: GameEvent[];
  leadChanges: number;
  biggestLead: number;
  /** Offensive possessions for each side; absent on logs trimmed to the scoring summary. */
  possessions?: { home: number; away: number };
  /** Man-up goals and chances for each side. */
  extraMan?: { home: ExtraManLine; away: ExtraManLine };
  /** Every stat line from the game, both teams; absent on trimmed logs. */
  playerLines?: LacrossePlayerGameStats[];
}

export type LacrosseGameResultWithLog = LacrosseGameResult & { log: GameLog; players: LacrosseGamePlayerDetail };

export function simulateLacrosseGameWithLog(input: SimulateLacrosseGameInput): LacrosseGameResultWithLog {
  const { result, players, log } = simulatePossessionGame(input);
  return { ...result, log, players };
}

/** Event types that survive when a log is trimmed to its scoring summary. */
const SCORING_EVENT_TYPES: ReadonlySet<GameEventType> = new Set(['goal', 'period_end']);

/**
 * Keep only the scoring summary of a log. Games the user never opens the full
 * play-by-play for (other programs' games) are stored this way to keep saves
 * small; the goals, running score and period breaks remain.
 */
export function compactGameLog(log: GameLog): GameLog {
  const { playerLines: _playerLines, possessions: _possessions, ...rest } = log;
  void _playerLines;
  void _possessions;
  return { ...rest, events: log.events.filter((event) => SCORING_EVENT_TYPES.has(event.type)) };
}

export function isScoringEvent(event: GameEvent): boolean {
  return SCORING_EVENT_TYPES.has(event.type);
}

export function formatEventTime(event: GameEvent): string {
  const mins = Math.floor(event.timeElapsed / 60);
  const secs = event.timeElapsed % 60;
  const periodStr = event.period === 'OT' ? 'OT' : `Q${event.period}`;
  return `${periodStr} ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
