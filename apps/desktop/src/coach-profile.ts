import type { CoachAbilities, CoachXpAward } from './coach-abilities';

export interface CoachProfile {
  name: string;
  tenureSeasons: number;
  contractYearsRemaining: number;
  /** Career coaching XP; missing on older saves, which start at one point. */
  xp?: number;
  abilities?: CoachAbilities;
  /** The XP earned in the most recent season, itemized. */
  lastXpAward?: CoachXpAward;
}

export interface SeasonGoal {
  id: string;
  description: string;
  achieved: boolean | null; // null = in progress
}

export interface SeasonGoals {
  year: number;
  goals: SeasonGoal[];
  winTarget: number;
  confChampGoal: boolean;
  rankingGoal: number | null; // top-N national rank required, null = no ranking goal
  recruitClassGoal: number;   // minimum signing class size
}

export interface ADConfidenceEvent {
  description: string;
  delta: number;
}

const FIRST_NAMES = [
  'Bill', 'John', 'Mike', 'Dave', 'Tom', 'Chris', 'Matt', 'Jim', 'Bob', 'Dan',
  'Steve', 'Kevin', 'Mark', 'Scott', 'Eric', 'Brian', 'Jeff', 'Ryan', 'Kyle', 'Paul',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
  'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Garcia', 'Martinez', 'Robinson',
];

function seededPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

export function generateCoachName(seed: number): string {
  const first = seededPick(FIRST_NAMES, seed);
  const last = seededPick(LAST_NAMES, seed + 7);
  return `${first} ${last}`;
}

export function createCoachProfile(name: string): CoachProfile {
  return { name, tenureSeasons: 0, contractYearsRemaining: 5 };
}

export function advanceCoachTenure(profile: CoachProfile): CoachProfile {
  return {
    ...profile,
    tenureSeasons: profile.tenureSeasons + 1,
    contractYearsRemaining: Math.max(0, profile.contractYearsRemaining - 1),
  };
}

export function extendCoachContract(profile: CoachProfile, years = 3): CoachProfile {
  return { ...profile, contractYearsRemaining: profile.contractYearsRemaining + years };
}

/** AD confidence at which the AD offers a new deal ("On Extension Watch"). */
export const EXTENSION_CONFIDENCE = 80;
/** A full new deal runs this long. */
export const FULL_CONTRACT_YEARS = 5;

export type ContractDecision =
  /** Rewarded with a fresh full-length deal. */
  | 'extended'
  /** Expiring, secure but not starring: a shorter renewal. */
  | 'renewed'
  /** Expiring under scrutiny: one more year to prove it. */
  | 'prove-it'
  /** Expiring on the hot seat: the AD lets the deal run out. */
  | 'not-renewed';

export interface ContractReview {
  profile: CoachProfile;
  decision: ContractDecision | null;
  /** Years added to the contract by this review. */
  yearsAdded: number;
}

/**
 * The AD's offseason look at the coach's contract, after the tenure year has
 * ticked off. A coach on extension watch gets a new full deal once two years or
 * fewer remain, unless the season just played was a losing one. An expiring deal is renewed, cut to a one-year prove-it deal,
 * or left to run out, depending on confidence.
 */
export function reviewCoachContract(
  profile: CoachProfile,
  confidence: number,
  record?: { wins: number; losses: number },
): ContractReview {
  const left = profile.contractYearsRemaining;
  // No AD hands out a new long deal straight off a losing season.
  const winningSeason = !record || record.wins >= record.losses;
  if (confidence >= EXTENSION_CONFIDENCE && left <= 2 && winningSeason) {
    const yearsAdded = FULL_CONTRACT_YEARS - left;
    return { profile: extendCoachContract(profile, yearsAdded), decision: 'extended', yearsAdded };
  }
  if (left > 0) return { profile, decision: null, yearsAdded: 0 };
  if (confidence >= 60) return { profile: extendCoachContract(profile, 3), decision: 'renewed', yearsAdded: 3 };
  if (confidence >= 40) return { profile: extendCoachContract(profile, 1), decision: 'prove-it', yearsAdded: 1 };
  return { profile, decision: 'not-renewed', yearsAdded: 0 };
}

/** News headline for a contract decision, or null when nothing changed. */
export function contractNewsHeadline(review: ContractReview, teamName: string, seasonYear: number): string | null {
  const { name, contractYearsRemaining } = review.profile;
  const through = seasonYear + contractYearsRemaining;
  switch (review.decision) {
    case 'extended':
      return `${teamName} extends ${name} through ${through}, a ${FULL_CONTRACT_YEARS}-year deal`;
    case 'renewed':
      return `${teamName} renews ${name}'s contract through ${through}`;
    case 'prove-it':
      return `${teamName} gives ${name} a one-year deal: show progress in ${seasonYear + 1} or move on`;
    case 'not-renewed':
      return `${teamName} will not renew ${name}'s expiring contract`;
    default:
      return null;
  }
}

export const DEFAULT_GOAL_SCHEDULE_LENGTH = 12;

/** Where the preseason poll picked the program in its conference. */
export interface SeasonOutlook {
  pickedFinish: number;
  conferenceSize: number;
}

/**
 * The AD's goals for the season. Prestige sets the bar; the preseason pick
 * moves it, so a program picked last in a rebuild isn't held to the same
 * standard as one picked to win the league.
 */
export function generateSeasonGoals(
  prestige: number,
  year: number,
  scheduledGames = DEFAULT_GOAL_SCHEDULE_LENGTH,
  outlook?: SeasonOutlook,
): SeasonGoals {
  let winFraction: number;
  let confChampGoal: boolean;
  let rankingGoal: number | null;
  let recruitClassGoal: number;

  if (prestige >= 80) {
    winFraction = 0.75;
    confChampGoal = true;
    rankingGoal = 5;
    recruitClassGoal = 8;
  } else if (prestige >= 65) {
    winFraction = 0.6;
    confChampGoal = true;
    rankingGoal = 15;
    recruitClassGoal = 6;
  } else if (prestige >= 50) {
    winFraction = 0.45;
    confChampGoal = false;
    rankingGoal = 25;
    recruitClassGoal = 5;
  } else {
    winFraction = 0.3;
    confChampGoal = false;
    rankingGoal = null;
    recruitClassGoal = 4;
  }

  if (outlook && outlook.conferenceSize > 1) {
    // 0 for the favorite, 1 for the team picked last.
    const pick = (outlook.pickedFinish - 1) / (outlook.conferenceSize - 1);
    winFraction = Math.min(0.85, Math.max(0.2, winFraction + (0.5 - pick) * 0.3));
    if (outlook.pickedFinish === 1) confChampGoal = true;
    else if (pick > 0.4) confChampGoal = false;
    if (pick > 0.6 && rankingGoal !== null) rankingGoal = rankingGoal <= 15 ? 25 : null;
  }

  // Win targets scale to the games actually on the schedule
  const games = Math.max(1, scheduledGames);
  const winTarget = Math.min(games, Math.max(1, Math.round(games * winFraction)));

  const goals: SeasonGoal[] = [
    { id: 'wins', description: `Win ${winTarget}+ games`, achieved: null },
    ...(confChampGoal
      ? [{ id: 'conf_champ', description: 'Win conference title', achieved: null }]
      : []),
    ...(rankingGoal !== null
      ? [{ id: 'ranking', description: `Reach top ${rankingGoal} nationally`, achieved: null }]
      : []),
    { id: 'recruiting', description: `Sign ${recruitClassGoal}+ recruits`, achieved: null },
  ];

  return { year, goals, winTarget, confChampGoal, rankingGoal, recruitClassGoal };
}

export function evaluateSeasonGoals(
  goals: SeasonGoals,
  record: { wins: number; losses: number },
  bestNatRank: number | null,
  isConfChamp: boolean,
  recruitClassSize: number,
): SeasonGoals {
  const evaluated = goals.goals.map((goal) => {
    switch (goal.id) {
      case 'wins':
        return { ...goal, achieved: record.wins >= goals.winTarget };
      case 'conf_champ':
        return { ...goal, achieved: isConfChamp };
      case 'ranking':
        return {
          ...goal,
          achieved: goals.rankingGoal !== null && bestNatRank !== null
            ? bestNatRank <= goals.rankingGoal
            : false,
        };
      case 'recruiting':
        return { ...goal, achieved: recruitClassSize >= goals.recruitClassGoal };
      default:
        return goal;
    }
  });
  return { ...goals, goals: evaluated };
}

/** What the AD knows beyond the goals: last year's wins and the preseason pick. */
export interface ConfidenceContext {
  wins?: number;
  previousWins?: number;
  pickedFinish?: number;
  confFinish?: number;
}

/** AD confidence for a coach's first day on the job: "Secure", with a little room. */
export const STARTING_AD_CONFIDENCE = 65;

export function updateADConfidence(
  currentConfidence: number,
  evaluatedGoals: SeasonGoals,
  isNatChamp: boolean,
  profile: CoachProfile,
  context?: ConfidenceContext,
): { confidence: number; events: ADConfidenceEvent[] } {
  const wins = context?.wins;
  const events: ADConfidenceEvent[] = [];
  let delta = 0;

  for (const goal of evaluatedGoals.goals) {
    if (goal.achieved === null) continue;
    if (goal.id === 'wins') {
      if (goal.achieved) {
        events.push({ description: `Met win target (${evaluatedGoals.winTarget}+ wins)`, delta: 8 });
        delta += 8;
      } else {
        events.push({ description: `Fell short of win target (${evaluatedGoals.winTarget}+ wins)`, delta: -10 });
        delta -= 10;
      }
    } else if (goal.id === 'conf_champ') {
      if (goal.achieved) {
        events.push({ description: 'Won conference championship', delta: 12 });
        delta += 12;
      } else {
        events.push({ description: 'Did not win conference title', delta: -8 });
        delta -= 8;
      }
    } else if (goal.id === 'ranking') {
      if (goal.achieved) {
        events.push({ description: `Reached top ${evaluatedGoals.rankingGoal} nationally`, delta: 6 });
        delta += 6;
      } else {
        events.push({ description: `Did not crack top ${evaluatedGoals.rankingGoal}`, delta: -4 });
        delta -= 4;
      }
    } else if (goal.id === 'recruiting') {
      if (goal.achieved) {
        events.push({ description: 'Strong recruiting class', delta: 5 });
        delta += 5;
      } else {
        events.push({ description: 'Underwhelming recruiting class', delta: -3 });
        delta -= 3;
      }
    }
  }

  if (isNatChamp) {
    events.push({ description: 'National championship!', delta: 20 });
    delta += 20;
  }

  // A program on the way up earns patience even when it misses the targets.
  if (context?.previousWins !== undefined && wins !== undefined) {
    const change = wins - context.previousWins;
    if (change >= 2) {
      events.push({ description: `Improved by ${change} wins`, delta: 5 });
      delta += 5;
    } else if (change <= -3) {
      events.push({ description: `Slipped by ${-change} wins`, delta: -5 });
      delta -= 5;
    }
  }
  if (context?.pickedFinish !== undefined && context.confFinish !== undefined) {
    const beat = context.pickedFinish - context.confFinish;
    if (beat >= 2) {
      events.push({ description: `Finished ${beat} spots above the preseason pick`, delta: 4 });
      delta += 4;
    } else if (beat <= -3) {
      events.push({ description: `Finished ${-beat} spots below the preseason pick`, delta: -3 });
      delta -= 3;
    }
  }

  // Tenure honeymoon: the first two seasons forgive half of the bad news, the
  // third a third of it. A rebuild needs time on a five-year deal.
  if (profile.tenureSeasons <= 2 && delta < 0) {
    const share = profile.tenureSeasons <= 1 ? 0.5 : 0.3;
    const honeymoon = Math.ceil(Math.abs(delta) * share);
    events.push({ description: 'Early tenure grace period', delta: honeymoon });
    delta += honeymoon;
  }

  const confidence = Math.min(100, Math.max(0, currentConfidence + delta));
  return { confidence, events };
}

export interface JobOffer {
  teamId: string;
  teamName: string;
  prestige: number;
  contractYears: number;
}

/**
 * Fired when confidence collapses. Early-tenure coaches only lose their job
 * on a total collapse; established coaches are out once the AD loses faith.
 */
export function shouldFireCoach(confidence: number, tenureSeasons: number): boolean {
  if (confidence <= 5) return true;
  return tenureSeasons >= 3 && confidence < 20;
}

export function generateJobOffers(
  teams: { id: string; name: string; reputation: { nationalPrestige: number } }[],
  firedFromTeamId: string,
  seed: number,
): JobOffer[] {
  const candidates = teams
    .filter((team) => team.id !== firedFromTeamId)
    .sort((a, b) => a.reputation.nationalPrestige - b.reputation.nationalPrestige);

  // A fired coach restarts at modest programs: offers come from the bottom half
  const pool = candidates.slice(0, Math.max(3, Math.ceil(candidates.length / 2)));

  const offers: JobOffer[] = [];
  let state = Math.abs(seed) >>> 0;
  const nextRandom = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const remaining = [...pool];
  while (offers.length < 3 && remaining.length > 0) {
    const idx = Math.floor(nextRandom() * remaining.length);
    const team = remaining.splice(idx, 1)[0]!;
    offers.push({
      teamId: team.id,
      teamName: team.name,
      prestige: team.reputation.nationalPrestige,
      contractYears: 4,
    });
  }

  return offers.sort((a, b) => b.prestige - a.prestige);
}

export function getJobSecurityLabel(confidence: number): string {
  if (confidence >= 80) return 'On Extension Watch';
  if (confidence >= 60) return 'Secure';
  if (confidence >= 40) return 'Under Scrutiny';
  if (confidence >= 20) return 'Hot Seat';
  return 'Buyout Imminent';
}

export function getJobSecurityColor(confidence: number): string {
  if (confidence >= 80) return '#72f2c6';
  if (confidence >= 60) return '#a8d8a8';
  if (confidence >= 40) return '#f2c472';
  if (confidence >= 20) return '#f28472';
  return '#f24c4c';
}
