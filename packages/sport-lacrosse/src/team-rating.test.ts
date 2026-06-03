import { describe, expect, it } from 'vitest';
import type { LacrossePlayer, LacrosseTeam } from './models';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';
import { calculateLacrosseTeamRating } from './team-rating';

describe('calculateLacrosseTeamRating', () => {
  it('returns a rounded lacrosse-specific rating breakdown', () => {
    const team = makeLacrosseTeam('balanced');

    const rating = calculateLacrosseTeamRating(team);

    expect(rating).toEqual({
      overall: expect.any(Number),
      offense: expect.any(Number),
      defense: expect.any(Number),
      goalie: expect.any(Number),
      faceoff: expect.any(Number),
      depth: expect.any(Number),
    });
    expect(rating.overall).toBeGreaterThanOrEqual(1);
    expect(rating.overall).toBeLessThanOrEqual(99);
  });

  it('rewards strong position groups in the matching rating categories', () => {
    const baseline = makeLacrosseTeam('baseline');
    const loaded = makeLacrosseTeam('loaded', [
      ...makePlayers('ATT', 3, 90),
      ...makePlayers('MID', 6, 88),
      ...makePlayers('DEF', 3, 84),
      ...makePlayers('LSM', 1, 84),
      ...makePlayers('GK', 1, 92),
      ...makePlayers('FOGO', 1, 91),
      ...makePlayers('MID', 10, 76, 100),
    ]);

    const baselineRating = calculateLacrosseTeamRating(baseline);
    const loadedRating = calculateLacrosseTeamRating(loaded);

    expect(loadedRating.overall).toBeGreaterThan(baselineRating.overall);
    expect(loadedRating.offense).toBeGreaterThan(baselineRating.offense);
    expect(loadedRating.defense).toBeGreaterThan(baselineRating.defense);
    expect(loadedRating.goalie).toBeGreaterThan(baselineRating.goalie);
    expect(loadedRating.faceoff).toBeGreaterThan(baselineRating.faceoff);
  });

  it('penalizes missing specialist groups', () => {
    const noGoalieOrFogo = makeLacrosseTeam('thin', [
      ...makePlayers('ATT', 3, 65),
      ...makePlayers('MID', 8, 65),
      ...makePlayers('DEF', 4, 65),
    ]);

    const rating = calculateLacrosseTeamRating(noGoalieOrFogo);

    expect(rating.goalie).toBe(35);
    expect(rating.faceoff).toBe(35);
  });

  it('uses manual depth chart starters when calculating position strength', () => {
    const strongAttack = makeRatedPlayer(1, 'ATT', 95);
    const weakAttack = makeRatedPlayer(2, 'ATT', 35);
    const team: LacrosseTeam = makeLacrosseTeam('manual-depth', [
      strongAttack,
      weakAttack,
      ...makePlayers('ATT', 2, 85, 10),
      ...makePlayers('MID', 6, 75, 20),
      ...makePlayers('DEF', 3, 75, 40),
      ...makePlayers('LSM', 1, 75, 50),
      ...makePlayers('GK', 1, 75, 60),
      ...makePlayers('FOGO', 1, 75, 70),
    ]);

    const defaultRating = calculateLacrosseTeamRating(team);
    const benchedStarRating = calculateLacrosseTeamRating({
      ...team,
      depthChart: {
        ATT: [
          weakAttack.id,
          ...team.roster.filter((p) => p.position === 'ATT' && p.id !== weakAttack.id).map((p) => p.id),
        ],
      },
    });

    expect(benchedStarRating.offense).toBeLessThan(defaultRating.offense);
  });
});

function makePlayers(
  position: LacrossePlayer['position'],
  count: number,
  rating: number,
  startIndex = 0,
): LacrossePlayer[] {
  return Array.from({ length: count }, (_, index) => makeRatedPlayer(startIndex + index, position, rating));
}

function makeRatedPlayer(index: number, position: LacrossePlayer['position'], rating: number): LacrossePlayer {
  const player = makeLacrossePlayer(index, position, 25);

  return {
    ...player,
    ratings: {
      overall: rating,
      potential: rating,
      athleticism: rating,
      speed: rating,
      strength: rating,
      stamina: rating,
      skill: rating,
      iq: rating,
      discipline: rating,
      workEthic: rating,
      leadership: rating,
    },
    sportTraits: {
      ...player.sportTraits,
      shooting: rating,
      passing: rating,
      dodging: rating,
      stickSkills: rating,
      offBallMovement: rating,
      defense: rating,
      checking: rating,
      groundBalls: rating,
      ...(position === 'FOGO' ? { faceoffs: rating } : {}),
      ...(position === 'GK'
        ? {
            goalieReflexes: rating,
            goaliePositioning: rating,
            goalieClearing: rating,
          }
        : {}),
    },
  };
}
