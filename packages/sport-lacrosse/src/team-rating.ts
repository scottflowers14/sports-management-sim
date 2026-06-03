import type { LacrossePlayer, LacrossePosition, LacrosseTeam } from './models';

export interface LacrosseTeamRating {
  overall: number;
  offense: number;
  defense: number;
  goalie: number;
  faceoff: number;
  depth: number;
}

const STARTER_COUNTS: Record<LacrossePosition, number> = {
  ATT: 3,
  MID: 6,
  DEF: 3,
  GK: 1,
  FOGO: 1,
  LSM: 1,
};

export function calculateLacrosseTeamRating(team: LacrosseTeam): LacrosseTeamRating {
  const attack = ratePositionGroup(team.roster, 'ATT', STARTER_COUNTS.ATT, offensivePlayerRating);
  const midfield = ratePositionGroup(team.roster, 'MID', STARTER_COUNTS.MID, midfieldPlayerRating);
  const defensemen = ratePositionGroup(team.roster, 'DEF', STARTER_COUNTS.DEF, defensivePlayerRating);
  const lsms = ratePositionGroup(team.roster, 'LSM', STARTER_COUNTS.LSM, defensivePlayerRating);
  const goalies = ratePositionGroup(team.roster, 'GK', STARTER_COUNTS.GK, goaliePlayerRating);
  const fogos = ratePositionGroup(team.roster, 'FOGO', STARTER_COUNTS.FOGO, faceoffPlayerRating);
  const depth = calculateDepthRating(team.roster);

  const offense = weightedAverage([
    [attack, 0.42],
    [midfield, 0.46],
    [depth, 0.12],
  ]);
  const defense = weightedAverage([
    [defensemen, 0.48],
    [lsms, 0.18],
    [midfield, 0.18],
    [goalies, 0.16],
  ]);
  const overall = weightedAverage([
    [offense, 0.36],
    [defense, 0.32],
    [goalies, 0.14],
    [fogos, 0.08],
    [depth, 0.1],
  ]);

  return {
    overall: Math.round(overall),
    offense: Math.round(offense),
    defense: Math.round(defense),
    goalie: Math.round(goalies),
    faceoff: Math.round(fogos),
    depth: Math.round(depth),
  };
}

function ratePositionGroup(
  roster: LacrossePlayer[],
  position: LacrossePosition,
  starterCount: number,
  ratingFn: (player: LacrossePlayer) => number,
): number {
  const players = roster
    .filter((player) => player.position === position)
    .map(ratingFn)
    .sort((a, b) => b - a);

  if (players.length === 0) {
    return 35;
  }

  const starterRatings = players.slice(0, starterCount);
  const reserveRatings = players.slice(starterCount, starterCount * 2);
  const starterRating = average(starterRatings);
  const reserveRating = reserveRatings.length > 0 ? average(reserveRatings) : starterRating - 8;
  const depthPenalty = Math.max(0, starterCount - players.length) * 5;

  return clamp(starterRating * 0.82 + reserveRating * 0.18 - depthPenalty, 1, 99);
}

function calculateDepthRating(roster: LacrossePlayer[]): number {
  if (roster.length === 0) {
    return 35;
  }

  const positionScores = Object.entries(STARTER_COUNTS).map(([position, starterCount]) =>
    ratePositionGroup(roster, position as LacrossePosition, starterCount * 2, (player) => player.ratings.overall),
  );

  return average(positionScores);
}

function offensivePlayerRating(player: LacrossePlayer): number {
  return weightedAverage([
    [player.ratings.overall, 0.32],
    [player.sportTraits.shooting, 0.22],
    [player.sportTraits.dodging, 0.18],
    [player.sportTraits.passing, 0.14],
    [player.sportTraits.offBallMovement, 0.08],
    [player.ratings.speed, 0.06],
  ]);
}

function midfieldPlayerRating(player: LacrossePlayer): number {
  return weightedAverage([
    [player.ratings.overall, 0.28],
    [player.sportTraits.dodging, 0.18],
    [player.sportTraits.passing, 0.16],
    [player.sportTraits.shooting, 0.14],
    [player.sportTraits.groundBalls, 0.1],
    [player.sportTraits.defense, 0.08],
    [player.ratings.stamina, 0.06],
  ]);
}

function defensivePlayerRating(player: LacrossePlayer): number {
  return weightedAverage([
    [player.ratings.overall, 0.3],
    [player.sportTraits.defense, 0.24],
    [player.sportTraits.checking, 0.18],
    [player.sportTraits.groundBalls, 0.12],
    [player.ratings.strength, 0.08],
    [player.ratings.iq, 0.08],
  ]);
}

function goaliePlayerRating(player: LacrossePlayer): number {
  return weightedAverage([
    [player.ratings.overall, 0.28],
    [player.sportTraits.goalieReflexes ?? player.ratings.overall, 0.3],
    [player.sportTraits.goaliePositioning ?? player.ratings.iq, 0.24],
    [player.sportTraits.goalieClearing ?? player.sportTraits.passing, 0.1],
    [player.ratings.discipline, 0.08],
  ]);
}

function faceoffPlayerRating(player: LacrossePlayer): number {
  return weightedAverage([
    [player.ratings.overall, 0.24],
    [player.sportTraits.faceoffs ?? player.sportTraits.groundBalls, 0.42],
    [player.sportTraits.groundBalls, 0.16],
    [player.ratings.strength, 0.1],
    [player.ratings.athleticism, 0.08],
  ]);
}

function weightedAverage(entries: Array<[number, number]>): number {
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return entries.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
