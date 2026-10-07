/**
 * The first-season Coach's Checklist: a handful of steps that walk a new
 * coach through their first week, ticking off as they go.
 */

export interface CoachGuideState {
  /** The welcome note has been read. */
  welcomed: boolean;
  /** The checklist was closed for good. */
  dismissed: boolean;
  /** Screens opened while the checklist was showing. */
  visited: string[];
}

export const NEW_COACH_GUIDE: CoachGuideState = { welcomed: false, dismissed: false, visited: [] };

/** Saves from before the guide existed belong to coaches who don't need it. */
export const VETERAN_COACH_GUIDE: CoachGuideState = { welcomed: true, dismissed: true, visited: [] };

export interface GuideStep {
  id: string;
  label: string;
  detail: string;
  /** The screen that finishes the step. */
  nav: string;
  done: boolean;
}

export interface GuideProgress {
  captainCount: number;
  /** Scholarship offers the user has out to high school recruits. */
  offersOut: number;
  gamesPlayed: number;
  visited: readonly string[];
}

export function coachGuideSteps(p: GuideProgress): GuideStep[] {
  const seen = (view: string) => p.visited.includes(view);
  return [
    {
      id: 'roster',
      label: 'Meet your roster',
      detail: 'See who starts, who is hurt, and which young players to redshirt.',
      nav: 'team',
      done: seen('team'),
    },
    {
      id: 'captains',
      label: 'Name your captains',
      detail: 'Captains lift team morale every week. Pick them in the Locker Room.',
      nav: 'locker-room',
      done: p.captainCount > 0,
    },
    {
      id: 'recruit',
      label: 'Offer your first scholarship',
      detail: 'Next year’s class is built now. Scout a recruit at a position you need (1 hour), then make him an offer.',
      nav: 'recruiting',
      done: p.offersOut > 0,
    },
    {
      id: 'game-plan',
      label: 'Check the game plan',
      detail: 'The Season screen has this week’s scouting report and your tempo, defense and ride.',
      nav: 'season',
      done: seen('season'),
    },
    {
      id: 'play',
      label: 'Play your first game',
      detail: 'Sim the week, or Coach the Game to make halftime adjustments.',
      nav: 'week-hub',
      done: p.gamesPlayed > 0,
    },
  ];
}

/** The checklist shows through the first season until the coach closes it. */
export function showCoachGuide(state: CoachGuideState, seasonsCompleted: number): boolean {
  return !state.dismissed && seasonsCompleted === 0;
}

/** Records a screen visit while the checklist is open; unchanged otherwise. */
export function markGuideVisit(state: CoachGuideState, view: string): CoachGuideState {
  if (state.dismissed || state.visited.includes(view)) return state;
  return { ...state, visited: [...state.visited, view] };
}
