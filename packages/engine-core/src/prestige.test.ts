import { describe, expect, it } from 'vitest';
import type { StandingsEntry } from './models';
import { evolveProgramPrestige, PRESTIGE_CENTER } from './prestige';
import { makeTeam } from './test-fixtures';

function teamWith(id: string, nationalPrestige: number, recentSuccess = 60) {
  const base = makeTeam();
  return { ...base, id, reputation: { ...base.reputation, nationalPrestige, recentSuccess } };
}

function standing(teamId: string, wins: number, losses: number): StandingsEntry {
  return { teamId, conferenceId: 'c', record: { ...makeTeam().record, wins, losses } } as StandingsEntry;
}

describe('program prestige', () => {
  it('rewards winning and the national title', () => {
    const [champ, winner, loser] = evolveProgramPrestige(
      [teamWith('a', PRESTIGE_CENTER), teamWith('b', PRESTIGE_CENTER), teamWith('c', PRESTIGE_CENTER)],
      [standing('a', 14, 2), standing('b', 13, 3), standing('c', 3, 12)],
      'a',
    );
    expect(champ!.reputation.nationalPrestige).toBe(PRESTIGE_CENTER + 5);
    expect(winner!.reputation.nationalPrestige).toBe(PRESTIGE_CENTER + 2);
    expect(loser!.reputation.nationalPrestige).toBe(PRESTIGE_CENTER - 1);
    expect(champ!.reputation.recentSuccess).toBeGreaterThan(70);
  });

  it('pulls an average-season program back toward the middle', () => {
    const [blueBlood, bottom] = evolveProgramPrestige(
      [teamWith('a', 92), teamWith('b', 42)],
      [standing('a', 8, 8), standing('b', 8, 8)],
    );
    expect(blueBlood!.reputation.nationalPrestige).toBe(90);
    expect(bottom!.reputation.nationalPrestige).toBe(43);
  });

  it('keeps a winning blue blood roughly steady instead of compounding', () => {
    let team: ReturnType<typeof makeTeam> = teamWith('a', 88);
    for (let year = 0; year < 10; year += 1) {
      team = evolveProgramPrestige([team], [standing('a', 13, 3)])[0]!;
    }
    expect(team.reputation.nationalPrestige).toBeLessThanOrEqual(92);
    expect(team.reputation.nationalPrestige).toBeGreaterThanOrEqual(85);
  });

  it('stays within 40 to 99', () => {
    const [low, high] = evolveProgramPrestige(
      [teamWith('a', 40), teamWith('b', 99)],
      [standing('a', 0, 16), standing('b', 16, 0)],
      'b',
    );
    expect(low!.reputation.nationalPrestige).toBeGreaterThanOrEqual(40);
    expect(high!.reputation.nationalPrestige).toBeLessThanOrEqual(99);
  });

  it('pulls programs toward the middle at the same speed from either side', () => {
    const [blueBlood, bottom] = evolveProgramPrestige(
      [teamWith('a', PRESTIGE_CENTER + 25), teamWith('b', PRESTIGE_CENTER - 25)],
      [standing('a', 8, 8), standing('b', 8, 8)],
    );
    const fell = PRESTIGE_CENTER + 25 - blueBlood!.reputation.nationalPrestige;
    const rose = bottom!.reputation.nationalPrestige - (PRESTIGE_CENTER - 25);
    expect(fell).toBe(rose);
  });
});
