import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState, getScoutTier } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { simulateRemainingWeeks, type WeekSimState } from './week-sim';
import { applyAssistantToWeekState, runRecruitingAssistant, summarizeAssistantActions } from './recruiting-assistant';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function freshState(): WeekSimState {
  return {
    dynasty: createFreshLacrosseDynasty(),
    rankings: [],
    injuries: [],
    newsItems: [],
    scouting: createScoutingState(),
    recruitingActivity: emptyRecruitingActivity(),
    recruitTrends: {},
    seasonStats: emptySeasonStats(),
    gameLogs: new Map(),
    bestNatRank: null,
    lastSimWeek: null,
  };
}

function inputFor(state: WeekSimState, shortlistIds: string[]) {
  const { dynasty } = state;
  return {
    recruitBoard: dynasty.recruitBoard,
    recruits: dynasty.recruits,
    shortlistIds,
    scouting: state.scouting,
    activity: state.recruitingActivity,
    userTeam: dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)!,
    random: seededRandom(3),
  };
}

describe('runRecruitingAssistant', () => {
  it('spends every hour and never more than it has', () => {
    const state = freshState();
    const result = runRecruitingAssistant(inputFor(state, []));
    expect(result.scouting.pointsAvailable).toBe(0);
    expect(result.actions).toHaveLength(state.scouting.pointsAvailable);
  });

  it('scouts best-fit recruits first when nothing is pinned', () => {
    const state = freshState();
    const result = runRecruitingAssistant(inputFor(state, []));
    const open = state.dynasty.recruitBoard.filter((e) => e.recruit.status === 'open').map((e) => e.recruit.id);
    const scouted = result.actions.filter((a) => a.type === 'scout').map((a) => a.recruitId);
    expect(scouted).toEqual(open.slice(0, scouted.length));
    for (const id of scouted) expect(getScoutTier(id, result.scouting)).toBe('partial');
  });

  it('pitches scouted shortlist targets once, then finishes their scouting', () => {
    const state = freshState();
    const [first, second] = state.dynasty.recruitBoard.filter((e) => e.recruit.status === 'open');
    const shortlist = [first!.recruit.id, second!.recruit.id];
    // A first look at the first target so its top motivation is known.
    const primed = runRecruitingAssistant({ ...inputFor(state, []), recruitBoard: [first!], scouting: { ...state.scouting, pointsAvailable: 1 } });
    const result = runRecruitingAssistant({ ...inputFor(state, shortlist), scouting: { ...primed.scouting, pointsAvailable: 4 } });

    const pitches = result.actions.filter((a) => a.type === 'pitch');
    expect(pitches.map((a) => a.recruitId)).toEqual([first!.recruit.id]);
    expect(result.activity.pitchedIds).toEqual([first!.recruit.id]);
    const before = state.dynasty.recruits.find((r) => r.id === first!.recruit.id)!.interestByTeamId[state.dynasty.userTeamId] ?? 0;
    const after = result.recruits.find((r) => r.id === first!.recruit.id)!.interestByTeamId[state.dynasty.userTeamId] ?? 0;
    expect(after - before).toBe(pitches[0]!.type === 'pitch' ? pitches[0]!.interestChange : 0);
    // Remaining 3 hours: full report on the first target, then two looks at the second.
    expect(getScoutTier(first!.recruit.id, result.scouting)).toBe('full');
    expect(getScoutTier(second!.recruit.id, result.scouting)).toBe('full');

    // A second run the same week doesn't pitch the same recruit again.
    const again = runRecruitingAssistant({ ...inputFor(state, shortlist), recruits: result.recruits, scouting: { ...result.scouting, pointsAvailable: 2 }, activity: result.activity });
    expect(again.actions.some((a) => a.type === 'pitch' && a.recruitId === first!.recruit.id)).toBe(false);
  });

  it('never offers scholarships', () => {
    const state = freshState();
    const ids = state.dynasty.recruitBoard.slice(0, 5).map((e) => e.recruit.id);
    const result = runRecruitingAssistant({ ...inputFor(state, ids), scouting: { ...state.scouting, pointsAvailable: 20 } });
    const offersBefore = state.dynasty.recruits.reduce((n, r) => n + r.scholarshipOffers.length, 0);
    const offersAfter = result.recruits.reduce((n, r) => n + r.scholarshipOffers.length, 0);
    expect(offersAfter).toBe(offersBefore);
  });

  it('flags pinned recruits that still need a scholarship offer', () => {
    const state = freshState();
    const ids = state.dynasty.recruitBoard.filter((e) => e.recruit.status === 'open').slice(0, 2).map((e) => e.recruit.id);
    const result = runRecruitingAssistant(inputFor(state, ids));
    expect(result.needsOffer.map((n) => n.recruitId)).toEqual(ids);
  });

  it('does nothing without hours', () => {
    const state = freshState();
    const result = runRecruitingAssistant({ ...inputFor(state, []), scouting: { ...state.scouting, pointsAvailable: 0 } });
    expect(result.actions).toEqual([]);
    expect(summarizeAssistantActions(result.actions)).toMatch(/nothing to do/);
  });
});

describe('auto assistant during Sim to End', () => {
  it('keeps hours from piling up across the season', () => {
    const manual = simulateRemainingWeeks(freshState(), undefined, seededRandom(9));
    const auto = simulateRemainingWeeks(freshState(), undefined, seededRandom(9), (s) =>
      applyAssistantToWeekState(s, [], seededRandom(5)).state,
    );
    expect(manual.scouting.pointsAvailable).toBeGreaterThan(auto.scouting.pointsAvailable);
    const scoutedAuto = Object.keys(auto.scouting.partialIds).length + auto.scouting.fullIds.length;
    expect(scoutedAuto).toBeGreaterThan(20);
  });
});
