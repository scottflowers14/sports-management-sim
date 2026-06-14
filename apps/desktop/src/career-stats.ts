import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { PlayerSeasonStats, SeasonStatsMap } from './stats';

/** One completed season of production for a player. */
export interface CareerSeasonLine {
  year: number;
  /** Raw team name/id that season — format with formatTeamName for display. */
  teamName: string;
  classYear: string;
  position: string;
  stats: PlayerSeasonStats;
}

export interface PlayerCareer {
  playerId: string;
  name: string;
  /** Most recent position on record. */
  position: string;
  seasons: CareerSeasonLine[];
}

export type CareerStatsMap = Record<string, PlayerCareer>;

export function emptyCareerStats(): CareerStatsMap {
  return {};
}

/**
 * Fold a finished season's per-player stats into the permanent career log.
 * Records a line for every player who appeared in a game, keyed by player id so
 * production accumulates across seasons even as players age and graduate.
 */
export function recordSeasonToCareer(
  current: CareerStatsMap,
  seasonStats: SeasonStatsMap,
  teams: LacrosseTeam[],
  year: number,
): CareerStatsMap {
  const updated: CareerStatsMap = { ...current };

  for (const team of teams) {
    for (const player of team.roster) {
      const stats = seasonStats[player.id];
      if (!stats || stats.gamesPlayed === 0) continue;

      const line: CareerSeasonLine = {
        year,
        teamName: team.name,
        classYear: player.classYear,
        position: player.position,
        stats,
      };

      const existing = updated[player.id];
      const name = `${player.name.first} ${player.name.last}`;
      if (existing) {
        // Replace any line already stored for this year (idempotent re-entry).
        const seasons = [...existing.seasons.filter((s) => s.year !== year), line].sort(
          (a, b) => a.year - b.year,
        );
        updated[player.id] = { ...existing, name, position: player.position, seasons };
      } else {
        updated[player.id] = {
          playerId: player.id,
          name,
          position: player.position,
          seasons: [line],
        };
      }
    }
  }

  return updated;
}

/** Sum a career (optionally with the in-progress season folded in) into one line. */
export function careerTotals(
  career: PlayerCareer | undefined,
  liveSeason?: PlayerSeasonStats,
): PlayerSeasonStats {
  const total = blankTotals();
  const lines = career?.seasons ?? [];
  for (const line of lines) addInto(total, line.stats);
  if (liveSeason) addInto(total, liveSeason);
  return total;
}

function addInto(target: PlayerSeasonStats, src: PlayerSeasonStats): void {
  target.gamesPlayed += src.gamesPlayed;
  target.goals += src.goals;
  target.assists += src.assists;
  target.shots += src.shots;
  target.groundBalls += src.groundBalls;
  target.turnovers += src.turnovers;
  target.causedTurnovers += src.causedTurnovers;
  target.faceoffWins += src.faceoffWins;
  target.faceoffAttempts += src.faceoffAttempts;
  target.saves += src.saves;
  target.goalsAllowed += src.goalsAllowed;
}

function blankTotals(): PlayerSeasonStats {
  return {
    playerId: '',
    gamesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    goalsAllowed: 0,
  };
}
