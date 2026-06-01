import type { ID, ScheduledGame, SeasonYear } from './models';

export interface CreateRoundRobinScheduleOptions {
  startWeek?: number;
  conferenceGame?: boolean;
}

export function createRoundRobinSchedule(
  teamIds: ID[],
  seasonYear: SeasonYear,
  options: CreateRoundRobinScheduleOptions = {},
): ScheduledGame[] {
  const startWeek = options.startWeek ?? 1;
  const conferenceGame = options.conferenceGame ?? false;
  const schedule: ScheduledGame[] = [];

  for (let homeIndex = 0; homeIndex < teamIds.length; homeIndex += 1) {
    for (let awayIndex = homeIndex + 1; awayIndex < teamIds.length; awayIndex += 1) {
      const homeTeamId = teamIds[homeIndex];
      const awayTeamId = teamIds[awayIndex];

      if (homeTeamId === undefined || awayTeamId === undefined) {
        continue;
      }

      schedule.push({
        id: `${seasonYear}-week-${startWeek + schedule.length}-${homeTeamId}-vs-${awayTeamId}`,
        seasonYear,
        week: startWeek + schedule.length,
        homeTeamId,
        awayTeamId,
        conferenceGame,
        status: 'scheduled',
      });
    }
  }

  return schedule;
}
