import { describe, expect, it } from 'vitest';
import { TEAM_TALK_TONES, addCoachingEdge, teamTalkResult } from './team-talk';

describe('teamTalkResult', () => {
  it('lets underdogs feed off emotion and punishes demanding too much of them', () => {
    const ctx = { winProbability: 30, rivalry: false };
    expect(teamTalkResult('fire_up', ctx).reaction).toBe('positive');
    expect(teamTalkResult('no_pressure', ctx).reaction).toBe('positive');
    expect(teamTalkResult('demand_more', ctx).reaction).toBe('negative');
  });

  it('pushes favorites and lets them go flat when told to relax', () => {
    const ctx = { winProbability: 75, rivalry: false };
    expect(teamTalkResult('demand_more', ctx).reaction).toBe('positive');
    const relaxed = teamTalkResult('no_pressure', ctx);
    expect(relaxed.reaction).toBe('negative');
    expect(relaxed.edge.offense).toBeLessThan(0);
  });

  it('fires up a favorite only in a rivalry game', () => {
    expect(teamTalkResult('fire_up', { winProbability: 75, rivalry: false }).reaction).toBe('neutral');
    expect(teamTalkResult('fire_up', { winProbability: 75, rivalry: true }).reaction).toBe('positive');
  });

  it('never backfires when staying composed, and every positive beats every negative', () => {
    for (const winProbability of [20, 50, 80]) {
      for (const rivalry of [false, true]) {
        const calm = teamTalkResult('calm', { winProbability, rivalry });
        expect(calm.edge.offense + calm.edge.defense).toBeGreaterThan(0);
        for (const tone of TEAM_TALK_TONES) {
          const r = teamTalkResult(tone, { winProbability, rivalry });
          const total = r.edge.offense + r.edge.defense;
          if (r.reaction === 'positive') expect(total).toBeGreaterThan(0.005);
          if (r.reaction === 'negative') expect(total).toBeLessThan(0);
        }
      }
    }
    expect(addCoachingEdge({ offense: 0.01, defense: 0 }, { offense: 0.002, defense: 0.003 })).toEqual({ offense: 0.012, defense: 0.003 });
  });
});
