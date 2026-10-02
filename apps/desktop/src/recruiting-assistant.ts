import {
  applyRecruitPitch,
  recruitPrestigeMultiplier,
  sortRecruitBoardForTeam,
  topRecruitMotivations,
  type RecruitBoardEntry,
  type RecruitMotivation,
} from '@sports-management-sim/engine-core';
import type { LacrossePlayerTraits, LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { RecruitingActivity } from './recruiting-activity';
import type { WeekSimState } from './week-sim';
import { getScoutTier, HOURS_COST, scoutRecruit, spendRecruitingHours, type ScoutingState } from './scouting';

type BoardEntry = RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>;
type LacrosseRecruit = BoardEntry['recruit'];

export type AssistantAction =
  | { type: 'pitch'; recruitId: string; name: string; motivation: RecruitMotivation; interestChange: number }
  | { type: 'scout'; recruitId: string; name: string; tier: 'partial' | 'full' };

/** Pinned targets the staff can't land on pitches alone: the coach still has to offer. */
export interface AssistantNeedsOffer {
  recruitId: string;
  name: string;
}

export interface AssistantReport {
  actions: AssistantAction[];
  needsOffer: AssistantNeedsOffer[];
}

export interface AssistantInput {
  /** The user's board, already sorted best-fit first. */
  recruitBoard: BoardEntry[];
  recruits: LacrosseRecruit[];
  shortlistIds: string[];
  scouting: ScoutingState;
  activity: RecruitingActivity;
  userTeam: LacrosseTeam;
  random: () => number;
}

export interface AssistantResult {
  recruits: LacrosseRecruit[];
  scouting: ScoutingState;
  activity: RecruitingActivity;
  actions: AssistantAction[];
  needsOffer: AssistantNeedsOffer[];
}

/**
 * The recruiting coordinator spends whatever hours are left this week, the way
 * a staff assistant would in a management sim:
 *
 * 1. Pitch every open recruit we've offered or pinned, using the motivation
 *    scouting already revealed (never a blind pitch, never a 2h flip pitch).
 * 2. Finish scouting pinned recruits.
 * 3. Take a first look at the best-fit unscouted recruits on the board.
 *
 * It never makes scholarship offers or schedules visits: money and visit
 * slots stay the head coach's call.
 */
export function runRecruitingAssistant(input: AssistantInput): AssistantResult {
  const { userTeam, random } = input;
  const teamId = userTeam.id;
  let scouting = input.scouting;
  let activity = input.activity;
  const recruitsById = new Map(input.recruits.map((r) => [r.id, r]));
  const actions: AssistantAction[] = [];
  const shortlist = new Set(input.shortlistIds);
  const nameOf = (r: LacrosseRecruit) => `${r.name.first} ${r.name.last}`;

  const boardOrder = input.recruitBoard.map((e) => e.recruit.id);
  const ordered = boardOrder.map((id) => recruitsById.get(id)).filter((r): r is LacrosseRecruit => r !== undefined);
  const isOpen = (r: LacrosseRecruit) => r.status === 'open';
  const weOffered = (r: LacrosseRecruit) => r.scholarshipOffers.some((o) => o.teamId === teamId);

  // 1. Pitches: targets we've invested in, best fit first.
  for (const recruit of ordered) {
    if (scouting.pointsAvailable < HOURS_COST.pitch) break;
    if (!isOpen(recruit) || !(weOffered(recruit) || shortlist.has(recruit.id))) continue;
    if (activity.pitchedIds.includes(recruit.id)) continue;
    const tier = getScoutTier(recruit.id, scouting);
    if (tier === 'none') continue;
    const motivation = topRecruitMotivations(recruit.preferences, 1)[0];
    if (!motivation) continue;
    const spent = spendRecruitingHours(scouting, HOURS_COST.pitch);
    if (!spent) break;
    const outcome = applyRecruitPitch(
      recruit,
      teamId,
      motivation,
      recruitPrestigeMultiplier(recruit.starRating, userTeam.reputation.nationalPrestige),
    );
    recruitsById.set(recruit.id, outcome.recruit);
    scouting = spent;
    activity = { ...activity, pitchedIds: [...activity.pitchedIds, recruit.id] };
    actions.push({ type: 'pitch', recruitId: recruit.id, name: nameOf(recruit), motivation, interestChange: outcome.interestChange });
  }

  const scout = (recruit: LacrosseRecruit): boolean => {
    if (scouting.pointsAvailable < HOURS_COST.scout) return false;
    const before = getScoutTier(recruit.id, scouting);
    if (before === 'full') return true;
    scouting = scoutRecruit(scouting, recruit.id, recruit.ratings.overall, random);
    actions.push({ type: 'scout', recruitId: recruit.id, name: nameOf(recruit), tier: before === 'none' ? 'partial' : 'full' });
    return true;
  };

  // 2. Finish scouting pinned or offered targets (partial -> full reveals a second motivation).
  for (const recruit of ordered) {
    if (scouting.pointsAvailable < HOURS_COST.scout) break;
    if (!isOpen(recruit) || !(shortlist.has(recruit.id) || weOffered(recruit))) continue;
    while (getScoutTier(recruit.id, scouting) !== 'full' && scout(recruit)) {
      // keep going until fully scouted or out of hours
    }
  }

  // 3. First looks at the best-fit open recruits nobody has scouted yet.
  for (const recruit of ordered) {
    if (scouting.pointsAvailable < HOURS_COST.scout) break;
    if (!isOpen(recruit) || getScoutTier(recruit.id, scouting) !== 'none') continue;
    scout(recruit);
  }

  const needsOffer = ordered
    .filter((r) => isOpen(r) && shortlist.has(r.id) && !weOffered(r))
    .map((r) => ({ recruitId: r.id, name: nameOf(r) }));

  return {
    recruits: input.recruits.map((r) => recruitsById.get(r.id) ?? r),
    scouting,
    activity,
    actions,
    needsOffer,
  };
}

export function summarizeAssistantActions(actions: AssistantAction[]): string {
  if (actions.length === 0) return 'Assistant had nothing to do this week';
  const pitches = actions.filter((a) => a.type === 'pitch').length;
  const scouts = actions.filter((a) => a.type === 'scout').length;
  const parts = [
    pitches > 0 ? `${pitches} pitch${pitches === 1 ? '' : 'es'}` : null,
    scouts > 0 ? `${scouts} scouting report${scouts === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return `Assistant spent the week's hours: ${parts.join(', ')}`;
}

/**
 * Run the assistant against a week-sim snapshot, so auto-recruiting can spend
 * each week's hours before that week is simulated (including during Sim to End).
 */
export function applyAssistantToWeekState<S extends WeekSimState>(
  state: S,
  shortlistIds: string[],
  random: () => number = Math.random,
): { state: S; report: AssistantReport } {
  const { dynasty } = state;
  const userTeam = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
  if (!userTeam) return { state, report: { actions: [], needsOffer: [] } };
  const result = runRecruitingAssistant({
    recruitBoard: dynasty.recruitBoard,
    recruits: dynasty.recruits,
    shortlistIds,
    scouting: state.scouting,
    activity: state.recruitingActivity,
    userTeam,
    random,
  });
  const report = { actions: result.actions, needsOffer: result.needsOffer };
  if (result.actions.length === 0) return { state, report };
  const recruitBoard = sortRecruitBoardForTeam(userTeam, result.recruits, dynasty.rosterTargets);
  return {
    state: {
      ...state,
      dynasty: { ...dynasty, recruits: result.recruits, recruitBoard },
      scouting: result.scouting,
      recruitingActivity: result.activity,
    },
    report,
  };
}
