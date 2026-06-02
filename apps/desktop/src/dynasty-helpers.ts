import {
  addSignedRecruitsToTeam,
  applyScholarshipOffer,
  commitRecruit,
  runTeamOffseason,
  signCommittedRecruit,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import type { StandingsEntry } from '@sports-management-sim/engine-core';
import { createLacrosseSeasonSchedule, generateLacrosseRecruitingClass } from '@sports-management-sim/sport-lacrosse';
import type {
  LacrosseDynastyState,
  LacrosseRecruit,
  LacrosseSeason,
  LacrosseTeam,
} from '@sports-management-sim/sport-lacrosse';
import { computeSeasonAwards } from './awards';
import type { SeasonAwards } from './awards';

export interface OffseasonSummary {
  seasonYear: number;
  finalStandings: StandingsEntry[];
  userStanding: number;
  userRecord: { wins: number; losses: number };
  graduates: { name: string; position: string; overall: number }[];
  signingClass: { name: string; position: string; starRating: number; overall: number }[];
  awards: SeasonAwards | null;
}

export function autoCommitWeekly(
  recruits: LacrosseRecruit[],
  teams: LacrosseTeam[],
  random: () => number,
  commitChance = 0.22,
): LacrosseRecruit[] {
  return recruits.map((recruit) => {
    if (recruit.status !== 'open') return recruit;
    if (recruit.scholarshipOffers.length === 0) return recruit;
    if (random() < commitChance) return commitRecruit(recruit, teams);
    return recruit;
  });
}

export function runOffseason(
  dynasty: LacrosseDynastyState,
): { newDynasty: LacrosseDynastyState; summary: OffseasonSummary } {
  const { season, recruits, userTeamId, seed, rosterTargets } = dynasty;
  const newYear = season.year + 1;

  const userTeam = season.teams.find((t) => t.id === userTeamId)!;
  const sortedStandings = [...season.standings].sort(
    (a, b) => b.record.wins - a.record.wins || a.record.losses - b.record.losses,
  );
  const userStanding = sortedStandings.findIndex((s) => s.teamId === userTeamId) + 1;

  const graduates = userTeam.roster
    .filter((p) => p.classYear === 'SR' || p.classYear === 'GR')
    .map((p) => ({
      name: `${p.name.first} ${p.name.last}`,
      position: p.position,
      overall: p.ratings.overall,
    }));

  // CPU teams make offers to their top targets before signing day
  const withCpuOffers = applyeCpuOffers(recruits, season.teams, userTeamId);

  // Commit remaining open recruits who have an offer
  const fullyCommitted = withCpuOffers.map((r) =>
    r.status === 'open' && r.scholarshipOffers.length > 0
      ? commitRecruit(r, season.teams)
      : r,
  );

  // Sign all committed recruits
  const signed = fullyCommitted.map((r) =>
    r.status === 'committed' ? signCommittedRecruit(r) : r,
  );

  // Intake signing class and run offseason for every team
  const teamsAfterOffseason = season.teams.map((team) => {
    const withClass = addSignedRecruitsToTeam(team, signed, season.year);
    return runTeamOffseason(withClass);
  });

  // Capture user team signing class for summary
  const signingClass = signed
    .filter((r) => r.signedTeamId === userTeamId)
    .map((r) => ({
      name: `${r.name.first} ${r.name.last}`,
      position: r.position,
      starRating: r.starRating,
      overall: r.ratings.overall,
    }));

  // Compute season awards
  const awards = computeSeasonAwards(season, userTeamId);

  // Generate new recruiting class and board
  const newSeed = seed + newYear;
  const newRecruits = generateLacrosseRecruitingClass({ count: 80, seed: newSeed });
  const newUserTeam = teamsAfterOffseason.find((t) => t.id === userTeamId)!;
  const newRecruitBoard = sortRecruitBoardForTeam(newUserTeam, newRecruits, rosterTargets);

  const newSeason: LacrosseSeason = {
    ...season,
    year: newYear,
    teams: teamsAfterOffseason,
    schedule: createLacrosseSeasonSchedule(newYear),
    standings: [],
    currentWeek: 1,
    phase: 'regular_season',
  };

  const summary: OffseasonSummary = {
    seasonYear: season.year,
    finalStandings: sortedStandings,
    userStanding,
    userRecord: { wins: userTeam.record.wins, losses: userTeam.record.losses },
    graduates,
    signingClass,
    awards,
  };

  return {
    newDynasty: {
      ...dynasty,
      season: newSeason,
      recruits: newRecruits,
      recruitBoard: newRecruitBoard,
      seed: newSeed,
    },
    summary,
  };
}

// Each CPU team extends offers to their top 15 open recruits at 50% scholarship
function applyeCpuOffers(
  recruits: LacrosseRecruit[],
  teams: LacrosseTeam[],
  userTeamId: string,
): LacrosseRecruit[] {
  const rosterTargets = { ATT: 8, MID: 16, DEF: 10, GK: 4, FOGO: 3, LSM: 4 } as const;
  let updated = [...recruits];

  for (const team of teams) {
    if (team.id === userTeamId) continue;
    const openRecruits = updated.filter((r) => r.status === 'open');
    const board = sortRecruitBoardForTeam(team, openRecruits, rosterTargets);
    for (const entry of board.slice(0, 15)) {
      const idx = updated.findIndex((r) => r.id === entry.recruit.id);
      if (idx >= 0) {
        updated[idx] = applyScholarshipOffer(updated[idx]!, team.id, 50);
      }
    }
  }

  return updated;
}
