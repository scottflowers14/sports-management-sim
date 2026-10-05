import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { createNewLacrosseDynasty } from './dynasty';
import { eligibleNonConferenceOpponents, swapNonConferenceOpponent, userNonConferenceSlots } from './nonconference-scheduling';

const dynasty = createNewLacrosseDynasty({ seed: 7, userTeamId: 'maryland-state', seasonYear: 2028 });
const context = { schedule: dynasty.season.schedule, conferences: dynasty.season.conferences, userTeamId: 'maryland-state' };

function gamesPerTeam(schedule: ScheduledGame[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of schedule) {
    counts.set(g.homeTeamId, (counts.get(g.homeTeamId) ?? 0) + 1);
    counts.set(g.awayTeamId, (counts.get(g.awayTeamId) ?? 0) + 1);
  }
  return counts;
}

function expectSound(schedule: ScheduledGame[]) {
  // Nobody plays twice in a week, no pairing repeats, and no game is a hidden conference game.
  const weekly = new Set<string>();
  const pairs = new Set<string>();
  const confOf = (id: string) => dynasty.season.conferences.find((c) => c.teamIds.includes(id))!.id;
  for (const g of schedule) {
    for (const t of [g.homeTeamId, g.awayTeamId]) {
      const key = `${g.week}:${t}`;
      expect(weekly.has(key)).toBe(false);
      weekly.add(key);
    }
    const pair = [g.homeTeamId, g.awayTeamId].sort().join('|');
    expect(pairs.has(pair)).toBe(false);
    pairs.add(pair);
    expect(g.conferenceGame).toBe(confOf(g.homeTeamId) === confOf(g.awayTeamId));
  }
  expect(new Set(schedule.map((g) => g.id)).size).toBe(schedule.length);
}

describe('non-conference scheduling', () => {
  it('lists the user program’s non-conference games', () => {
    const slots = userNonConferenceSlots(context);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => !s.game.conferenceGame)).toBe(true);
    expect(slots.map((s) => s.week)).toEqual([...slots.map((s) => s.week)].sort((a, b) => a - b));
  });

  it('swaps an opponent and keeps the schedule whole', () => {
    expectSound(context.schedule);
    const [slot] = userNonConferenceSlots(context);
    const options = eligibleNonConferenceOpponents(context, slot!.week);
    expect(options.length).toBeGreaterThan(3);
    const pick = options[0]!;
    const swapped = swapNonConferenceOpponent(context, slot!.week, pick)!;
    expect(swapped).not.toBeNull();
    expectSound(swapped);
    expect(gamesPerTeam(swapped)).toEqual(gamesPerTeam(context.schedule));
    const after = userNonConferenceSlots({ ...context, schedule: swapped }).find((s) => s.week === slot!.week)!;
    expect(after.opponentId).toBe(pick);
    // The user keeps home or away.
    expect(after.home).toBe(slot!.home);
    // The old opponent still plays that week.
    expect(swapped.some((g) => g.week === slot!.week && (g.homeTeamId === slot!.opponentId || g.awayTeamId === slot!.opponentId))).toBe(true);
  });

  it('survives a run of swaps across every week', () => {
    let schedule = context.schedule;
    for (const slot of userNonConferenceSlots(context)) {
      const options = eligibleNonConferenceOpponents({ ...context, schedule }, slot.week);
      schedule = swapNonConferenceOpponent({ ...context, schedule }, slot.week, options.at(-1)!)!;
      expectSound(schedule);
    }
    expect(gamesPerTeam(schedule)).toEqual(gamesPerTeam(context.schedule));
  });

  it('refuses conference rivals, the current opponent, rematches and played games', () => {
    const [slot] = userNonConferenceSlots(context);
    const conference = dynasty.season.conferences.find((c) => c.teamIds.includes('maryland-state'))!;
    const rival = conference.teamIds.find((id) => id !== 'maryland-state')!;
    expect(swapNonConferenceOpponent(context, slot!.week, rival)).toBeNull();
    expect(swapNonConferenceOpponent(context, slot!.week, slot!.opponentId)).toBeNull();
    // A team already on the schedule in another week would be a rematch.
    const [, second] = userNonConferenceSlots(context);
    expect(swapNonConferenceOpponent(context, slot!.week, second!.opponentId)).toBeNull();
    const played = context.schedule.map((g) => (g === slot!.game ? { ...g, status: 'final' as const } : g));
    expect(eligibleNonConferenceOpponents({ ...context, schedule: played }, slot!.week)).toEqual([]);
  });
});
