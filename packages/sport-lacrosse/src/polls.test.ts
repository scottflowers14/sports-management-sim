import { describe, expect, it } from 'vitest';
import { lacrossePollScore } from './polls';
import { generateLacrosseRoster } from './roster-generation';
import { makeLacrosseTeam } from './test-fixtures';
import type { LacrosseTeam } from './models';

function team(id: string, prestige: number, wins = 0, losses = 0): LacrosseTeam {
  const base = makeLacrosseTeam(id, generateLacrosseRoster({ seed: prestige, prestige, createdSeason: 2028 }));
  return {
    ...base,
    reputation: { ...base.reputation, nationalPrestige: prestige },
    record: { ...base.record, wins, losses },
  };
}

describe('national poll', () => {
  it('ranks a preseason field by roster strength and name', () => {
    expect(lacrossePollScore(team('power', 88))).toBeGreaterThan(lacrossePollScore(team('mid', 60)));
    expect(lacrossePollScore(team('mid', 60))).toBeGreaterThan(lacrossePollScore(team('small', 42)));
  });

  it('lets the record take over as games are played', () => {
    const upstart = team('upstart', 45, 10, 0);
    const fallen = team('fallen', 88, 3, 7);
    expect(lacrossePollScore(team('upstart', 45))).toBeLessThan(lacrossePollScore(team('fallen', 88)));
    expect(lacrossePollScore(upstart)).toBeGreaterThan(lacrossePollScore(fallen));
  });

  it('still separates teams with the same record by strength', () => {
    expect(lacrossePollScore(team('strong', 85, 8, 2))).toBeGreaterThan(lacrossePollScore(team('weak', 45, 8, 2)));
  });

  it('lets one early loss nudge a contender rather than sink it', () => {
    const contender = lacrossePollScore(team('power', 88));
    const afterLoss = lacrossePollScore(team('power', 88, 0, 1));
    const midAfterWin = lacrossePollScore(team('mid', 60, 1, 0));
    expect(contender - afterLoss).toBeLessThan(6);
    // A good mid-major win doesn't vault it past the contender after one week.
    expect(afterLoss).toBeGreaterThan(midAfterWin);
  });

  it('stays on a 0 to 100 scale', () => {
    for (const t of [team('a', 99, 16, 0), team('b', 40, 0, 16)]) {
      expect(lacrossePollScore(t)).toBeGreaterThanOrEqual(0);
      expect(lacrossePollScore(t)).toBeLessThanOrEqual(100);
    }
  });
});
