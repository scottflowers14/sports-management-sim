import { describe, expect, it } from 'vitest';
import type { Conference } from '@sports-management-sim/engine-core';
import { inScope, scopeTeams } from './stats-scope';

const conferences: Conference[] = [
  { id: 'east', name: 'East League', shortName: 'East', teamIds: ['a', 'b', 'c'], prestige: 60, regionIds: [] },
  { id: 'west', name: 'West League', shortName: 'West', teamIds: ['d', 'e'], prestige: 55, regionIds: [] },
];

describe('scopeTeams', () => {
  it('covers every team nationally', () => {
    const scope = scopeTeams('national', 'a', conferences);
    expect(scope).toEqual({ teamIds: null, label: 'National' });
    expect(inScope(scope, 'e')).toBe(true);
  });

  it("covers the user's conference, labelled by its short name", () => {
    const scope = scopeTeams('conference', 'b', conferences);
    expect(scope.label).toBe('East');
    expect(inScope(scope, 'c')).toBe(true);
    expect(inScope(scope, 'd')).toBe(false);
    expect(inScope(scope, undefined)).toBe(false);
  });

  it('covers only the user team, and falls back to national without a conference', () => {
    const team = scopeTeams('team', 'd', conferences);
    expect(inScope(team, 'd')).toBe(true);
    expect(inScope(team, 'e')).toBe(false);
    expect(scopeTeams('conference', 'independent', conferences).teamIds).toBeNull();
  });
});
