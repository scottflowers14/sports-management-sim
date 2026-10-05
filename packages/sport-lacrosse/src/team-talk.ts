import type { CoachingEdge } from './staff';

export type TeamTalkTone = 'calm' | 'fire_up' | 'no_pressure' | 'demand_more';

export const TEAM_TALK_TONES: TeamTalkTone[] = ['calm', 'fire_up', 'no_pressure', 'demand_more'];

export const TEAM_TALK_LABELS: Record<TeamTalkTone, string> = {
  calm: 'Stay composed',
  fire_up: 'Fire them up',
  no_pressure: 'No pressure, just play',
  demand_more: 'Demand a statement win',
};

export const TEAM_TALK_LINES: Record<TeamTalkTone, string> = {
  calm: '"Trust the plan. Win your matchup and the scoreboard takes care of itself."',
  fire_up: '"Nobody outside this room thinks we win today. Go prove them wrong."',
  no_pressure: '"All the pressure is on them. Go have fun and play fast."',
  demand_more: '"Beating them isn\'t enough. I want sixty minutes of our best."',
};

export type TeamTalkReaction = 'positive' | 'neutral' | 'negative';

export interface TeamTalkContext {
  /** The user's pregame win probability, 0-100. */
  winProbability: number;
  rivalry: boolean;
}

export interface TeamTalkResult {
  reaction: TeamTalkReaction;
  /** Added to the user's coaching edge for this game only. */
  edge: CoachingEdge;
}

/** A positive reaction is worth about a 20-point coordinator upgrade on one side of the ball. */
const BIG = 0.008;
const SMALL = 0.003;
const HURT = -0.004;

/**
 * How the room takes a pregame talk. Underdogs and rivalry games feed off
 * emotion; favorites respond to being pushed and go flat when told to relax.
 * Composure always helps a little on defense and never backfires.
 */
export function teamTalkResult(tone: TeamTalkTone, context: TeamTalkContext): TeamTalkResult {
  const underdog = context.winProbability < 45;
  const favorite = context.winProbability > 60;
  switch (tone) {
    case 'calm':
      return { reaction: 'neutral', edge: { offense: 0, defense: SMALL } };
    case 'fire_up':
      return underdog || context.rivalry
        ? { reaction: 'positive', edge: { offense: BIG, defense: SMALL } }
        : { reaction: 'neutral', edge: { offense: SMALL, defense: 0 } };
    case 'no_pressure':
      if (underdog) return { reaction: 'positive', edge: { offense: BIG, defense: 0 } };
      return favorite
        ? { reaction: 'negative', edge: { offense: HURT, defense: HURT } }
        : { reaction: 'neutral', edge: { offense: SMALL, defense: 0 } };
    case 'demand_more':
      if (favorite) return { reaction: 'positive', edge: { offense: BIG, defense: SMALL } };
      return underdog
        ? { reaction: 'negative', edge: { offense: HURT, defense: 0 } }
        : { reaction: 'neutral', edge: { offense: 0, defense: SMALL } };
  }
}

export function addCoachingEdge(a: CoachingEdge, b: CoachingEdge): CoachingEdge {
  return { offense: a.offense + b.offense, defense: a.defense + b.defense };
}
