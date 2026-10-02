import { getLacrosseOrderedPlayers } from './depth-chart';
import type { LacrossePlayer, LacrossePlayerGameStats, LacrosseTeam, LacrosseTeamStats } from './models';
import type { RandomSource } from './simulate-game';

/** One goal and (optionally) the player who assisted it. */
export interface LacrosseScoringPlay {
  playerId: string;
  assistPlayerId?: string;
}

export interface LacrosseTeamPlayerStats {
  players: LacrossePlayerGameStats[];
  scoringPlays: LacrosseScoringPlay[];
}

/**
 * Share of the offense each depth-chart slot gets. Attackmen and the first
 * midfield line play most of the offensive possessions; the second line rotates
 * in; deeper reserves only see garbage time. Slots past the end of a list do
 * not play at all, so they get no stats and no game played.
 */
const OFFENSIVE_USAGE: Partial<Record<LacrossePlayer['position'], number[]>> = {
  ATT: [1, 0.95, 0.85, 0.18, 0.08],
  MID: [0.8, 0.74, 0.68, 0.4, 0.36, 0.3, 0.08, 0.05],
  LSM: [0.06],
  FOGO: [0.05],
};

/** How many players at each position see the field in a typical game. */
const PLAYING_DEPTH: Record<LacrossePlayer['position'], number> = {
  ATT: 5,
  MID: 8,
  DEF: 4,
  LSM: 2,
  GK: 1,
  FOGO: 2,
};

interface Participant {
  player: LacrossePlayer;
  /** Fraction of the game this player is on the field (0–1). */
  minutes: number;
  /** Share of the offensive touches when on the field. */
  offenseUsage: number;
  line: LacrossePlayerGameStats;
}

/**
 * Turn a team's box-score totals into individual stat lines that follow the
 * depth chart: starters play the most, talent concentrates production in the
 * best players, and a per-game "hot hand" factor lets anyone have a big day.
 *
 * Every team total is preserved exactly (player goals sum to team goals, the
 * starting goalie owns every save, and so on).
 */
export function generateLacrossePlayerStats(
  team: LacrosseTeam,
  teamStats: LacrosseTeamStats,
  opponentGoals: number,
  random: RandomSource,
): LacrosseTeamPlayerStats {
  const participants: Participant[] = [];
  for (const position of Object.keys(PLAYING_DEPTH) as Array<LacrossePlayer['position']>) {
    const ordered = getLacrosseOrderedPlayers(team, position).slice(0, PLAYING_DEPTH[position]);
    ordered.forEach((player, slot) => {
      participants.push({
        player,
        minutes: minutesFor(position, slot),
        offenseUsage: OFFENSIVE_USAGE[position]?.[slot] ?? 0,
        line: blankLine(player.id, team.id),
      });
    });
  }
  if (participants.length === 0) return { players: [], scoringPlays: [] };

  const scorers = participants.filter((p) => p.offenseUsage > 0);
  const hotHand = new Map(scorers.map((p) => [p.player.id, Math.exp((random() - 0.5) * 1.1)]));

  const goalWeight = (p: Participant) =>
    p.offenseUsage * talentCurve(p.player.ratings.skill * 0.55 + p.player.ratings.speed * 0.2 + p.player.ratings.overall * 0.25) * hotHand.get(p.player.id)!;
  // Attackmen quarterback the offense from behind the cage, so they feed more goals.
  const assistWeight = (p: Participant) =>
    p.offenseUsage *
    (p.player.position === 'ATT' ? 1.35 : 1) *
    talentCurve(p.player.ratings.iq * 0.5 + p.player.ratings.skill * 0.3 + p.player.ratings.overall * 0.2) *
    hotHand.get(p.player.id)!;

  // Goals, each with at most one assist from a different teammate.
  const scoringPlays: LacrosseScoringPlay[] = [];
  const goalWeights = scorers.map(goalWeight);
  const assistWeights = scorers.map(assistWeight);
  // Pick exactly `assists` of the goals to be assisted.
  const assistedGoals = new Set(
    shuffle(
      Array.from({ length: teamStats.goals }, (_, i) => i),
      random,
    ).slice(0, Math.min(teamStats.assists, teamStats.goals)),
  );
  for (let g = 0; g < teamStats.goals && scorers.length > 0; g += 1) {
    const scorer = scorers[weightedIndex(goalWeights, random)]!;
    scorer.line.goals += 1;
    const play: LacrosseScoringPlay = { playerId: scorer.player.id };
    if (assistedGoals.has(g) && scorers.length > 1) {
      const weights = assistWeights.map((w, i) => (scorers[i] === scorer ? 0 : w));
      const assister = scorers[weightedIndex(weights, random)]!;
      assister.line.assists += 1;
      play.assistPlayerId = assister.player.id;
    }
    scoringPlays.push(play);
  }

  // Shots follow scoring usage; nobody scores more goals than they shot.
  const shotWeights = scorers.map((p) => p.offenseUsage * hotHand.get(p.player.id)! * talentCurve(p.player.ratings.skill));
  spread(teamStats.shots - teamStats.goals, shotWeights, random).forEach((n, i) => {
    const line = scorers[i]!.line;
    line.shots = line.goals + n;
  });
  spread(teamStats.shotsOnGoal - teamStats.goals, scorers.map((p) => p.line.shots - p.line.goals + 0.01), random).forEach((n, i) => {
    const line = scorers[i]!.line;
    line.shotsOnGoal = Math.min(line.shots, line.goals + n);
  });

  // Goalie: the starter owns every save and goal allowed.
  const goalie = participants.find((p) => p.player.position === 'GK');
  if (goalie) {
    goalie.line.saves = teamStats.saves;
    goalie.line.goalsAllowed = opponentGoals;
  }

  // Faceoffs: the top FOGO takes ~85% of draws, the backup the rest.
  const fogos = participants.filter((p) => p.player.position === 'FOGO');
  if (fogos.length > 0) {
    const starterShare = fogos.length > 1 ? 0.85 : 1;
    const starterAttempts = Math.round(teamStats.faceoffAttempts * starterShare);
    const winRate = teamStats.faceoffAttempts > 0 ? teamStats.faceoffWins / teamStats.faceoffAttempts : 0;
    const starterWins = Math.min(teamStats.faceoffWins, Math.round(starterAttempts * winRate));
    fogos[0]!.line.faceoffAttempts = starterAttempts;
    fogos[0]!.line.faceoffWins = starterWins;
    if (fogos[1]) {
      fogos[1].line.faceoffAttempts = teamStats.faceoffAttempts - starterAttempts;
      fogos[1].line.faceoffWins = teamStats.faceoffWins - starterWins;
    }
  }

  // Caused turnovers go to the cover defenders, weighted by defensive skill.
  const defenders = participants.filter((p) => ['DEF', 'LSM', 'MID'].includes(p.player.position));
  const ctWeights = defenders.map(
    (p) =>
      p.minutes *
      (p.player.position === 'MID' ? 0.15 : 1) *
      talentCurve(p.player.sportTraits.defense * 0.5 + p.player.sportTraits.checking * 0.3 + p.player.ratings.athleticism * 0.2),
  );
  spread(teamStats.causedTurnovers, ctWeights, random).forEach((n, i) => {
    defenders[i]!.line.causedTurnovers = n;
  });

  // Ground balls: everyone scraps for them, LSMs and FOGOs most of all.
  const gbWeights = participants.map(
    (p) =>
      p.minutes *
      (p.player.position === 'FOGO' ? 2.2 : p.player.position === 'LSM' ? 1.25 : p.player.position === 'GK' ? 0.3 : 1) *
      talentCurve(p.player.sportTraits.groundBalls),
  );
  spread(teamStats.groundBalls, gbWeights, random).forEach((n, i) => {
    participants[i]!.line.groundBalls = n;
  });

  // Turnovers fall on whoever handles the ball most.
  const toWeights = participants.map((p) => (p.player.position === 'GK' ? 0.15 : p.minutes * (0.3 + p.offenseUsage)));
  spread(teamStats.turnovers, toWeights, random).forEach((n, i) => {
    participants[i]!.line.turnovers = n;
  });

  // Penalties land mostly on defenders.
  const penaltyWeights = participants.map((p) =>
    p.player.position === 'GK' ? 0.05 : p.minutes * (p.player.position === 'DEF' || p.player.position === 'LSM' ? 1.6 : 1),
  );
  const penaltyCounts = spread(teamStats.penalties, penaltyWeights, random);
  let minutesLeft = teamStats.penaltyMinutes;
  penaltyCounts.forEach((n, i) => {
    const line = participants[i]!.line;
    line.penalties = n;
    const share = teamStats.penalties > 0 ? Math.round((teamStats.penaltyMinutes * n) / teamStats.penalties) : 0;
    line.penaltyMinutes = Math.min(minutesLeft, share);
    minutesLeft -= line.penaltyMinutes;
  });

  return { players: participants.map((p) => p.line), scoringPlays };
}

function minutesFor(position: LacrossePlayer['position'], slot: number): number {
  switch (position) {
    case 'ATT':
      return [1, 1, 0.95, 0.2, 0.1][slot] ?? 0;
    case 'MID':
      return [0.6, 0.6, 0.6, 0.35, 0.35, 0.35, 0.1, 0.1][slot] ?? 0;
    case 'DEF':
      return [1, 1, 1, 0.15][slot] ?? 0;
    case 'LSM':
      return [0.85, 0.15][slot] ?? 0;
    case 'FOGO':
      return [0.3, 0.06][slot] ?? 0;
    case 'GK':
      return slot === 0 ? 1 : 0;
  }
}

/** Convex rating curve: an 85 produces ~2.5x what a 65 does, a 50 very little. */
function talentCurve(rating: number): number {
  return Math.max(0.03, (rating - 42) / 25) ** 1.8;
}

function weightedIndex(weights: number[], random: RandomSource): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return Math.floor(random() * weights.length);
  let roll = random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= Math.max(0, weights[i]!);
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Hand out `total` units one at a time by weighted draw. */
function spread(total: number, weights: number[], random: RandomSource): number[] {
  const out = new Array<number>(weights.length).fill(0);
  if (weights.length === 0) return out;
  for (let k = 0; k < Math.max(0, total); k += 1) {
    const i = weightedIndex(weights, random);
    out[i] = out[i]! + 1;
  }
  return out;
}

function blankLine(playerId: string, teamId: string): LacrossePlayerGameStats {
  return {
    playerId,
    teamId,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnGoal: 0,
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    goalsAllowed: 0,
    penalties: 0,
    penaltyMinutes: 0,
  };
}
