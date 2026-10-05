import type { GameEvent, GameLog, LacrosseGamePlan } from '@sports-management-sim/sport-lacrosse';
import type { TournamentPhase } from './tournament';

/**
 * Halftime in the locker room, in the spirit of Football Manager's team talk:
 * the user sees how the first half went and adjusts the plan for the second.
 */
/** A coached game paused at the half: the dice seed and the game as previewed. */
export interface HalftimeState {
  seed: number;
  week: number;
  gameId: string;
  log: GameLog;
  /** Set for a postseason game: the round it was paused in. */
  tournamentPhase?: TournamentPhase;
}

export interface HalfSideStats {
  goals: number;
  shots: number;
  faceoffWins: number;
  turnovers: number;
  penalties: number;
}

export interface HalftimeReport {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  home: HalfSideStats;
  away: HalfSideStats;
  /** First-half goals, in order. */
  goals: GameEvent[];
}

const empty = (): HalfSideStats => ({ goals: 0, shots: 0, faceoffWins: 0, turnovers: 0, penalties: 0 });

export function firstHalfEvents(log: GameLog): GameEvent[] {
  return log.events.filter((e) => e.period === 1 || e.period === 2);
}

export function halftimeReport(log: GameLog): HalftimeReport {
  const events = firstHalfEvents(log);
  const home = empty();
  const away = empty();
  for (const e of events) {
    const side = e.teamId === log.homeTeamId ? home : away;
    if (e.type === 'goal') {
      side.goals += 1;
      side.shots += 1;
    } else if (e.type === 'shot' || e.type === 'save') side.shots += 1;
    else if (e.type === 'faceoff') side.faceoffWins += 1;
    else if (e.type === 'turnover') side.turnovers += 1;
    else if (e.type === 'penalty') side.penalties += 1;
  }
  const last = events.at(-1);
  return {
    homeTeamId: log.homeTeamId,
    awayTeamId: log.awayTeamId,
    homeScore: last?.homeScore ?? 0,
    awayScore: last?.awayScore ?? 0,
    home,
    away,
    goals: events.filter((e) => e.type === 'goal'),
  };
}

export interface HalftimeTip {
  text: string;
  /** The adjustment the tip points at, applied by its button. */
  plan: Partial<LacrosseGamePlan>;
}

/** What the staff would tell you at the half, most pressing first. */
export function halftimeAdvice(report: HalftimeReport, userTeamId: string, currentPlan?: LacrosseGamePlan): HalftimeTip[] {
  const userHome = report.homeTeamId === userTeamId;
  const us = userHome ? report.home : report.away;
  const them = userHome ? report.away : report.home;
  const margin = userHome ? report.homeScore - report.awayScore : report.awayScore - report.homeScore;
  const tips: HalftimeTip[] = [];
  if (margin <= -3) {
    tips.push({ text: `Down ${-margin}: push the pace and press to get extra possessions.`, plan: { tempo: 'uptempo', defense: 'pressure', ride: 'aggressive' } });
  } else if (margin >= 3) {
    tips.push({ text: `Up ${margin}: slow it down and protect the lead.`, plan: { tempo: 'patient', defense: 'shell', ride: 'conservative' } });
  }
  const faceoffs = us.faceoffWins + them.faceoffWins;
  if (faceoffs >= 6 && them.faceoffWins / faceoffs >= 0.62) {
    tips.push({ text: `They won ${them.faceoffWins} of ${faceoffs} faceoffs. Make every possession count with a patient offense.`, plan: { tempo: 'patient' } });
  }
  if (us.turnovers >= them.turnovers + 3) {
    tips.push({ text: `${us.turnovers} turnovers to their ${them.turnovers}. Settle down on offense.`, plan: { tempo: 'patient' } });
  }
  if (them.shots >= us.shots + 6) {
    tips.push({ text: `They outshot us ${them.shots}-${us.shots}. Pack it in and make them shoot from outside.`, plan: { defense: 'shell' } });
  }
  if (us.penalties >= 3 && currentPlan?.defense === 'pressure') {
    tips.push({ text: `${us.penalties} penalties already. A pressure defense will draw more flags.`, plan: { defense: 'balanced' } });
  }
  if (tips.length === 0) tips.push({ text: 'Close game and the plan is working. Stay the course.', plan: {} });
  return tips;
}

/** The dice for a coached game: the same seed always rolls the same game. */
export function seededGameRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
