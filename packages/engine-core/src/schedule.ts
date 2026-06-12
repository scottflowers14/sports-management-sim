import type { ID, ScheduledGame, SeasonYear } from './models';

export interface CreateRoundRobinScheduleOptions {
  startWeek?: number;
  conferenceGame?: boolean;
}

/**
 * Single round-robin via the circle method: n teams play n-1 rounds with all
 * games in a round sharing the same week (odd team counts get a weekly bye).
 */
export function createRoundRobinSchedule(
  teamIds: ID[],
  seasonYear: SeasonYear,
  options: CreateRoundRobinScheduleOptions = {},
): ScheduledGame[] {
  const startWeek = options.startWeek ?? 1;
  const conferenceGame = options.conferenceGame ?? false;
  const schedule: ScheduledGame[] = [];

  const ids = teamIds.filter((id): id is ID => id !== undefined);
  if (ids.length < 2) return schedule;

  const slots: Array<ID | null> = ids.length % 2 === 0 ? [...ids] : [...ids, null];
  const n = slots.length;

  for (let round = 0; round < n - 1; round += 1) {
    const week = startWeek + round;
    for (let k = 0; k < n / 2; k += 1) {
      const a = slots[k];
      const b = slots[n - 1 - k];
      if (a == null || b == null) continue;

      // Alternate home/away across rounds so nobody hosts everything
      const [homeTeamId, awayTeamId] = (round + k) % 2 === 0 ? [a, b] : [b, a];
      schedule.push({
        id: `${seasonYear}-week-${week}-${homeTeamId}-vs-${awayTeamId}`,
        seasonYear,
        week,
        homeTeamId,
        awayTeamId,
        conferenceGame,
        status: 'scheduled',
      });
    }
    slots.splice(1, 0, slots.pop()!);
  }

  return schedule;
}
