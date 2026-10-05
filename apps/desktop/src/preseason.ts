import type { Conference } from '@sports-management-sim/engine-core';
import { lacrossePollScore, type LacrosseTeam } from '@sports-management-sim/sport-lacrosse';

export interface PreseasonWatchPlayer {
  playerId: string;
  name: string;
  position: string;
  classYear: string;
  /** Raw team name — format with formatTeamName for display. */
  teamName: string;
  teamId: string;
  overall: number;
}

/** The media's preseason picks, frozen when the season starts. */
export interface SeasonPreview {
  year: number;
  /** Predicted finish for each conference, team ids first to last. */
  conferenceOrder: Record<string, string[]>;
  /** The best players in the country going in. */
  watchList: PreseasonWatchPlayer[];
}

export const WATCH_LIST_SIZE = 10;

export function buildSeasonPreview(year: number, teams: readonly LacrosseTeam[], conferences: readonly Conference[]): SeasonPreview {
  const scores = new Map(teams.map((t) => [t.id, lacrossePollScore(t)]));
  const conferenceOrder = Object.fromEntries(
    conferences.map((c) => [
      c.id,
      [...c.teamIds].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || a.localeCompare(b)),
    ]),
  );
  const watchList = teams
    .flatMap((team) =>
      team.roster
        .filter((p) => p.redshirtStatus !== 'redshirting')
        .map((p) => ({
          playerId: p.id,
          name: `${p.name.first} ${p.name.last}`,
          position: p.position,
          classYear: p.classYear,
          teamName: team.name,
          teamId: team.id,
          overall: p.ratings.overall,
        })),
    )
    .sort((a, b) => b.overall - a.overall || a.playerId.localeCompare(b.playerId))
    .slice(0, WATCH_LIST_SIZE);
  return { year, conferenceOrder, watchList };
}

/** Where the media picked a team to finish in its conference (1 = first), or null. */
export function predictedFinish(preview: SeasonPreview | null, teamId: string): number | null {
  if (!preview) return null;
  for (const order of Object.values(preview.conferenceOrder)) {
    const index = order.indexOf(teamId);
    if (index !== -1) return index + 1;
  }
  return null;
}

/** The preseason pick and conference size, for setting the AD's goals. */
export function seasonOutlook(preview: SeasonPreview | null, teamId: string): { pickedFinish: number; conferenceSize: number } | undefined {
  if (!preview) return undefined;
  for (const order of Object.values(preview.conferenceOrder)) {
    const index = order.indexOf(teamId);
    if (index !== -1) return { pickedFinish: index + 1, conferenceSize: order.length };
  }
  return undefined;
}

export function formatOrdinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** How the season went against the picks, e.g. "Picked 5th, finished 2nd". */
export function versusPrediction(picked: number | null | undefined, finished: number): string | null {
  if (picked === null || picked === undefined) return null;
  return `Picked ${formatOrdinal(picked)}, finished ${formatOrdinal(finished)}`;
}

/** Preseason headlines for the user's conference and players. */
export function previewHeadlines(
  preview: SeasonPreview,
  conferences: readonly Conference[],
  teamName: (teamId: string) => string,
  userTeamId: string,
): string[] {
  const conference = conferences.find((c) => c.teamIds.includes(userTeamId));
  if (!conference) return [];
  const order = preview.conferenceOrder[conference.id] ?? [];
  const pick = order.indexOf(userTeamId) + 1;
  const headlines: string[] = [];
  if (order[0] && order[0] !== userTeamId) {
    headlines.push(`Preseason poll: ${teamName(order[0])} picked to win the ${conference.name}`);
  }
  if (pick > 0) {
    headlines.push(
      pick === 1
        ? `Preseason poll: ${teamName(userTeamId)} picked to win the ${conference.name}`
        : `Preseason poll: ${teamName(userTeamId)} picked to finish ${formatOrdinal(pick)} in the ${conference.name}`,
    );
  }
  for (const player of preview.watchList.filter((p) => p.teamId === userTeamId)) {
    headlines.push(`Watch list: ${player.position} ${player.name} named one of the ${WATCH_LIST_SIZE} best players in the country`);
  }
  return headlines;
}
