export interface CoachProfile {
  name: string;
  tenureSeasons: number;
  contractYearsRemaining: number;
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

export function generateSeasonGoals(prestige: number, year: number): SeasonGoals {
  let winTarget: number;
  let confChampGoal: boolean;
  let rankingGoal: number | null;
  let recruitClassGoal: number;

  if (prestige >= 80) {
    winTarget = 11;
    confChampGoal = true;
    rankingGoal = 5;
    recruitClassGoal = 8;
  } else if (prestige >= 65) {
    winTarget = 9;
    confChampGoal = true;
    rankingGoal = 15;
    recruitClassGoal = 6;
  } else if (prestige >= 50) {
    winTarget = 7;
    confChampGoal = false;
    rankingGoal = 25;
    recruitClassGoal = 5;
  } else {
    winTarget = 5;
    confChampGoal = false;
    rankingGoal = null;
    recruitClassGoal = 4;
  }

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

export function updateADConfidence(
  currentConfidence: number,
  evaluatedGoals: SeasonGoals,
  isNatChamp: boolean,
  profile: CoachProfile,
): { confidence: number; events: ADConfidenceEvent[] } {
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

  // Tenure honeymoon: slight boost in early years
  if (profile.tenureSeasons <= 2 && delta < 0) {
    const honeymoon = Math.ceil(Math.abs(delta) * 0.3);
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
