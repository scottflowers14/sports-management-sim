import { describe, expect, it } from 'vitest';
import { deriveCpuGamePlan, describeGamePlan } from './cpu-game-plan';
import type { LacrossePlayer, LacrossePosition } from './models';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';

function makeRoster(skew: (player: LacrossePlayer) => LacrossePlayer): LacrossePlayer[] {
  const positions: [LacrossePosition, number][] = [
    ['ATT', 6],
    ['MID', 10],
    ['DEF', 8],
    ['LSM', 3],
    ['GK', 3],
    ['FOGO', 2],
  ];
  const roster: LacrossePlayer[] = [];
  let index = 0;
  for (const [position, count] of positions) {
    for (let i = 0; i < count; i += 1) {
      roster.push(skew(makeLacrossePlayer(index++, position, 30)));
    }
  }
  return roster;
}

function boost(player: LacrossePlayer, positions: LacrossePosition[], amount: number): LacrossePlayer {
  if (!positions.includes(player.position)) return player;
  const traits = player.sportTraits;
  return {
    ...player,
    ratings: { ...player.ratings, overall: Math.min(99, player.ratings.overall + amount) },
    sportTraits: {
      ...traits,
      shooting: Math.min(99, traits.shooting + amount),
      passing: Math.min(99, traits.passing + amount),
      dodging: Math.min(99, traits.dodging + amount),
      defense: Math.min(99, traits.defense + amount),
      checking: Math.min(99, traits.checking + amount),
      groundBalls: Math.min(99, traits.groundBalls + amount),
      ...(traits.goalieReflexes !== undefined
        ? {
            goalieReflexes: Math.min(99, traits.goalieReflexes + amount),
            goaliePositioning: Math.min(99, (traits.goaliePositioning ?? 70) + amount),
          }
        : {}),
    },
  };
}

describe('deriveCpuGamePlan', () => {
  it('plays uptempo with an offense-heavy roster', () => {
    const team = makeLacrosseTeam('run-and-gun', makeRoster((p) => boost(p, ['ATT', 'MID'], 25)));
    expect(deriveCpuGamePlan(team).tempo).toBe('uptempo');
  });

  it('plays patient with a defense-first roster', () => {
    const team = makeLacrosseTeam('grinders', makeRoster((p) => boost(p, ['DEF', 'LSM', 'GK'], 25)));
    expect(deriveCpuGamePlan(team).tempo).toBe('patient');
  });

  it('plays pressure defense when the close defense outclasses the goalie', () => {
    const team = makeLacrosseTeam('lockdown', makeRoster((p) => boost(p, ['DEF', 'LSM'], 30)));
    expect(deriveCpuGamePlan(team).defense).toBe('pressure');
  });

  it('plays shell defense behind an elite goalie', () => {
    const team = makeLacrosseTeam('brick-wall', makeRoster((p) => boost(p, ['GK'], 35)));
    expect(deriveCpuGamePlan(team).defense).toBe('shell');
  });

  it('is deterministic for the same roster', () => {
    const team = makeLacrosseTeam('steady', makeRoster((p) => p));
    expect(deriveCpuGamePlan(team)).toEqual(deriveCpuGamePlan(team));
  });
});

describe('describeGamePlan', () => {
  it('formats tempo and defensive style labels', () => {
    expect(describeGamePlan({ tempo: 'uptempo', defense: 'shell' })).toBe('Uptempo · Shell');
    expect(describeGamePlan({ tempo: 'balanced', defense: 'balanced' })).toBe('Balanced · Balanced');
  });
});
