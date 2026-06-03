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

export interface InjuredPlayer {
  playerId: string;
  teamId: string;
  weeksRemaining: number;
}

export function processInjuries(
  currentInjuries: InjuredPlayer[],
  teams: LacrosseTeam[],
  random: () => number,
  injuryChance = 0.03,
): {
  injuries: InjuredPlayer[];
  newlyInjured: { playerId: string; teamId: string; playerName: string; weeksRemaining: number }[];
  recovered: { playerId: string; teamId: string; playerName: string }[];
} {
  const decremented = currentInjuries.map((inj) => ({
    ...inj,
    weeksRemaining: inj.weeksRemaining - 1,
  }));

  const recovered: { playerId: string; teamId: string; playerName: string }[] = [];
  const stillActive: InjuredPlayer[] = [];

  for (const inj of decremented) {
    if (inj.weeksRemaining <= 0) {
      const player = teams.find((t) => t.id === inj.teamId)?.roster.find((p) => p.id === inj.playerId);
      recovered.push({
        playerId: inj.playerId,
        teamId: inj.teamId,
        playerName: player ? `${player.name.first} ${player.name.last}` : 'Unknown Player',
      });
    } else {
      stillActive.push(inj);
    }
  }

  const injuredIds = new Set(stillActive.map((inj) => inj.playerId));
  const newlyInjured: { playerId: string; teamId: string; playerName: string; weeksRemaining: number }[] = [];
  const newEntries: InjuredPlayer[] = [];

  for (const team of teams) {
    for (const player of team.roster) {
      if (injuredIds.has(player.id)) continue;
      if (random() < injuryChance) {
        const weeksRemaining = 1 + Math.floor(random() * 4);
        newlyInjured.push({
          playerId: player.id,
          teamId: team.id,
          playerName: `${player.name.first} ${player.name.last}`,
          weeksRemaining,
        });
        newEntries.push({ playerId: player.id, teamId: team.id, weeksRemaining });
      }
    }
  }

  return {
    injuries: [...stillActive, ...newEntries],
    newlyInjured,
    recovered,
  };
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
  nationalChampionId?: string,
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

  // Evolve program prestige based on season performance
  const teamsWithPrestige = evolvePrestige(season.teams, sortedStandings, nationalChampionId);

  // Run offseason for returning players first (advances class years, graduates seniors),
  // then add the signing class as true freshmen for the upcoming season.
  const teamsAfterOffseason = teamsWithPrestige.map((team) => {
    const afterOffseason = runTeamOffseason(team);
    const withClass = addSignedRecruitsToTeam(afterOffseason, signed, newYear);
    return pruneDepthChart(withClass);
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

function evolvePrestige(
  teams: LacrosseTeam[],
  standings: StandingsEntry[],
  nationalChampionId?: string,
): LacrosseTeam[] {
  return teams.map((team) => {
    const standing = standings.find((s) => s.teamId === team.id);
    const wins = standing?.record.wins ?? 0;
    const losses = standing?.record.losses ?? 0;
    const total = wins + losses;
    const winPct = total > 0 ? wins / total : 0.5;
    const perfBase = Math.round(winPct * 100);

    // Drift recentSuccess toward season performance
    const gap = perfBase - team.reputation.recentSuccess;
    const drift = Math.round(gap * 0.3);
    let recentSuccess = Math.min(99, Math.max(40, team.reputation.recentSuccess + drift));
    let nationalPrestige = team.reputation.nationalPrestige;

    if (team.id === nationalChampionId) {
      recentSuccess = Math.min(99, recentSuccess + 8);
      nationalPrestige = Math.min(99, nationalPrestige + 5);
    } else if (winPct > 0.75) {
      nationalPrestige = Math.min(99, nationalPrestige + 2);
    } else if (winPct > 0.6) {
      nationalPrestige = Math.min(99, nationalPrestige + 1);
    } else if (winPct < 0.35) {
      nationalPrestige = Math.max(40, nationalPrestige - 1);
    }

    return {
      ...team,
      reputation: { ...team.reputation, recentSuccess, nationalPrestige },
    };
  });
}

function pruneDepthChart(team: LacrosseTeam): LacrosseTeam {
  const dc = (team as LacrosseTeam & { depthChart?: Record<string, string[]> }).depthChart;
  if (!dc) return team;
  const rosterIds = new Set(team.roster.map((p) => p.id));
  return {
    ...team,
    depthChart: Object.fromEntries(
      Object.entries(dc).map(([pos, ids]) => [pos, ids.filter((id) => rosterIds.has(id))]),
    ),
  } as LacrosseTeam;
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
