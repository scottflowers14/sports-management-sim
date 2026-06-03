import { describe, expect, it } from 'vitest';
import type { LacrossePlayer } from './models';
import { makeLacrossePlayer, makeLacrosseTeam, repeatingRandom } from './test-fixtures';
import { simulateLacrosseGame } from './simulate-game';

describe('simulateLacrosseGame', () => {
  it('returns a final score, winner, loser, and lacrosse team stats', () => {
    const home = makeLacrosseTeam('home');
    const away = makeLacrosseTeam('away');

    const result = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: repeatingRandom(0.5) });

    expect(Number.isInteger(result.homeScore)).toBe(true);
    expect(Number.isInteger(result.awayScore)).toBe(true);
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect([home.id, away.id]).toContain(result.winnerTeamId);
    expect([home.id, away.id]).toContain(result.loserTeamId);
    expect(result.winnerTeamId).not.toBe(result.loserTeamId);
    expect(result.teamStats?.home.goals).toBe(result.homeScore);
    expect(result.teamStats?.away.goals).toBe(result.awayScore);
  });

  it('produces deterministic results from a deterministic random source', () => {
    const home = makeLacrosseTeam('home');
    const away = makeLacrosseTeam('away');

    const first = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: repeatingRandom(0.25) });
    const second = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: repeatingRandom(0.25) });

    expect(second).toEqual(first);
  });

  it('gives a roster-rating edge to a clearly stronger team', () => {
    const strong = makeLacrosseTeam('strong', makeRatedRoster(90));
    const weak = makeLacrosseTeam('weak', makeRatedRoster(40));

    const result = simulateLacrosseGame({ homeTeam: strong, awayTeam: weak, random: repeatingRandom(0.3) });

    expect(result.winnerTeamId).toBe(strong.id);
    expect(result.homeScore).toBeGreaterThan(result.awayScore);
    expect(result.teamStats?.home.shots).toBeGreaterThan(result.teamStats?.away.shots ?? 0);
    expect(result.teamStats?.home.faceoffWins).toBeGreaterThan(result.teamStats?.away.faceoffWins ?? 0);
  });
});

function makeRatedRoster(rating: number): LacrossePlayer[] {
  return [
    ...makePlayers('ATT', 8, rating, 0),
    ...makePlayers('MID', 16, rating, 100),
    ...makePlayers('DEF', 10, rating, 200),
    ...makePlayers('GK', 4, rating, 300),
    ...makePlayers('FOGO', 3, rating, 400),
    ...makePlayers('LSM', 4, rating, 500),
  ];
}

function makePlayers(
  position: LacrossePlayer['position'],
  count: number,
  rating: number,
  startIndex: number,
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
