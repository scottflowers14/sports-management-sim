import {
  coachingEdge,
  developmentBonusFor,
  generateStaffCandidates,
  generateStartingStaff,
  recruitingHoursFor,
  staffRating,
  type LacrosseDynastyState,
  type LacrosseStaff,
  type StaffMember,
  type StaffRole,
} from '@sports-management-sim/sport-lacrosse';
import type { ScoutingState } from './scouting';

export interface ProgramStaffState {
  staff: LacrosseStaff;
  staffCandidates: StaffMember[];
}

/** The user program's starting staff and hiring pool. */
export function createProgramStaff(dynasty: LacrosseDynastyState): ProgramStaffState {
  const team = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)!;
  const seed = dynasty.seed + dynasty.season.year;
  return {
    staff: generateStartingStaff(team, seed),
    staffCandidates: generateStaffCandidates({ seed: seed + 1, prestige: team.reputation.coachingPrestige }),
  };
}

/** The recruiting coordinator sets the weekly recruiting hours. */
export function withStaffRecruitingHours(scouting: ScoutingState, staff: LacrosseStaff): ScoutingState {
  const pointsPerWeek = recruitingHoursFor(staffRating(staff, 'recruiting'));
  return { ...scouting, pointsPerWeek, pointsAvailable: Math.min(scouting.pointsAvailable, pointsPerWeek * 4) };
}

/** What a coach at this rating does, in the units the coach sees. */
export function describeStaffEffect(role: StaffRole, rating: number): string {
  switch (role) {
    case 'offense':
      return `${signedGoals(coachingEdge(rating, AVERAGE).offense)} goals a game`;
    case 'defense':
    {
      const goals = Math.round(coachingEdge(AVERAGE, rating).defense * GOALS_PER_EDGE * 10) / 10;
      if (goals === 0) return '±0 goals allowed a game';
      return `${Math.abs(goals)} ${goals > 0 ? 'fewer' : 'more'} goals allowed a game`;
    }
    case 'recruiting':
      return `${recruitingHoursFor(rating)} recruiting hours a week`;
    case 'development':
      return `${signedPercent(developmentBonusFor(rating))} offseason growth`;
  }
}

const AVERAGE = 65;
/** Measured: a 0.01 scoring-chance edge is worth about 0.42 goals a game. */
const GOALS_PER_EDGE = 42;

function signedGoals(edge: number): string {
  const goals = Math.round(edge * GOALS_PER_EDGE * 10) / 10;
  if (goals === 0) return '±0';
  return `${goals > 0 ? '+' : ''}${goals}`;
}

function signedPercent(value: number): string {
  const pct = Math.round(value * 1000) / 10;
  if (pct === 0) return '±0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}
