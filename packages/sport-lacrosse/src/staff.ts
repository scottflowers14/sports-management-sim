import type { PersonName } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';
import { LACROSSE_FIRST_NAMES, LACROSSE_LAST_NAMES } from './names';

/** The four assistant jobs on a college lacrosse staff. */
export type StaffRole = 'offense' | 'defense' | 'recruiting' | 'development';

export const STAFF_ROLES: StaffRole[] = ['offense', 'defense', 'recruiting', 'development'];

export const STAFF_ROLE_LABELS: Record<StaffRole, { title: string; effect: string }> = {
  offense: { title: 'Offensive Coordinator', effect: 'Scoring chances' },
  defense: { title: 'Defensive Coordinator', effect: 'Opponent scoring chances' },
  recruiting: { title: 'Recruiting Coordinator', effect: 'Weekly recruiting hours' },
  development: { title: 'Player Development', effect: 'Offseason player growth' },
};

export interface StaffMember {
  id: string;
  name: PersonName;
  role: StaffRole;
  /** 40–95. */
  rating: number;
  /** Yearly salary in dollars. */
  salary: number;
  /** Seasons left on the contract, including the current one. */
  yearsLeft: number;
}

export type LacrosseStaff = Partial<Record<StaffRole, StaffMember>>;

/** A rating with no coach in the chair: a graduate assistant covers it. */
export const VACANT_STAFF_RATING = 45;
/** League-average staffer: no edge either way. */
const AVERAGE_STAFF_RATING = 65;

/** Better coaches cost more: a 70 earns about $110k, a 90 about $170k. */
export function staffSalary(rating: number): number {
  return Math.round((20_000 + (rating - 40) * 3_000) / 5_000) * 5_000;
}

/** What a program can pay its assistants, from national prestige. */
export function staffBudgetFor(nationalPrestige: number): number {
  return Math.round((200_000 + nationalPrestige * 3_500) / 5_000) * 5_000;
}

export function staffPayroll(staff: LacrosseStaff): number {
  return STAFF_ROLES.reduce((sum, role) => sum + (staff[role]?.salary ?? 0), 0);
}

export function staffRating(staff: LacrosseStaff, role: StaffRole): number {
  return staff[role]?.rating ?? VACANT_STAFF_RATING;
}

/**
 * CPU programs don't carry staff objects (it keeps saves small); their staff
 * quality follows coaching prestige with a stable per-program, per-role wobble.
 */
export function cpuStaffRating(team: LacrosseTeam, role: StaffRole): number {
  const wobble = (hash(`${team.id}:${role}`) % 13) - 6;
  return clamp(Math.round(team.reputation.coachingPrestige * 0.8 + 10 + wobble), 40, 95);
}

/** Scoring-chance modifiers from the coordinators (each about ±1% at the extremes). */
export interface CoachingEdge {
  /** Added to this team's scoring chance. */
  offense: number;
  /** Subtracted from the opponent's scoring chance. */
  defense: number;
}

export function coachingEdge(offenseRating: number, defenseRating: number): CoachingEdge {
  return {
    offense: (offenseRating - AVERAGE_STAFF_RATING) / 2_500,
    defense: (defenseRating - AVERAGE_STAFF_RATING) / 2_500,
  };
}

/**
 * Staff quality for any program: the user's hired staff for the user team,
 * the prestige-based estimate for everyone else.
 */
export function programStaffRating(
  team: LacrosseTeam,
  role: StaffRole,
  user: { teamId: string; staff?: LacrosseStaff },
): number {
  if (team.id === user.teamId && user.staff) return staffRating(user.staff, role);
  return cpuStaffRating(team, role);
}

export function programCoachingEdge(team: LacrosseTeam, user: { teamId: string; staff?: LacrosseStaff }): CoachingEdge {
  return coachingEdge(programStaffRating(team, 'offense', user), programStaffRating(team, 'defense', user));
}

/** A departing coach is back in the pool, asking for a raise. */
export function reSigningCandidate(member: StaffMember): StaffMember {
  return { ...member, salary: Math.round((member.salary * 1.1) / 5_000) * 5_000, yearsLeft: 3 };
}

/** Weekly recruiting hours: 6 for an average coordinator, 3 to 9 at the extremes. */
export function recruitingHoursFor(rating: number): number {
  return clamp(6 + Math.round((rating - AVERAGE_STAFF_RATING) / 10), 3, 9);
}

/** Added to each player's offseason development roll (0–1 scale). */
export function developmentBonusFor(rating: number): number {
  return (rating - AVERAGE_STAFF_RATING) / 300;
}

/**
 * The hiring pool: a spread of candidates for every role. Better programs
 * attract better candidates, but there are bargains and stars at every level.
 */
export function generateStaffCandidates({
  seed,
  prestige,
  perRole = 3,
}: {
  seed: number;
  prestige: number;
  perRole?: number;
}): StaffMember[] {
  const random = seededRandom(seed);
  const candidates: StaffMember[] = [];
  for (const role of STAFF_ROLES) {
    for (let i = 0; i < perRole; i += 1) {
      const rating = clamp(Math.round(prestige * 0.55 + 22 + (random() - 0.5) * 34), 40, 95);
      candidates.push({
        id: `staff-${seed}-${role}-${i}`,
        name: {
          first: LACROSSE_FIRST_NAMES[Math.floor(random() * LACROSSE_FIRST_NAMES.length)]!,
          last: LACROSSE_LAST_NAMES[Math.floor(random() * LACROSSE_LAST_NAMES.length)]!,
        },
        role,
        rating,
        salary: staffSalary(rating),
        yearsLeft: 2 + Math.floor(random() * 3),
      });
    }
  }
  return candidates;
}

/** A starting staff in line with the program: the best affordable candidate per role. */
export function generateStartingStaff(team: LacrosseTeam, seed: number): LacrosseStaff {
  const pool = generateStaffCandidates({ seed, prestige: team.reputation.coachingPrestige, perRole: 4 });
  const budget = staffBudgetFor(team.reputation.nationalPrestige);
  const staff: LacrosseStaff = {};
  for (const role of STAFF_ROLES) {
    const perRoleBudget = budget / STAFF_ROLES.length;
    const options = pool.filter((c) => c.role === role).sort((a, b) => b.rating - a.rating);
    staff[role] = options.find((c) => c.salary <= perRoleBudget) ?? options[options.length - 1]!;
  }
  return staff;
}

/** One season passes: contracts run down and expiring coaches leave. */
export function advanceStaffContracts(staff: LacrosseStaff): { staff: LacrosseStaff; departed: StaffMember[] } {
  const next: LacrosseStaff = {};
  const departed: StaffMember[] = [];
  for (const role of STAFF_ROLES) {
    const member = staff[role];
    if (!member) continue;
    if (member.yearsLeft <= 1) departed.push(member);
    else next[role] = { ...member, yearsLeft: member.yearsLeft - 1 };
  }
  return { staff: next, departed };
}

export type HireResult =
  | { ok: true; staff: LacrosseStaff; replaced?: StaffMember }
  | { ok: false; reason: string };

/** Hire a candidate into their role, replacing whoever holds it, if the payroll fits. */
export function hireStaffCandidate(staff: LacrosseStaff, candidate: StaffMember, budget: number): HireResult {
  const current = staff[candidate.role];
  const payroll = staffPayroll(staff) - (current?.salary ?? 0) + candidate.salary;
  if (payroll > budget) {
    return { ok: false, reason: `Payroll would be ${formatSalary(payroll)}, over the ${formatSalary(budget)} budget` };
  }
  return { ok: true, staff: { ...staff, [candidate.role]: candidate }, ...(current ? { replaced: current } : {}) };
}

export function releaseStaffMember(staff: LacrosseStaff, role: StaffRole): LacrosseStaff {
  const next = { ...staff };
  delete next[role];
  return next;
}

/**
 * The offseason staff cycle: contracts run down, expiring coaches enter the
 * pool asking for a raise, and a fresh set of candidates comes in.
 */
export function runStaffOffseason(
  staff: LacrosseStaff,
  { seed, prestige }: { seed: number; prestige: number },
): { staff: LacrosseStaff; departed: StaffMember[]; candidates: StaffMember[] } {
  const { staff: next, departed } = advanceStaffContracts(staff);
  const candidates = [...departed.map(reSigningCandidate), ...generateStaffCandidates({ seed, prestige })];
  return { staff: next, departed, candidates };
}

/**
 * Before the season starts the athletic department fills any empty chair with
 * the best candidate the remaining budget allows.
 */
export function fillStaffVacancies(
  staff: LacrosseStaff,
  candidates: StaffMember[],
  budget: number,
): { staff: LacrosseStaff; candidates: StaffMember[]; hired: StaffMember[] } {
  let next = staff;
  let pool = candidates;
  const hired: StaffMember[] = [];
  for (const role of STAFF_ROLES) {
    if (next[role]) continue;
    const pick = pool
      .filter((c) => c.role === role && staffPayroll(next) + c.salary <= budget)
      .sort((a, b) => b.rating - a.rating)[0];
    if (!pick) continue;
    next = { ...next, [role]: pick };
    pool = pool.filter((c) => c.id !== pick.id);
    hired.push(pick);
  }
  return { staff: next, candidates: pool, hired };
}

export function formatSalary(amount: number): string {
  return `$${Math.round(amount / 1_000)}k`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
