import type { LacrosseTeam } from './models';
import type { LacrosseGameResult, SimulateLacrosseGameInput } from './simulate-game';
import { simulateLacrosseGame } from './simulate-game';

export type GamePeriod = 1 | 2 | 3 | 4 | 'OT';

export type GameEventType = 'goal' | 'period_end';

export interface GameEvent {
  id: string;
  period: GamePeriod;
  /** Seconds elapsed since the start of this period (0–899 for regular quarters, 0–299 for OT) */
  timeElapsed: number;
  type: GameEventType;
  teamId: string;
  playerId?: string;
  assistPlayerId?: string;
  homeScore: number;
  awayScore: number;
  description: string;
  isKeyPlay: boolean;
}

export interface GameLog {
  homeTeamId: string;
  awayTeamId: string;
  events: GameEvent[];
  leadChanges: number;
  biggestLead: number;
}

export type LacrosseGameResultWithLog = LacrosseGameResult & { log: GameLog };

export function simulateLacrosseGameWithLog(
  input: SimulateLacrosseGameInput,
): LacrosseGameResultWithLog {
  const random = input.random ?? Math.random;
  const result = simulateLacrosseGame({ ...input, random });
  const log = buildGameLog(input.homeTeam, input.awayTeam, result, random);
  return { ...result, log };
}

// ── internal ────────────────────────────────────────────────────────────────

type RosterPlayer = LacrosseTeam['roster'][0];

function buildGameLog(
  homeTeam: LacrosseTeam,
  awayTeam: LacrosseTeam,
  result: LacrosseGameResult,
  random: () => number,
): GameLog {
  const periods: GamePeriod[] = result.overtime ? [1, 2, 3, 4, 'OT'] : [1, 2, 3, 4];

  const homeWon = result.winnerTeamId === homeTeam.id;
  const homeDist = distributeAcrossPeriods(result.homeScore, result.overtime, homeWon, random);
  const awayDist = distributeAcrossPeriods(result.awayScore, result.overtime, !homeWon, random);

  const events: GameEvent[] = [];
  let homeRunning = 0;
  let awayRunning = 0;
  let leadChanges = 0;
  let biggestLead = 0;
  let eventIdx = 0;

  for (let pi = 0; pi < periods.length; pi++) {
    const period = periods[pi]!;
    const periodSeconds = period === 'OT' ? 300 : 900;

    const hGoals = homeDist[pi] ?? 0;
    const aGoals = awayDist[pi] ?? 0;

    const periodGoals: { time: number; isHome: boolean }[] = [];
    for (let g = 0; g < hGoals; g++) {
      periodGoals.push({ time: Math.floor(random() * periodSeconds), isHome: true });
    }
    for (let g = 0; g < aGoals; g++) {
      periodGoals.push({ time: Math.floor(random() * periodSeconds), isHome: false });
    }
    periodGoals.sort((a, b) => a.time - b.time);

    for (const goal of periodGoals) {
      const prevLead = homeRunning - awayRunning;

      if (goal.isHome) homeRunning++;
      else awayRunning++;

      const newLead = homeRunning - awayRunning;
      const absLead = Math.abs(newLead);
      if (absLead > biggestLead) biggestLead = absLead;

      const leadFlipped =
        prevLead !== 0 &&
        ((prevLead > 0 && newLead <= 0) || (prevLead < 0 && newLead >= 0));
      if (leadFlipped) leadChanges++;

      const team = goal.isHome ? homeTeam : awayTeam;
      const scorer = pickScorer(team.roster, random);
      const assister = random() > 0.45 ? pickAssister(team.roster, scorer?.id, random) : null;

      const isTying = newLead === 0;
      const isTakingLead = leadFlipped && newLead !== 0;
      const isClutch = period === 4 && goal.time > 750;
      const isOT = period === 'OT';
      const isKeyPlay = isTying || isTakingLead || isClutch || isOT;

      const desc = buildGoalDescription(
        scorer,
        assister,
        team.name,
        goal.isHome,
        homeRunning,
        awayRunning,
        isTying,
        isOT,
      );

      events.push({
        id: String(eventIdx++),
        period,
        timeElapsed: goal.time,
        type: 'goal',
        teamId: team.id,
        ...(scorer ? { playerId: scorer.id } : {}),
        ...(assister ? { assistPlayerId: assister.id } : {}),
        homeScore: homeRunning,
        awayScore: awayRunning,
        description: desc,
        isKeyPlay,
      });
    }

    const periodLabel = period === 'OT' ? 'OT' : `Q${period}`;
    const scoreStr = `${homeTeam.name} ${homeRunning}, ${awayTeam.name} ${awayRunning}`;
    const endDesc =
      period === 'OT'
        ? `Final (OT) · ${scoreStr}`
        : `End of ${periodLabel} · ${homeRunning}–${awayRunning}`;

    events.push({
      id: String(eventIdx++),
      period,
      timeElapsed: periodSeconds,
      type: 'period_end',
      teamId: homeTeam.id,
      homeScore: homeRunning,
      awayScore: awayRunning,
      description: endDesc,
      isKeyPlay: false,
    });
  }

  return { homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, events, leadChanges, biggestLead };
}

function distributeAcrossPeriods(
  totalGoals: number,
  overtime: boolean,
  isWinner: boolean,
  random: () => number,
): number[] {
  const numSlots = overtime ? 5 : 4;
  const dist = new Array<number>(numSlots).fill(0);

  if (totalGoals === 0) return dist;

  if (overtime && isWinner) {
    // Winner's final goal is the OT sudden-death winner; rest in Q1–Q4
    dist[4] = 1;
    for (let g = 0; g < totalGoals - 1; g++) {
      dist[Math.floor(random() * 4)]!++;
    }
  } else {
    // Loser never scores in OT (sudden death); distribute all to Q1–Q4
    for (let g = 0; g < totalGoals; g++) {
      dist[Math.floor(random() * 4)]!++;
    }
  }

  return dist;
}

function pickScorer(roster: RosterPlayer[], random: () => number): RosterPlayer | null {
  const off = roster.filter((p) => p.position === 'ATT' || p.position === 'MID');
  const pool = off.length > 0 ? off : roster;
  if (pool.length === 0) return null;
  const weights = pool.map((p) => Math.max(1, p.ratings.skill + p.ratings.speed));
  return weightedPick(pool, weights, random);
}

function pickAssister(
  roster: RosterPlayer[],
  scorerId: string | undefined,
  random: () => number,
): RosterPlayer | null {
  const candidates = roster.filter(
    (p) => (p.position === 'ATT' || p.position === 'MID') && p.id !== scorerId,
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)] ?? null;
}

function weightedPick<T>(items: T[], weights: number[], random: () => number): T | null {
  if (items.length === 0) return null;
  const total = weights.reduce((s, w) => s + w, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1] ?? null;
}

function buildGoalDescription(
  scorer: RosterPlayer | null,
  assister: RosterPlayer | null,
  teamName: string,
  _isHome: boolean,
  homeScore: number,
  awayScore: number,
  isTying: boolean,
  isOT: boolean,
): string {
  const short = teamName.split(' ').slice(-1)[0] ?? teamName;
  const scorerStr = scorer ? `${scorer.name.first[0]}. ${scorer.name.last}` : 'Goal';
  let line = `${short} · ${scorerStr}`;
  if (assister) {
    line += ` (${assister.name.first[0]}. ${assister.name.last})`;
  }
  line += ` · ${homeScore}–${awayScore}`;
  if (isOT) line += ' 🏆';
  else if (isTying) line += ' — ties it';
  return line;
}

export function formatEventTime(event: GameEvent): string {
  const mins = Math.floor(event.timeElapsed / 60);
  const secs = event.timeElapsed % 60;
  const periodStr = event.period === 'OT' ? 'OT' : `Q${event.period}`;
  return `${periodStr} ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
