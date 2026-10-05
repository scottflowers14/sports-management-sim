import type { GameResult } from '@sports-management-sim/engine-core';
import type { GameEvent, GameLog, GamePeriod } from './game-log';
import { getTacticEffects, normalizeGamePlan, type LacrosseGamePlan, type TacticEffects } from './game-plan';
import { buildLacrosseLineup, midfieldLineShares, type LacrosseLineup } from './lineups';
import type { LacrossePlayer, LacrossePlayerGameStats, LacrosseTeam, LacrosseTeamStats } from './models';
import type { CoachingEdge } from './staff';
import { fanHomeEdgeFactor } from './program-investments';

export type RandomSource = () => number;

export interface SimulateLacrosseGameInput {
  homeTeam: LacrosseTeam;
  awayTeam: LacrosseTeam;
  random?: RandomSource;
  homeGamePlan?: Partial<LacrosseGamePlan>;
  awayGamePlan?: Partial<LacrosseGamePlan>;
  /** Championship-weekend games are played at a neutral site: no home edge. */
  neutralSite?: boolean;
  /** Coordinator quality for each side (see coachingEdge); omitted means average. */
  homeCoaching?: CoachingEdge;
  awayCoaching?: CoachingEdge;
  /**
   * Halftime adjustments: each side switches to this plan for the third
   * quarter on. With the same random source, the first half plays out exactly
   * as it would have without them.
   */
  homeSecondHalfPlan?: Partial<LacrosseGamePlan>;
  awaySecondHalfPlan?: Partial<LacrosseGamePlan>;
}

export type LacrosseGameResult = GameResult<LacrosseTeamStats>;

/** Individual stat lines for both sides of one game. */
export interface LacrosseGamePlayerDetail {
  home: LacrossePlayerGameStats[];
  away: LacrossePlayerGameStats[];
}

export interface LacrosseSimulatedGame {
  result: LacrosseGameResult;
  players: LacrosseGamePlayerDetail;
  log: GameLog;
}

export const PERIOD_SECONDS = 900;
/** NCAA overtime is four-minute sudden-victory periods. */
export const OVERTIME_SECONDS = 240;
export const SHOT_CLOCK_SECONDS = 80;
/** Safety bound on sudden-victory periods; a game that gets here ends on a coin flip. */
const MAX_OVERTIMES = 6;

/**
 * Home teams score a little more often (crowd, familiarity, last change).
 * Expressed in the same units as a coaching edge: about half a goal a game,
 * so home teams win about 57% of even matchups. A bigger crowd adds to it
 * (see fanHomeEdgeFactor).
 */
export const HOME_SCORING_EDGE = 0.016;

const NO_COACHING_EDGE: CoachingEdge = { offense: 0, defense: 0 };

/** A coaching/home edge of 0.012 is worth about 5% more goals. */
const EDGE_TO_FINISH = 2;

/** How much a rating-point gap between units moves each outcome. */
const SENSITIVITY = {
  finish: 1 / 190,
  onGoal: 1 / 400,
  turnover: 1 / 140,
  faceoff: 1 / 125,
  clear: 1 / 420,
};

interface PenaltyServed {
  playerId: string;
  remaining: number;
  releasable: boolean;
}

interface Side {
  team: LacrosseTeam;
  isHome: boolean;
  plan: LacrosseGamePlan;
  effects: TacticEffects;
  coaching: CoachingEdge;
  lineup: LacrosseLineup;
  lineShares: number[];
  lines: Map<string, LacrossePlayerGameStats>;
  seconds: Map<string, number>;
  byId: Map<string, LacrossePlayer>;
  clears: number;
  clearAttempts: number;
  possessions: number;
  extraMan: { goals: number; chances: number };
  box: PenaltyServed[];
  score: number;
  /** Shift that is currently out; re-rolled every time the ball changes hands. */
  midLine: number;
}

interface PossessionContext {
  fastBreak: boolean;
  /** Possession opened from the defensive end and must clear first. */
  mustClear: boolean;
}

type PossessionOutcome = 'goal' | 'turnover' | 'save' | 'miss' | 'buzzer';

interface Clock {
  period: GamePeriod;
  periodIndex: number;
  /** Seconds elapsed in this period. */
  elapsed: number;
  periodLength: number;
}

export function simulatePossessionGame(input: SimulateLacrosseGameInput): LacrosseSimulatedGame {
  const random = input.random ?? Math.random;
  const home = makeSide(input.homeTeam, true, input.homeGamePlan, input.homeCoaching ?? NO_COACHING_EDGE);
  const away = makeSide(input.awayTeam, false, input.awayGamePlan, input.awayCoaching ?? NO_COACHING_EDGE);
  const homeEdge = input.neutralSite ? 0 : HOME_SCORING_EDGE * fanHomeEdgeFactor(input.homeTeam.reputation.fanSupport);
  const homeFinishEdge = EDGE_TO_FINISH * (homeEdge + home.coaching.offense - away.coaching.defense);
  const awayFinishEdge = EDGE_TO_FINISH * (away.coaching.offense - home.coaching.defense);

  const events: GameEvent[] = [];
  let eventIdx = 0;
  let leadChanges = 0;
  let lastLeader = 0;
  let biggestLead = 0;
  let overtime = false;

  const push = (clock: Clock, event: Omit<GameEvent, 'id' | 'period' | 'timeElapsed' | 'homeScore' | 'awayScore'>) => {
    events.push({
      id: String(eventIdx++),
      period: clock.period,
      timeElapsed: Math.min(clock.periodLength, Math.round(clock.elapsed)),
      homeScore: home.score,
      awayScore: away.score,
      ...event,
    });
  };

  const playPeriod = (clock: Clock, suddenVictory: boolean): boolean => {
    let offense: Side | null = null;
    let context: PossessionContext = { fastBreak: false, mustClear: false };
    let needFaceoff = true;

    while (clock.elapsed < clock.periodLength) {
      if (needFaceoff) {
        offense = faceoff(home, away, clock, random, push);
        context = { fastBreak: false, mustClear: false };
        needFaceoff = false;
        continue;
      }
      const attacking = offense!;
      const defending = attacking === home ? away : home;
      const outcome = playPossession(attacking, defending, context, clock, random, push, attacking === home ? homeFinishEdge : awayFinishEdge);

      if (outcome === 'goal') {
        const newLead = home.score - away.score;
        biggestLead = Math.max(biggestLead, Math.abs(newLead));
        // The lead changes whenever a different team is in front than last time anyone led.
        if (newLead !== 0) {
          if (lastLeader !== 0 && Math.sign(newLead) !== lastLeader) leadChanges += 1;
          lastLeader = Math.sign(newLead);
        }
        if (suddenVictory) return true;
        needFaceoff = true;
        continue;
      }
      if (outcome === 'buzzer') break;
      // Ball changes hands; the new offense has to clear unless it was a ride win.
      offense = defending;
      context = nextContext(outcome, attacking, defending, random);
    }

    clock.elapsed = clock.periodLength;
    const label = clock.period === 'OT' ? 'OT' : `Q${clock.period}`;
    push(clock, {
      type: 'period_end',
      teamId: home.team.id,
      description:
        clock.period === 'OT' && home.score === away.score
          ? `End of ${label} · still tied ${home.score}–${away.score}`
          : clock.period === 'OT' || clock.period === 4
            ? `Final${clock.period === 'OT' ? ' (OT)' : ''} · ${home.team.name} ${home.score}, ${away.team.name} ${away.score}`
            : `End of ${label} · ${home.score}–${away.score}`,
      isKeyPlay: false,
    });
    return false;
  };

  for (let q = 1; q <= 4; q += 1) {
    if (q === 3) {
      if (input.homeSecondHalfPlan) switchPlan(home, input.homeSecondHalfPlan);
      if (input.awaySecondHalfPlan) switchPlan(away, input.awaySecondHalfPlan);
    }
    playPeriod({ period: q as GamePeriod, periodIndex: q - 1, elapsed: 0, periodLength: PERIOD_SECONDS }, false);
  }
  for (let ot = 0; ot < MAX_OVERTIMES && home.score === away.score; ot += 1) {
    overtime = true;
    home.box.length = 0;
    away.box.length = 0;
    const clock: Clock = { period: 'OT', periodIndex: 4 + ot, elapsed: 0, periodLength: OVERTIME_SECONDS };
    const decided = playPeriod(clock, true);
    if (decided) {
      push({ ...clock }, {
        type: 'period_end',
        teamId: home.team.id,
        description: `Final (OT) · ${home.team.name} ${home.score}, ${away.team.name} ${away.score}`,
        isKeyPlay: false,
      });
    }
  }
  if (home.score === away.score) {
    // Six overtimes without a goal is vanishingly rare; settle it rather than loop forever.
    const winner = random() < 0.5 ? home : away;
    const loser = winner === home ? away : home;
    const shooter = winner.lineup.attack[0] ?? winner.lineup.midfieldLines[0]?.[0] ?? winner.team.roster[0];
    winner.score += 1;
    if (shooter) {
      const l = line(winner, shooter);
      l.shots += 1;
      l.shotsOnGoal += 1;
      l.goals += 1;
      if (loser.lineup.goalie) {
        const g = line(loser, loser.lineup.goalie);
        g.goalsAllowed = (g.goalsAllowed ?? 0) + 1;
      }
      push({ period: 'OT', periodIndex: 4 + MAX_OVERTIMES, elapsed: OVERTIME_SECONDS, periodLength: OVERTIME_SECONDS }, {
        type: 'goal',
        teamId: winner.team.id,
        playerId: shooter.id,
        description: `${shortTeam(winner.team.name)} · ${short(shooter)} · ${home.score}–${away.score} 🏆`,
        isKeyPlay: true,
      });
    }
  }

  const homeStats = buildTeamStats(home);
  const awayStats = buildTeamStats(away);
  const homeWon = home.score > away.score;
  const result: LacrosseGameResult = {
    homeScore: home.score,
    awayScore: away.score,
    winnerTeamId: homeWon ? home.team.id : away.team.id,
    loserTeamId: homeWon ? away.team.id : home.team.id,
    overtime,
    teamStats: { home: homeStats, away: awayStats },
  };
  const players: LacrosseGamePlayerDetail = { home: [...home.lines.values()], away: [...away.lines.values()] };
  const log: GameLog = {
    homeTeamId: home.team.id,
    awayTeamId: away.team.id,
    events,
    leadChanges,
    biggestLead,
    possessions: { home: home.possessions, away: away.possessions },
    extraMan: { home: home.extraMan, away: away.extraMan },
    playerLines: [...players.home, ...players.away],
  };
  return { result, players, log };
}

// ── possessions ─────────────────────────────────────────────────────────────

function playPossession(
  offense: Side,
  defense: Side,
  context: PossessionContext,
  clock: Clock,
  random: RandomSource,
  push: Push,
  finishEdge: number,
): PossessionOutcome {
  offense.possessions += 1;
  const situation = lateGameSituation(offense, defense, clock);
  const tempo = situation === 'chasing' ? 0.72 : situation === 'protecting' ? 1.55 : 1;

  // Clear the ball out of the defensive end first.
  if (context.mustClear) {
    const cleared = attemptClear(offense, defense, clock, random, push);
    if (clock.elapsed >= clock.periodLength) return 'buzzer';
    if (!cleared) {
      // The ride won it back in the offensive half: the riding team attacks immediately.
      offense.possessions -= 1;
      return 'turnover';
    }
    if (random() < defense.effects.rideTransitionAllowed) context = { ...context, fastBreak: true };
  }

  const manUp = defense.box.length > 0 && offense.box.length === 0;
  const manDown = offense.box.length > 0 && defense.box.length === 0;
  if (manUp) offense.extraMan.chances += 1;

  // Settle in: entry and first set-up time.
  const settle = context.fastBreak ? 4 + random() * 4 : (12 + random() * 10) * offense.effects.possessionLength * tempo;
  const attackers = manUp ? offense.lineup.manUp : onFieldOffense(offense, random);
  const defenders = manDown ? defense.lineup.manDown : onFieldDefense(defense, random);
  const goalie = defense.lineup.goalie;
  let used = settle;
  let looks = 0;
  const maxLooks = context.fastBreak ? 1 : 3;

  // A defensive penalty can come at any point in a settled possession.
  if (!context.fastBreak && defenders.length > 0 && random() < penaltyChance(defense, defenders)) {
    const offender = weightedPick(defenders, (p) => (110 - p.ratings.discipline) * (0.6 + p.sportTraits.checking / 100), random)!;
    const seconds = rollPenaltySeconds(random);
    flag(defense, offender, seconds, clock, used, push, offense, random);
    if (!manUp) offense.extraMan.chances += 1;
  }
  const extraMan = defense.box.length > 0 && offense.box.length === 0;
  const shooters = extraMan ? offense.lineup.manUp : attackers;
  const covering = defense.box.length > 0 ? defense.lineup.manDown : defenders;

  while (looks < maxLooks) {
    const lookTime = context.fastBreak ? 3 + random() * 4 : (11 + random() * 13) * offense.effects.possessionLength * tempo;
    if (clock.elapsed + used + lookTime > clock.periodLength) {
      // Time runs out; a desperate heave at the horn now and then.
      const left = Math.max(0, clock.periodLength - clock.elapsed);
      chargeTime(offense, defense, shooters, covering, left, context.fastBreak);
      clock.elapsed = clock.periodLength;
      if (random() < 0.3 && shooters.length > 0) {
        const shooter = pickShooter(shooters, random);
        line(offense, shooter).shots += 1;
        push(clock, { type: 'shot', teamId: offense.team.id, playerId: shooter.id, description: `${short(shooter)} fires at the horn, wide`, isKeyPlay: false });
      }
      return 'buzzer';
    }
    used += lookTime;
    looks += 1;
    if (used > SHOT_CLOCK_SECONDS && looks < maxLooks) {
      // Shot clock violation.
      chargeTime(offense, defense, shooters, covering, used, context.fastBreak);
      clock.elapsed += used;
      const carrier = pickHandler(shooters, random);
      line(offense, carrier).turnovers += 1;
      push(clock, { type: 'turnover', teamId: offense.team.id, playerId: carrier.id, description: `Shot clock violation on ${short(carrier)}`, isKeyPlay: false });
      return 'turnover';
    }

    // Turnover before a shot?
    if (shooters.length === 0 || random() < turnoverChance(offense, defense, shooters, covering, extraMan, context.fastBreak, situation)) {
      chargeTime(offense, defense, shooters, covering, used, context.fastBreak);
      clock.elapsed += used;
      if (shooters.length === 0) return 'turnover';
      const carrier = pickHandler(shooters, random);
      const causedShare = 0.5 * (defense.plan.defense === 'pressure' ? 1.2 : defense.plan.defense === 'shell' ? 0.85 : 1);
      const causer = covering.length > 0 && random() < causedShare ? weightedPick(covering, takeawayWeight, random) : null;
      line(offense, carrier).turnovers += 1;
      if (causer) {
        const d = line(defense, causer);
        d.causedTurnovers += 1;
        if (random() < 0.8) d.groundBalls += 1;
        push(clock, { type: 'turnover', teamId: offense.team.id, playerId: carrier.id, description: `${short(carrier)} stripped by ${short(causer)}`, isKeyPlay: false });
      } else {
        if (covering.length > 0 && random() < 0.5) line(defense, weightedPick(covering, (p) => p.sportTraits.groundBalls, random)!).groundBalls += 1;
        push(clock, { type: 'turnover', teamId: offense.team.id, playerId: carrier.id, description: `${short(carrier)} ${random() < 0.5 ? 'throws it away' : 'loses the handle'}`, isKeyPlay: false });
      }
      return 'turnover';
    }

    // A shot.
    const shooter = pickShooter(shooters, random);
    const defender = covering.length > 0 ? weightedPick(covering, (p) => 0.5 + p.sportTraits.defense / 100, random) : null;
    const shooterLine = line(offense, shooter);
    shooterLine.shots += 1;
    const onGoal = random() < onGoalChance(shooter, offense, context.fastBreak, extraMan);
    chargeTime(offense, defense, shooters, covering, used, context.fastBreak);
    clock.elapsed += used;
    used = 0;

    if (!onGoal) {
      const roll = random();
      const how = roll < 0.12 ? 'off the pipe' : roll < 0.3 && defender ? `blocked by ${short(defender)}` : 'wide';
      push(clock, { type: 'shot', teamId: offense.team.id, playerId: shooter.id, description: `${short(shooter)} ${how}`, isKeyPlay: false });
      // Lacrosse rule: the ball goes to whoever is closest when it goes out, so the offense often keeps it.
      if (!context.fastBreak && looks < maxLooks && random() < 0.5) {
        if (random() < 0.6) line(offense, weightedPick(shooters, (p) => p.sportTraits.groundBalls, random)!).groundBalls += 1;
        continue;
      }
      if (random() < 0.8) {
        const recoverer = goalie && random() < 0.3 ? goalie : covering.length > 0 ? weightedPick(covering, (p) => p.sportTraits.groundBalls, random)! : goalie;
        if (recoverer) line(defense, recoverer).groundBalls += 1;
      }
      return 'miss';
    }

    shooterLine.shotsOnGoal += 1;
    const scored = random() < finishChance(shooter, defender, goalie, offense, defense, extraMan, context.fastBreak, finishEdge);
    if (!scored) {
      if (goalie) {
        const g = line(defense, goalie);
        g.saves = (g.saves ?? 0) + 1;
      }
      const late = clock.period === 'OT' || (clock.period === 4 && clock.elapsed > 780 && Math.abs(offense.score - defense.score) <= 1);
      push(clock, {
        type: 'save',
        teamId: defense.team.id,
        ...(goalie ? { playerId: goalie.id } : {}),
        description: goalie ? `${short(goalie)} ${late ? 'comes up huge on' : 'stops'} ${short(shooter)}` : `${short(shooter)} turned away`,
        isKeyPlay: late,
      });
      return 'save';
    }

    // Goal.
    shooterLine.goals += 1;
    offense.score += 1;
    if (goalie) {
      const g = line(defense, goalie);
      g.goalsAllowed = (g.goalsAllowed ?? 0) + 1;
    }
    if (extraMan) offense.extraMan.goals += 1;
    const feeders = shooters.filter((p) => p.id !== shooter.id);
    const assisted = !context.fastBreak && feeders.length > 0 && random() < assistChance(feeders);
    const assister = assisted ? weightedPick(feeders, (p) => Math.max(1, p.sportTraits.passing - 35) * (p.position === 'ATT' ? 1.3 : 1), random) : null;
    if (assister) line(offense, assister).assists += 1;
    releasePenalties(defense);

    const lead = offense.score - defense.score;
    const isTying = lead === 0;
    const takesLead = lead === 1 && offense.score > 1;
    const isOT = clock.period === 'OT';
    const isClutch = clock.period === 4 && clock.elapsed > 750 && Math.abs(lead) <= 2;
    const homeScore = offense.isHome ? offense.score : defense.score;
    const awayScore = offense.isHome ? defense.score : offense.score;
    let description = `${shortTeam(offense.team.name)} · ${short(shooter)}`;
    if (assister) description += ` (${short(assister)})`;
    description += ` · ${homeScore}–${awayScore}`;
    if (extraMan) description += ' · man-up';
    else if (context.fastBreak) description += ' · fast break';
    if (isOT) description += ' 🏆';
    else if (isTying) description += ' — ties it';
    else if (takesLead) description += ' — takes the lead';
    push(clock, {
      type: 'goal',
      teamId: offense.team.id,
      playerId: shooter.id,
      ...(assister ? { assistPlayerId: assister.id } : {}),
      description,
      isKeyPlay: isTying || takesLead || isClutch || isOT,
    });
    return 'goal';
  }

  // Three looks without a shot getting through: the defense ran the clock out.
  chargeTime(offense, defense, shooters, covering, used, context.fastBreak);
  clock.elapsed += used;
  const carrier = pickHandler(shooters, random);
  line(offense, carrier).turnovers += 1;
  push(clock, { type: 'turnover', teamId: offense.team.id, playerId: carrier.id, description: `Shot clock violation on ${short(carrier)}`, isKeyPlay: false });
  return 'turnover';
}

type Push = (clock: Clock, event: Omit<GameEvent, 'id' | 'period' | 'timeElapsed' | 'homeScore' | 'awayScore'>) => void;

function nextContext(outcome: PossessionOutcome, previousOffense: Side, newOffense: Side, random: RandomSource): PossessionContext {
  void previousOffense;
  void newOffense;
  void random;
  // After a save or a takeaway the ball is in the defensive end: clear it.
  // After a miss the defense usually scoops it deep too.
  return { fastBreak: false, mustClear: outcome === 'save' || outcome === 'turnover' || outcome === 'miss' };
}

function attemptClear(offense: Side, defense: Side, clock: Clock, random: RandomSource, push: Push): boolean {
  const seconds = 7 + random() * 7;
  const clearers = [...offense.lineup.closeDefense, ...(offense.lineup.longStickMid ? [offense.lineup.longStickMid] : [])];
  const goalie = offense.lineup.goalie;
  const skill =
    average([
      ...clearers.map((p) => p.sportTraits.passing * 0.6 + p.ratings.iq * 0.4),
      ...(goalie ? [goalie.sportTraits.goalieClearing ?? goalie.sportTraits.passing] : []),
    ]) || 50;
  const riders = defense.lineup.attack;
  const rideSkill = riders.length > 0 ? average(riders.map((p) => p.ratings.athleticism * 0.5 + p.sportTraits.groundBalls * 0.3 + p.ratings.iq * 0.2)) : 40;
  const failure = clamp(
    0.11 + defense.effects.rideClearFailure - (skill - rideSkill) * SENSITIVITY.clear + (offense.box.length > 0 ? 0.05 : 0),
    0.03,
    0.4,
  );
  offense.clearAttempts += 1;
  // Clearing time is charged to the units on the field for the clear.
  const clearUnit = [...clearers, ...(goalie ? [goalie] : [])];
  for (const p of clearUnit) addSeconds(offense, p, seconds);
  for (const p of riders) addSeconds(defense, p, seconds);
  clock.elapsed = Math.min(clock.periodLength, clock.elapsed + seconds);
  if (clock.elapsed >= clock.periodLength) {
    offense.clears += 1;
    return true;
  }
  if (random() >= failure) {
    offense.clears += 1;
    return true;
  }
  const culprit = goalie && random() < 0.25 ? goalie : weightedPick(clearers, (p) => 1.4 - p.sportTraits.passing / 100, random) ?? goalie;
  const rider = riders.length > 0 ? weightedPick(riders, (p) => 0.5 + p.ratings.athleticism / 100, random)! : null;
  if (culprit) line(offense, culprit).turnovers += 1;
  if (rider) {
    const r = line(defense, rider);
    r.causedTurnovers += 1;
    r.groundBalls += 1;
  }
  push(clock, {
    type: 'turnover',
    teamId: offense.team.id,
    ...(culprit ? { playerId: culprit.id } : {}),
    description: `Failed clear${culprit ? ` by ${short(culprit)}` : ''}${rider ? ` — ${short(rider)} rides it back` : ''}`,
    isKeyPlay: false,
  });
  return false;
}

function faceoff(home: Side, away: Side, clock: Clock, random: RandomSource, push: Push): Side {
  const seconds = 4 + random() * 8;
  const homeMan = faceoffMan(home, random);
  const awayMan = faceoffMan(away, random);
  const homeSkill = homeMan ? faceoffSkill(home, homeMan) : 30;
  const awaySkill = awayMan ? faceoffSkill(away, awayMan) : 30;
  const homeWinChance = clamp(0.5 + (homeSkill - awaySkill) * SENSITIVITY.faceoff, 0.18, 0.82);
  const homeWins = random() < homeWinChance;
  const winner = homeWins ? home : away;
  const loser = homeWins ? away : home;
  const winnerMan = homeWins ? homeMan : awayMan;
  const loserMan = homeWins ? awayMan : homeMan;
  if (homeMan) {
    const l = line(home, homeMan);
    l.faceoffAttempts = (l.faceoffAttempts ?? 0) + 1;
    addSeconds(home, homeMan, seconds);
  }
  if (awayMan) {
    const l = line(away, awayMan);
    l.faceoffAttempts = (l.faceoffAttempts ?? 0) + 1;
    addSeconds(away, awayMan, seconds);
  }
  let scooper: LacrossePlayer | null = winnerMan;
  if (winnerMan) {
    const l = line(winner, winnerMan);
    l.faceoffWins = (l.faceoffWins ?? 0) + 1;
    // Clean wins go to the specialist; scrums go to a wing.
    if (random() < 0.3) {
      const wings = [winner.lineup.longStickMid, ...(winner.lineup.midfieldLines[0] ?? [])].filter((p): p is LacrossePlayer => Boolean(p));
      scooper = wings.length > 0 ? weightedPick(wings, (p) => p.sportTraits.groundBalls, random)! : winnerMan;
    }
  }
  if (scooper && random() < 0.95) line(winner, scooper).groundBalls += 1;
  clock.elapsed = Math.min(clock.periodLength, clock.elapsed + seconds);
  push(clock, {
    type: 'faceoff',
    teamId: winner.team.id,
    ...(winnerMan ? { playerId: winnerMan.id } : {}),
    description: winnerMan
      ? `${short(winnerMan)} wins the faceoff${loserMan ? ` over ${short(loserMan)}` : ''}${scooper && scooper !== winnerMan ? ` (${short(scooper)} ground ball)` : ''}`
      : `${shortTeam(winner.team.name)} wins the faceoff`,
    isKeyPlay: false,
  });
  void loser;
  return winner;
}

function faceoffMan(side: Side, random: RandomSource): LacrossePlayer | null {
  const [starter, backup] = side.lineup.faceoff;
  if (!starter) return null;
  if (backup && (random() < 0.12 || freshness(side, starter) < 0.9)) return backup;
  return starter;
}

function faceoffSkill(side: Side, player: LacrossePlayer): number {
  const raw =
    (player.sportTraits.faceoffs ?? player.sportTraits.groundBalls * 0.7) * 0.6 +
    player.sportTraits.groundBalls * 0.2 +
    player.ratings.strength * 0.1 +
    player.ratings.athleticism * 0.1;
  return raw * freshness(side, player);
}

// ── probabilities ───────────────────────────────────────────────────────────

function turnoverChance(
  offense: Side,
  defense: Side,
  attackers: LacrossePlayer[],
  defenders: LacrossePlayer[],
  manUp: boolean,
  fastBreak: boolean,
  situation: Situation,
): number {
  const handling = average(attackers.map((p) => (p.sportTraits.stickSkills * 0.5 + p.ratings.iq * 0.3 + p.sportTraits.passing * 0.2) * freshness(offense, p)));
  const takeaway = defenders.length > 0 ? average(defenders.map((p) => (p.sportTraits.defense * 0.45 + p.sportTraits.checking * 0.35 + p.ratings.athleticism * 0.2) * freshness(defense, p))) : 35;
  let chance = 0.19 * offense.effects.turnoverRate * defense.effects.forceTurnovers * (1 + (takeaway - handling) * SENSITIVITY.turnover);
  if (manUp) chance *= 0.75;
  if (fastBreak) chance *= 0.8;
  if (situation === 'protecting') chance *= 0.9;
  if (situation === 'chasing') chance *= 1.08;
  return clamp(chance, 0.04, 0.45);
}

function onGoalChance(shooter: LacrossePlayer, offense: Side, fastBreak: boolean, manUp: boolean): number {
  let chance = 0.6 + (shooter.sportTraits.shooting * freshness(offense, shooter) - 62) * SENSITIVITY.onGoal;
  if (fastBreak) chance += 0.1;
  if (manUp) chance += 0.05;
  return clamp(chance, 0.35, 0.88);
}

function finishChance(
  shooter: LacrossePlayer,
  defender: LacrossePlayer | null,
  goalie: LacrossePlayer | null,
  offense: Side,
  defense: Side,
  manUp: boolean,
  fastBreak: boolean,
  finishEdge: number,
): number {
  const attack = (shooter.sportTraits.shooting * 0.55 + shooter.sportTraits.dodging * 0.25 + shooter.sportTraits.offBallMovement * 0.2) * freshness(offense, shooter);
  const cover = defender ? (defender.sportTraits.defense * 0.6 + defender.sportTraits.checking * 0.15 + defender.ratings.athleticism * 0.25) * freshness(defense, defender) : 35;
  const keeper = goalie
    ? (goalie.sportTraits.goalieReflexes ?? goalie.ratings.overall) * 0.5 +
      (goalie.sportTraits.goaliePositioning ?? goalie.ratings.iq) * 0.35 +
      goalie.ratings.overall * 0.15
    : 25;
  let chance = 0.45 + (attack - cover * 0.45 - keeper * 0.55) * SENSITIVITY.finish;
  chance += offense.effects.shotQuality + defense.effects.shotQualityAllowed + finishEdge;
  if (manUp) chance += 0.1;
  if (fastBreak) chance += 0.14;
  return clamp(chance, 0.12, 0.8);
}

function assistChance(feeders: LacrossePlayer[]): number {
  const passing = average(feeders.map((p) => p.sportTraits.passing));
  return clamp(0.56 + (passing - 60) / 300, 0.35, 0.78);
}

function penaltyChance(defense: Side, defenders: LacrossePlayer[]): number {
  const discipline = average(defenders.map((p) => p.ratings.discipline));
  return clamp(0.068 * defense.effects.penaltyRate * (1 + (55 - discipline) / 80), 0.015, 0.2);
}

function rollPenaltySeconds(random: RandomSource): number {
  const roll = random();
  return roll < 0.62 ? 30 : roll < 0.9 ? 60 : roll < 0.97 ? 120 : 180;
}

const PENALTY_NAMES: Record<number, string[]> = {
  30: ['pushing', 'holding', 'offsides', 'warding', 'illegal screen'],
  60: ['slashing', 'cross-check', 'illegal body check', 'tripping'],
  120: ['unnecessary roughness', 'slashing'],
  180: ['unsportsmanlike conduct'],
};

function flag(defense: Side, offender: LacrossePlayer, seconds: number, clock: Clock, offset: number, push: Push, offense: Side, random: RandomSource): void {
  const l = line(defense, offender);
  l.penalties += 1;
  l.penaltyMinutes = Math.round((l.penaltyMinutes + seconds / 60) * 10) / 10;
  defense.box.push({ playerId: offender.id, remaining: seconds, releasable: seconds < 180 });
  const names = PENALTY_NAMES[seconds] ?? PENALTY_NAMES[60]!;
  const name = names[Math.floor(random() * names.length)] ?? names[0]!;
  const at = { ...clock, elapsed: Math.min(clock.periodLength, clock.elapsed + offset) };
  push(at, {
    type: 'penalty',
    teamId: defense.team.id,
    playerId: offender.id,
    description: `Penalty: ${short(offender)}, ${name} (${formatSeconds(seconds)}) — ${shortTeam(offense.team.name)} man-up`,
    isKeyPlay: false,
  });
}

function releasePenalties(scoredOn: Side): void {
  const idx = scoredOn.box.findIndex((p) => p.releasable);
  if (idx >= 0) scoredOn.box.splice(idx, 1);
}

function tickPenalties(side: Side, seconds: number): void {
  for (const p of side.box) p.remaining -= seconds;
  side.box = side.box.filter((p) => p.remaining > 0);
}

type Situation = 'normal' | 'chasing' | 'protecting';

/** Late in a close game the trailing side pushes and the leading side kills clock. */
function lateGameSituation(offense: Side, defense: Side, clock: Clock): Situation {
  if (clock.period !== 4 || clock.elapsed < PERIOD_SECONDS - 240) return 'normal';
  const lead = offense.score - defense.score;
  if (lead <= -2) return 'chasing';
  if (lead >= 2) return 'protecting';
  return 'normal';
}

// ── units, fatigue and attribution ──────────────────────────────────────────

function makeSide(team: LacrosseTeam, isHome: boolean, planInput: Partial<LacrosseGamePlan> | undefined, coaching: CoachingEdge): Side {
  const plan = normalizeGamePlan(planInput);
  const lineup = buildLacrosseLineup(team);
  return {
    team,
    isHome,
    plan,
    effects: getTacticEffects(plan),
    coaching,
    lineup,
    lineShares: midfieldLineShares(lineup.midfieldLines.length, plan.rotation),
    lines: new Map(),
    seconds: new Map(),
    byId: new Map(team.roster.map((p) => [p.id, p])),
    clears: 0,
    clearAttempts: 0,
    possessions: 0,
    extraMan: { goals: 0, chances: 0 },
    box: [],
    score: 0,
    midLine: 0,
  };
}

function switchPlan(side: Side, planInput: Partial<LacrosseGamePlan>): void {
  const plan = normalizeGamePlan(planInput);
  side.plan = plan;
  side.effects = getTacticEffects(plan);
  side.lineShares = midfieldLineShares(side.lineup.midfieldLines.length, plan.rotation);
}

function rollLine(side: Side, random: RandomSource): LacrossePlayer[] {
  if (side.lineup.midfieldLines.length === 0) return [];
  let roll = random();
  for (let i = 0; i < side.lineShares.length; i += 1) {
    roll -= side.lineShares[i]!;
    if (roll < 0) {
      side.midLine = i;
      return side.lineup.midfieldLines[i] ?? [];
    }
  }
  side.midLine = 0;
  return side.lineup.midfieldLines[0] ?? [];
}

function onFieldOffense(side: Side, random: RandomSource): LacrossePlayer[] {
  return unique([...side.lineup.attack, ...rollLine(side, random)]);
}

function onFieldDefense(side: Side, random: RandomSource): LacrossePlayer[] {
  const mids = rollLine(side, random);
  // The two mids best at defense stay on; the third runs off for the long pole.
  const defensiveMids = [...mids].sort((a, b) => b.sportTraits.defense - a.sportTraits.defense).slice(0, 2);
  return unique([...side.lineup.closeDefense, ...(side.lineup.longStickMid ? [side.lineup.longStickMid] : []), ...defensiveMids]);
}

function chargeTime(offense: Side, defense: Side, attackers: LacrossePlayer[], defenders: LacrossePlayer[], seconds: number, fastBreak: boolean): void {
  void fastBreak;
  for (const p of attackers) addSeconds(offense, p, seconds);
  for (const p of defenders) addSeconds(defense, p, seconds);
  if (defense.lineup.goalie) addSeconds(defense, defense.lineup.goalie, seconds);
  tickPenalties(offense, seconds);
  tickPenalties(defense, seconds);
}

function addSeconds(side: Side, player: LacrossePlayer, seconds: number): void {
  side.seconds.set(player.id, (side.seconds.get(player.id) ?? 0) + seconds);
  line(side, player);
}

/**
 * How much a player has left: everyone is fresh until they pass the minutes
 * their stamina supports, then they fade a little more each minute over it.
 */
function freshness(side: Side, player: LacrossePlayer): number {
  const played = (side.seconds.get(player.id) ?? 0) / 60;
  const capacity = 18 + player.ratings.stamina * 0.38;
  const over = Math.max(0, played - capacity);
  return Math.max(0.72, 1 - over * 0.014);
}

function line(side: Side, player: LacrossePlayer): LacrossePlayerGameStats {
  let l = side.lines.get(player.id);
  if (!l) {
    l = {
      playerId: player.id,
      teamId: side.team.id,
      goals: 0,
      assists: 0,
      shots: 0,
      shotsOnGoal: 0,
      groundBalls: 0,
      turnovers: 0,
      causedTurnovers: 0,
      penalties: 0,
      penaltyMinutes: 0,
      ...(player.position === 'GK' ? { saves: 0, goalsAllowed: 0 } : {}),
      ...(player.position === 'FOGO' ? { faceoffWins: 0, faceoffAttempts: 0 } : {}),
    };
    side.lines.set(player.id, l);
  }
  return l;
}

/**
 * Who takes the shot. Talent draws looks, but gently: a star attackman ends up
 * with about a quarter of his team's shots, not half, because real offenses
 * move the ball and defenses slide to the hot hand.
 */
function pickShooter(attackers: LacrossePlayer[], random: RandomSource): LacrossePlayer {
  return weightedPick(
    attackers,
    (p) =>
      (p.position === 'ATT' ? 1 : p.position === 'MID' ? 0.85 : 0.45) *
      Math.max(0.2, (p.sportTraits.shooting * 0.5 + p.sportTraits.dodging * 0.3 + p.ratings.overall * 0.2 - 38) / 30),
    random,
  )!;
}

function pickHandler(attackers: LacrossePlayer[], random: RandomSource): LacrossePlayer {
  return weightedPick(attackers, (p) => (p.position === 'ATT' ? 1.2 : 1) * (1.3 - p.sportTraits.stickSkills / 100), random)!;
}

function takeawayWeight(p: LacrossePlayer): number {
  return talentCurve(p.sportTraits.defense * 0.5 + p.sportTraits.checking * 0.3 + p.ratings.athleticism * 0.2) * (p.position === 'MID' ? 0.5 : 1);
}

function buildTeamStats(side: Side): LacrosseTeamStats {
  const lines = [...side.lines.values()];
  const sum = (key: keyof LacrossePlayerGameStats) => lines.reduce((s, l) => s + ((l[key] as number | undefined) ?? 0), 0);
  const goals = sum('goals');
  const faceoffAttempts = sum('faceoffAttempts');
  return {
    goals,
    shots: sum('shots'),
    shotsOnGoal: sum('shotsOnGoal'),
    assists: sum('assists'),
    turnovers: sum('turnovers'),
    causedTurnovers: sum('causedTurnovers'),
    groundBalls: sum('groundBalls'),
    faceoffWins: sum('faceoffWins'),
    faceoffAttempts,
    saves: sum('saves'),
    clears: side.clears,
    clearAttempts: side.clearAttempts,
    penalties: sum('penalties'),
    penaltyMinutes: Math.round(sum('penaltyMinutes') * 10) / 10,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Convex rating curve: an 85 produces ~2.5x what a 65 does, a 50 very little. */
function talentCurve(rating: number): number {
  return Math.max(0.03, (rating - 42) / 25) ** 1.8;
}

function weightedPick<T>(items: T[], weight: (item: T) => number, random: RandomSource): T | null {
  if (items.length === 0) return null;
  const weights = items.map((item) => Math.max(0, weight(item)));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return items[Math.floor(random() * items.length)] ?? null;
  let roll = random() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i]!;
    if (roll < 0) return items[i]!;
  }
  return items[items.length - 1] ?? null;
}

function unique(players: LacrossePlayer[]): LacrossePlayer[] {
  const seen = new Set<string>();
  return players.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function short(player: LacrossePlayer): string {
  return `${player.name.first[0]}. ${player.name.last}`;
}

function shortTeam(name: string): string {
  return name.split(' ').slice(-1)[0] ?? name;
}

function formatSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
