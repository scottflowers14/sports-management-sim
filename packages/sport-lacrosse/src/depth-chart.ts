import type { LacrossePlayer, LacrossePosition, LacrosseTeam } from './models';

export const LACROSSE_STARTER_COUNTS: Record<LacrossePosition, number> = {
  ATT: 3,
  MID: 6,
  DEF: 3,
  GK: 1,
  FOGO: 1,
  LSM: 1,
};

export type LacrosseDepthChart = Record<LacrossePosition, string[]>;

interface LacrosseDepthChartTeamShape {
  roster: LacrossePlayer[];
  depthChart?: Partial<LacrosseDepthChart>;
}

export type LacrosseTeamWithDepthChart = LacrosseTeam & {
  depthChart?: Partial<LacrosseDepthChart>;
};

export function createDefaultLacrosseDepthChart(team: LacrosseDepthChartTeamShape): LacrosseDepthChart {
  return Object.fromEntries(
    (Object.keys(LACROSSE_STARTER_COUNTS) as LacrossePosition[]).map((position) => [
      position,
      sortedPositionPlayers(team.roster, position).map((player) => player.id),
    ]),
  ) as LacrosseDepthChart;
}

export function getLacrosseDepthChart(team: LacrosseDepthChartTeamShape): LacrosseDepthChart {
  const defaults = createDefaultLacrosseDepthChart(team);
  const positionById = new Map(team.roster.map((player) => [player.id, player.position]));

  return Object.fromEntries(
    (Object.keys(LACROSSE_STARTER_COUNTS) as LacrossePosition[]).map((position) => {
      // A stale chart (an old save, a player whose position changed) can't list
      // someone under a position he doesn't play, or he'd get two stat lines.
      const configuredIds = (team.depthChart?.[position] ?? []).filter((id) => positionById.get(id) === position);
      const defaultIds = defaults[position].filter((id) => !configuredIds.includes(id));
      return [position, [...configuredIds, ...defaultIds]];
    }),
  ) as LacrosseDepthChart;
}

export function updateLacrosseDepthChartSlot(
  team: LacrosseTeamWithDepthChart,
  position: LacrossePosition,
  slotIndex: number,
  playerId: string,
): LacrosseTeamWithDepthChart {
  const player = team.roster.find((candidate) => candidate.id === playerId);
  if (!player || player.position !== position) {
    return team;
  }

  const current = getLacrosseDepthChart(team);
  const positionOrder = current[position].filter((id) => id !== playerId);
  positionOrder.splice(slotIndex, 0, playerId);

  // Only the edited position is pinned; the rest keep following the ratings,
  // so a player who improves at practice still moves up on his own.
  return {
    ...team,
    depthChart: {
      ...team.depthChart,
      [position]: positionOrder,
    },
  };
}

export function getLacrosseOrderedPlayers(
  team: LacrosseTeamWithDepthChart,
  position: LacrossePosition,
): LacrossePlayer[] {
  const byId = new Map(team.roster.map((player) => [player.id, player]));
  const orderedIds = getLacrosseDepthChart(team)[position];
  return orderedIds.map((id) => byId.get(id)).filter((player): player is LacrossePlayer => Boolean(player));
}

export function getLacrosseStarters(
  team: LacrosseTeamWithDepthChart,
  position: LacrossePosition,
): LacrossePlayer[] {
  return getLacrosseOrderedPlayers(team, position).slice(0, LACROSSE_STARTER_COUNTS[position]);
}

function sortedPositionPlayers(roster: LacrossePlayer[], position: LacrossePosition): LacrossePlayer[] {
  return [...roster]
    .filter((player) => player.position === position)
    .sort((a, b) => b.ratings.overall - a.ratings.overall || a.name.last.localeCompare(b.name.last));
}
