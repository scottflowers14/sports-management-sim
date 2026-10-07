import { INVESTMENT_PROJECTS, fundProject, planCost, type InvestmentPlan } from '@sports-management-sim/sport-lacrosse';

/** One line on the offseason to-do list. */
export interface OffseasonTodo {
  id: 'investments' | 'portal' | 'staff' | 'realignment';
  label: string;
  status: string;
  done: boolean;
  /** Worth a look, but skipping it costs nothing. */
  optional: boolean;
}

export interface OffseasonTodoInput {
  investmentBudget: number;
  investmentPlan: InvestmentPlan;
  portalAvailable: number;
  portalOffers: number;
  scholarshipRoom: number;
  vacantStaffRoles: readonly string[];
  realignmentPending: boolean;
}

/** Investment points that could still buy a project; anything left after that is too little to spend. */
export function spendableInvestmentPoints(budget: number, plan: InvestmentPlan): number {
  const left = budget - planCost(plan);
  return INVESTMENT_PROJECTS.some((p) => fundProject(plan, p, budget) !== plan) ? left : 0;
}

export function offseasonTodos(input: OffseasonTodoInput): OffseasonTodo[] {
  const todos: OffseasonTodo[] = [];
  if (input.realignmentPending) {
    todos.push({ id: 'realignment', label: 'Answer the conference invite', status: 'Waiting on your answer', done: false, optional: false });
  }
  const spent = planCost(input.investmentPlan);
  const spendable = spendableInvestmentPoints(input.investmentBudget, input.investmentPlan);
  todos.push({
    id: 'investments',
    label: 'Spend investment points',
    status: spendable > 0 ? `${spent} of ${input.investmentBudget} spent · ${spendable} left, lost if unspent` : `${spent} of ${input.investmentBudget} spent`,
    done: spendable === 0,
    optional: false,
  });
  if (input.vacantStaffRoles.length > 0) {
    todos.push({
      id: 'staff',
      label: 'Fill your staff',
      status: `No ${input.vacantStaffRoles.join(' or ')}`,
      done: false,
      optional: false,
    });
  }
  if (input.portalAvailable > 0) {
    todos.push({
      id: 'portal',
      label: 'Work the transfer portal',
      status:
        input.portalOffers > 0
          ? `${input.portalOffers} offer${input.portalOffers === 1 ? '' : 's'} out · ${input.scholarshipRoom.toFixed(2)} scholarships free`
          : `${input.portalAvailable} players available · ${input.scholarshipRoom.toFixed(2)} scholarships free`,
      done: input.portalOffers > 0 || input.scholarshipRoom < 0.25,
      optional: true,
    });
  }
  return todos;
}

/** What's still undone that the coach would regret skipping, for a warning before the season starts. */
export function startSeasonWarning(todos: readonly OffseasonTodo[], spendable: number): string | null {
  const parts: string[] = [];
  if (spendable > 0) parts.push(`You still have ${spendable} investment point${spendable === 1 ? '' : 's'}. Unspent points don't carry over.`);
  if (todos.some((t) => t.id === 'staff' && !t.done)) parts.push('A staff chair is empty; vacant chairs coach at a 45 rating.');
  if (todos.some((t) => t.id === 'realignment' && !t.done)) parts.push('The conference invite is unanswered; starting the season turns it down.');
  return parts.length > 0 ? parts.join(' ') : null;
}
