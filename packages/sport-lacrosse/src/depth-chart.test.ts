import { describe, expect, it } from 'vitest';
import { getLacrosseDepthChart, updateLacrosseDepthChartSlot } from './depth-chart';
import { generateLacrosseRoster } from './roster-generation';
import { makeLacrosseTeam } from './test-fixtures';

describe('depth chart edits', () => {
  it('pin only the edited position, so other positions keep following the ratings', () => {
    const team = makeLacrosseTeam('durham', generateLacrosseRoster({ seed: 4, prestige: 70, createdSeason: 2028 }));
    const attack = getLacrosseDepthChart(team).ATT;
    const edited = updateLacrosseDepthChartSlot(team, 'ATT', 0, attack[3]!);
    expect(edited.depthChart?.ATT?.[0]).toBe(attack[3]);
    expect(edited.depthChart?.MID).toBeUndefined();

    // A midfielder who passes his teammates at practice moves up on his own.
    const mids = getLacrosseDepthChart(edited).MID;
    const riser = mids.at(-1)!;
    const improved = {
      ...edited,
      roster: edited.roster.map((p) => (p.id === riser ? { ...p, ratings: { ...p.ratings, overall: 99 } } : p)),
    };
    expect(getLacrosseDepthChart(improved).MID[0]).toBe(riser);
    expect(getLacrosseDepthChart(improved).ATT[0]).toBe(attack[3]);
  });
});
