import { describe, expect, it } from 'vitest';
import { getLacrosseDepthChart } from './depth-chart';
import { buildLacrosseLineup } from './lineups';
import type { LacrossePlayer, LacrossePosition } from './models';
import { moraleReason, playerRoleStatus, weeklyMoraleChange } from './morale';
import {
  applyCpuRedshirts,
  CPU_REDSHIRT_LIMIT,
  lacrosseRedshirtBlock,
  setLacrosseRedshirt,
  suggestRedshirts,
} from './redshirts';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';

/** A position group rated from the top down, everyone a freshman with room to grow. */
function group(position: LacrossePosition, count: number, start: number): LacrossePlayer[] {
  return Array.from({ length: count }, (_, i) => {
    const p = makeLacrossePlayer(start + i, position);
    return { ...p, morale: 62, ratings: { ...p.ratings, overall: 80 - i * 3, potential: 85 } };
  });
}

function team() {
  return makeLacrosseTeam('durham', [...group('ATT', 8, 0), ...group('GK', 3, 100), ...group('FOGO', 2, 200)]);
}

describe('redshirts', () => {
  it('takes a redshirting player off the depth chart and out of the lineup', () => {
    const t = team();
    const star = t.roster[0]!;
    const redshirted = setLacrosseRedshirt(t, star.id, true, 0);
    expect(redshirted.roster[0]!.redshirtStatus).toBe('redshirting');
    expect(getLacrosseDepthChart(redshirted).ATT).not.toContain(star.id);
    expect(buildLacrosseLineup(redshirted).attack.map((p) => p.id)).not.toContain(star.id);

    const back = setLacrosseRedshirt(redshirted, star.id, false, 0);
    expect(back.roster[0]!.redshirtStatus).toBe('redshirt_available');
    expect(getLacrosseDepthChart(back).ATT[0]).toBe(star.id);
  });

  it('keeps enough players at a position to field it', () => {
    const t = team();
    const [gk1, gk2] = t.roster.filter((p) => p.position === 'GK');
    // Three goalies: one can sit, but the last two have to dress.
    const one = setLacrosseRedshirt(t, gk1!.id, true, 0);
    expect(lacrosseRedshirtBlock(one, gk2!, 0)).toBe('depth');
    expect(setLacrosseRedshirt(one, gk2!.id, true, 0)).toBe(one);
  });

  it('closes the window once a player has played too many games', () => {
    const t = team();
    const player = t.roster[7]!;
    expect(setLacrosseRedshirt(t, player.id, true, 5)).toBe(t);
    expect(setLacrosseRedshirt(t, player.id, true, 4).roster[7]!.redshirtStatus).toBe('redshirting');
  });

  it('suggests buried young players with room to grow', () => {
    const t = team();
    const suggestions = suggestRedshirts(t).map((p) => p.id);
    // Attackmen ranked 7th and 8th are below the rotation (2 x 3 starters).
    expect(suggestions).toEqual(expect.arrayContaining([t.roster[6]!.id, t.roster[7]!.id]));
    expect(suggestions).not.toContain(t.roster[0]!.id);
    // Not a player at his ceiling.
    const capped = { ...t, roster: t.roster.map((p, i) => (i === 7 ? { ...p, ratings: { ...p.ratings, potential: p.ratings.overall } } : p)) };
    expect(suggestRedshirts(capped).map((p) => p.id)).not.toContain(t.roster[7]!.id);
  });

  it('lets CPU staffs redshirt a few players, once', () => {
    const t = team();
    const once = applyCpuRedshirts(t);
    const count = once.roster.filter((p) => p.redshirtStatus === 'redshirting').length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(CPU_REDSHIRT_LIMIT);
    expect(applyCpuRedshirts(once)).toBe(once);
  });

  it("doesn't count a redshirt as a benching", () => {
    const t = setLacrosseRedshirt(team(), team().roster[0]!.id, true, 0);
    const star = t.roster[0]!;
    expect(moraleReason(t, star)).toBe('Redshirting this season');
    const input = { won: null, intensity: 'normal' } as const;
    expect(weeklyMoraleChange(star, playerRoleStatus(t, star), input)).toBeGreaterThan(0);
    // The next man up now rates as a starter, not a benched backup.
    expect(playerRoleStatus(t, t.roster[3]!).expected).toBe('starter');
  });
});
