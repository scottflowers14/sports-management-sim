import type { LacrosseTeam } from './models';

/**
 * Offseason program investments, in the spirit of OOTP's budget screen and
 * College Football's program upgrades: the athletic department hands each
 * program a few points to spend, and every point goes to one rating.
 */
export type InvestmentProject = 'facilities' | 'fans' | 'academics';

export const INVESTMENT_PROJECTS: InvestmentProject[] = ['facilities', 'fans', 'academics'];

export const INVESTMENT_PROJECT_INFO: Record<InvestmentProject, { title: string; effect: string; cost: number; gain: number }> = {
  facilities: {
    title: 'Facility upgrades',
    effect: 'Lifts recruiting pull and campus visits. Facilities lose a point a year without upkeep.',
    cost: 3,
    gain: 3,
  },
  fans: {
    title: 'Fan engagement',
    effect: 'A louder home crowd and a bigger budget next year.',
    cost: 2,
    gain: 2,
  },
  academics: {
    title: 'Academic support',
    effect: 'Raises academic prestige for recruits who care about the classroom.',
    cost: 4,
    gain: 2,
  },
};

export type InvestmentPlan = Partial<Record<InvestmentProject, number>>;

/** A ratings cap, so no program buys its way to a perfect score. */
const RATING_CAP = 99;
/** Facilities age a point a year. */
const FACILITY_WEAR = 1;
/** Fans drift a tenth of the way toward the program's recent success each year. */
const FAN_DRIFT = 0.1;

/**
 * Points the athletic department hands out: bigger, louder programs get more,
 * plus whatever last season's gate receipts earned.
 */
export function investmentBudget(team: LacrosseTeam, gateBonus = 0): number {
  return Math.round(3 + team.reputation.nationalPrestige / 20 + team.reputation.fanSupport / 25) + gateBonus;
}

export function planCost(plan: InvestmentPlan): number {
  return INVESTMENT_PROJECTS.reduce((sum, project) => sum + (plan[project] ?? 0) * INVESTMENT_PROJECT_INFO[project].cost, 0);
}

/** Funds one more round of a project if the budget allows; the plan is unchanged otherwise. */
export function fundProject(plan: InvestmentPlan, project: InvestmentProject, budget: number): InvestmentPlan {
  const next = { ...plan, [project]: (plan[project] ?? 0) + 1 };
  return planCost(next) <= budget ? next : plan;
}

export function unfundProject(plan: InvestmentPlan, project: InvestmentProject): InvestmentPlan {
  const count = plan[project] ?? 0;
  if (count <= 0) return plan;
  const next = { ...plan };
  if (count === 1) delete next[project];
  else next[project] = count - 1;
  return next;
}

export function applyInvestmentPlan(team: LacrosseTeam, plan: InvestmentPlan): LacrosseTeam {
  const gain = (project: InvestmentProject) => (plan[project] ?? 0) * INVESTMENT_PROJECT_INFO[project].gain;
  const rep = team.reputation;
  return {
    ...team,
    reputation: {
      ...rep,
      facilities: Math.min(RATING_CAP, rep.facilities + gain('facilities')),
      fanSupport: Math.min(RATING_CAP, rep.fanSupport + gain('fans')),
      academicPrestige: Math.min(RATING_CAP, rep.academicPrestige + gain('academics')),
    },
  };
}

/** The year passing: facilities wear, and fans follow how the program has been doing. */
export function ageProgram(team: LacrosseTeam): LacrosseTeam {
  const rep = team.reputation;
  return {
    ...team,
    reputation: {
      ...rep,
      facilities: Math.max(1, rep.facilities - FACILITY_WEAR),
      fanSupport: Math.round(rep.fanSupport + (rep.recentSuccess - rep.fanSupport) * FAN_DRIFT),
    },
  };
}

/**
 * A CPU athletic department keeps facilities, then fan support, in line with
 * the program's standing, and banks the rest.
 */
export function cpuInvestmentPlan(team: LacrosseTeam, gateBonus = 0): InvestmentPlan {
  const budget = investmentBudget(team, gateBonus);
  const target = team.reputation.nationalPrestige;
  let plan: InvestmentPlan = {};
  const fundToward = (project: 'facilities' | 'fans', current: number) => {
    let rating = current;
    while (rating < target) {
      const next = fundProject(plan, project, budget);
      if (next === plan) return;
      plan = next;
      rating += INVESTMENT_PROJECT_INFO[project].gain;
    }
  };
  fundToward('facilities', team.reputation.facilities);
  fundToward('fans', team.reputation.fanSupport);
  return plan;
}

/** e.g. "facilities 70 to 76, fan support 63 to 66". */
export function investmentSummary(before: LacrosseTeam, after: LacrosseTeam): string {
  const lines: string[] = [];
  const add = (label: string, from: number, to: number) => {
    if (to !== from) lines.push(`${label} ${from} to ${to}`);
  };
  add('facilities', before.reputation.facilities, after.reputation.facilities);
  add('fan support', before.reputation.fanSupport, after.reputation.fanSupport);
  add('academics', before.reputation.academicPrestige, after.reputation.academicPrestige);
  return lines.join(', ');
}

/**
 * How much a crowd is worth: a program with average fan support (63) gets
 * the standard home edge, a packed stadium more, an empty one less.
 */
export function fanHomeEdgeFactor(fanSupport: number): number {
  return Math.min(1.35, Math.max(0.65, 1 + (fanSupport - 63) / 100));
}
