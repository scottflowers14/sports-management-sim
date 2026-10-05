import type { ScheduledGame } from '@sports-management-sim/engine-core';

/**
 * The postgame press conference, in the spirit of Football Manager: one
 * question about the game just played, and the answer moves the locker room,
 * the athletic director or the recruiting trail.
 */
export type PressTopic = 'rivalry_win' | 'upset_win' | 'blowout_win' | 'win' | 'rivalry_loss' | 'upset_loss' | 'blowout_loss' | 'loss';

export interface PressEffects {
  /** Added to every player's morale. */
  morale: number;
  /** Added to the AD's confidence. */
  adConfidence: number;
  /** Added to our interest with every open recruit we have offered or pinned. */
  recruitBuzz: number;
}

export interface PressAnswer {
  id: string;
  label: string;
  quote: string;
  effects: PressEffects;
}

export interface PressQuestion {
  gameId: string;
  week: number;
  topic: PressTopic;
  question: string;
  answers: PressAnswer[];
}

export interface PressGameContext {
  game: ScheduledGame;
  userTeamId: string;
  opponentName: string;
  /** Team overall ratings going in; an upset is a win or loss against the grain by 4+. */
  userOverall: number;
  opponentOverall: number;
  rivalry: boolean;
}

const UPSET_GAP = 4;
const BLOWOUT_MARGIN = 7;

export function pressTopic(ctx: PressGameContext): PressTopic | null {
  const result = ctx.game.result;
  if (!result) return null;
  const won = result.winnerTeamId === ctx.userTeamId;
  const margin = Math.abs(result.homeScore - result.awayScore);
  const gap = ctx.opponentOverall - ctx.userOverall;
  if (won) {
    if (ctx.rivalry) return 'rivalry_win';
    if (gap >= UPSET_GAP) return 'upset_win';
    if (margin >= BLOWOUT_MARGIN) return 'blowout_win';
    return 'win';
  }
  if (ctx.rivalry) return 'rivalry_loss';
  if (-gap >= UPSET_GAP) return 'upset_loss';
  if (margin >= BLOWOUT_MARGIN) return 'blowout_loss';
  return 'loss';
}

const fx = (morale: number, adConfidence: number, recruitBuzz: number): PressEffects => ({ morale, adConfidence, recruitBuzz });

export function pressConferenceFor(ctx: PressGameContext): PressQuestion | null {
  const topic = pressTopic(ctx);
  if (!topic) return null;
  const opp = ctx.opponentName;
  const won = topic.endsWith('_win') || topic === 'win';
  // Rivalry games carry double the stakes.
  const stakes = topic.startsWith('rivalry') ? 2 : 1;
  const scale = (e: PressEffects): PressEffects => fx(e.morale * stakes, e.adConfidence * stakes, e.recruitBuzz * stakes);

  const questions: Record<PressTopic, string> = {
    rivalry_win: `The trophy stays with you after beating ${opp}. What does this rivalry mean to your program?`,
    upset_win: `Nobody expected you to beat ${opp}. Is this a statement win?`,
    blowout_win: `That was lopsided against ${opp}. Did anything worry you?`,
    win: `A hard-fought win over ${opp}. What made the difference?`,
    rivalry_loss: `Losing to ${opp} has to sting. What do you say to your fans?`,
    upset_loss: `You were favored against ${opp}. What went wrong?`,
    blowout_loss: `${opp} ran away with that one. Where does your team go from here?`,
    loss: `A close loss to ${opp}. What decided it?`,
  };

  const answers: PressAnswer[] = won
    ? [
        { id: 'credit', label: 'Credit the players', quote: 'This is all on the guys in that locker room. They earned it.', effects: scale(fx(4, 0, 0)) },
        { id: 'sell', label: 'Sell the program', quote: 'This is what we are building here. Recruits should be watching.', effects: scale(fx(0, 1, 3)) },
        { id: 'humble', label: 'Stay humble', quote: 'One game. We have a lot to clean up before next week.', effects: scale(fx(-1, 3, 0)) },
      ]
    : [
        { id: 'blame', label: 'Take the blame', quote: "That's on me. I didn't have them ready.", effects: scale(fx(3, -2, 0)) },
        { id: 'callout', label: 'Call out the effort', quote: "That effort isn't good enough for this program, and they know it.", effects: scale(fx(-4, 3, 0)) },
        { id: 'credit', label: 'Credit the opponent', quote: `Tip your cap to ${opp}. They made the plays.`, effects: scale(fx(1, 0, 0)) },
      ];

  return { gameId: ctx.game.id, week: ctx.game.week, topic, question: questions[topic], answers };
}

export function describeEffects(e: PressEffects): string {
  const parts: string[] = [];
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (e.morale !== 0) parts.push(`${signed(e.morale)} morale`);
  if (e.adConfidence !== 0) parts.push(`${signed(e.adConfidence)} AD confidence`);
  if (e.recruitBuzz !== 0) parts.push(`${signed(e.recruitBuzz)} recruit interest`);
  return parts.length > 0 ? parts.join(', ') : 'No effect';
}
