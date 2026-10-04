import { coachName, expectedWinPct } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { DynastySeasonRecord } from './history';

export interface CoachOfYear {
  teamId: string;
  /** Null when the winner is the user, whose name lives on the coach profile. */
  coachName: string | null;
  wins: number;
  losses: number;
  /** Wins above what the program was expected to win. */
  winsAboveExpected: number;
}

/** A national title is worth this many wins above expectations to voters. */
const TITLE_BONUS_WINS = 2;

/**
 * Coach of the Year goes to whoever beat their program's expectations by the
 * most, so a turnaround at a small program can beat a blue blood's good year.
 */
export function computeCoachOfYear(
  teams: LacrosseTeam[],
  { userTeamId, nationalChampionId }: { userTeamId: string; nationalChampionId?: string | undefined },
): CoachOfYear | null {
  const leaguePrestige = teams.reduce((sum, team) => sum + team.reputation.nationalPrestige, 0) / Math.max(1, teams.length);
  let best: { team: LacrosseTeam; score: number; aboveExpected: number } | null = null;
  for (const team of teams) {
    if (team.id !== userTeamId && !team.headCoach) continue;
    const games = team.record.wins + team.record.losses;
    if (games === 0) continue;
    const aboveExpected = team.record.wins - games * expectedWinPct(team, leaguePrestige);
    const score = aboveExpected + (team.id === nationalChampionId ? TITLE_BONUS_WINS : 0);
    if (!best || score > best.score) best = { team, score, aboveExpected };
  }
  if (!best || best.score <= 0) return null;
  const { team, aboveExpected } = best;
  return {
    teamId: team.id,
    coachName: team.id === userTeamId || !team.headCoach ? null : coachName(team.headCoach),
    wins: team.record.wins,
    losses: team.record.losses,
    winsAboveExpected: Math.round(aboveExpected * 10) / 10,
  };
}

export interface CoachCareerStint {
  teamName: string;
  firstYear: number;
  lastYear: number;
  wins: number;
  losses: number;
}

export interface CoachCareer {
  seasons: number;
  wins: number;
  losses: number;
  confTitles: number;
  nationalTitles: number;
  coachOfYearYears: number[];
  /** Programs coached, in order. */
  stints: CoachCareerStint[];
  bestSeason: DynastySeasonRecord | null;
}

/** The user's career as a head coach, from the dynasty history (newest season first). */
export function buildCoachCareer(history: DynastySeasonRecord[], name: string): CoachCareer {
  const seasons = history.filter((record) => record.coachName === undefined || record.coachName === name).sort((a, b) => a.year - b.year);
  const stints: CoachCareerStint[] = [];
  for (const record of seasons) {
    const teamName = record.teamName ?? 'Unknown program';
    const current = stints[stints.length - 1];
    if (current && current.teamName === teamName) {
      current.lastYear = record.year;
      current.wins += record.wins;
      current.losses += record.losses;
    } else {
      stints.push({ teamName, firstYear: record.year, lastYear: record.year, wins: record.wins, losses: record.losses });
    }
  }
  const pct = (record: DynastySeasonRecord) => record.wins / Math.max(1, record.wins + record.losses);
  const bestSeason = seasons.reduce<DynastySeasonRecord | null>((best, record) => {
    if (!best) return record;
    const rank = (r: DynastySeasonRecord) => (r.nationalChampion ? 2 : 0) + (r.confChampion ? 1 : 0);
    return rank(record) > rank(best) || (rank(record) === rank(best) && pct(record) > pct(best)) ? record : best;
  }, null);
  return {
    seasons: seasons.length,
    wins: seasons.reduce((sum, r) => sum + r.wins, 0),
    losses: seasons.reduce((sum, r) => sum + r.losses, 0),
    confTitles: seasons.filter((r) => r.confChampion).length,
    nationalTitles: seasons.filter((r) => r.nationalChampion).length,
    coachOfYearYears: seasons.filter((r) => r.coachOfYear).map((r) => r.year),
    stints,
    bestSeason,
  };
}
