import {
  applyRecruitPitch,
  applyScholarshipOffer,
  classScholarshipBudgetUsed,
  recruitPrestigeMultiplier,
  sortRecruitBoardForTeam,
  suggestScholarshipOffers,
  type OfferSuggestion,
  topRecruitMotivations,
  type RecruitBoardEntry,
  type RecruitMotivation,
} from '@sports-management-sim/engine-core';
import { LACROSSE_CLASS_SCHOLARSHIP_BUDGET } from '@sports-management-sim/sport-lacrosse';
import type { LacrossePlayerTraits, LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { RecruitingActivity } from './recruiting-activity';
import type { WeekSimState } from './week-sim';
import { cpuRecruitingScale, userDecisionScale } from './difficulty';
import { landChance, TOSS_UP_AT } from './recruit-odds';
import { getScoutTier, HOURS_COST, scoutRecruit, spendRecruitingHours, type ScoutingState } from './scouting';

type BoardEntry = RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>;
type LacrosseRecruit = BoardEntry['recruit'];

export type AssistantAction =
  | { type: 'pitch'; recruitId: string; name: string; motivation: RecruitMotivation; interestChange: number }
  | { type: 'scout'; recruitId: string; name: string; tier: 'partial' | 'full' }
  | { type: 'offer'; recruitId: string; name: string; scholarshipPercent: number };

/** Pinned targets the staff can't land on pitches alone: the coach still has to offer. */
export interface AssistantNeedsOffer {
  recruitId: string;
  name: string;
}

export interface AssistantReport {
  actions: AssistantAction[];
  needsOffer: AssistantNeedsOffer[];
  /** Offers the coordinator recommends; the head coach decides. */
  suggestedOffers: Array<OfferSuggestion & { name: string; starRating: number }>;
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
  /** Scholarship equivalencies still free in this class; omit to skip offer suggestions. */
  budgetRemaining?: number;
  /** Skip offers to recruits we're unlikely to land (see recruit-odds.ts); defaults to every recruit. */
  isWinnable?: (recruitId: string) => boolean;
}

export interface AssistantResult {
  recruits: LacrosseRecruit[];
  scouting: ScoutingState;
  activity: RecruitingActivity;
  actions: AssistantAction[];
  needsOffer: AssistantNeedsOffer[];
  suggestedOffers: AssistantReport['suggestedOffers'];
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

  // Offer plan: scouting from this run counts, and nationally ranked recruits are known.
  const updatedRecruits = input.recruits.map((r) => recruitsById.get(r.id) ?? r);
  const updatedById = new Map(updatedRecruits.map((r) => [r.id, r]));
  const suggestedOffers =
    input.budgetRemaining === undefined
      ? []
      : suggestScholarshipOffers({
          team: userTeam,
          board: input.recruitBoard.map((e) => ({ ...e, recruit: updatedById.get(e.recruit.id) ?? e.recruit })),
          budgetRemaining: input.budgetRemaining,
          isKnown: (id) => getScoutTier(id, scouting) !== 'none' || (updatedById.get(id)?.starRating ?? 0) >= 4,
          ...(input.isWinnable ? { isWinnable: input.isWinnable } : {}),
        }).map((s) => {
          const r = updatedById.get(s.recruitId)!;
          return { ...s, name: nameOf(r), starRating: r.starRating };
        });
  const suggestedIds = new Set(suggestedOffers.map((s) => s.recruitId));

  const needsOffer = ordered
    .filter((r) => isOpen(r) && shortlist.has(r.id) && !weOffered(r) && !suggestedIds.has(r.id))
    .map((r) => ({ recruitId: r.id, name: nameOf(r) }));

  return {
    recruits: updatedRecruits,
    scouting,
    activity,
    actions,
    needsOffer,
    suggestedOffers,
  };
}

export function summarizeAssistantActions(actions: AssistantAction[]): string {
  if (actions.length === 0) return 'Assistant had nothing to do this week';
  const pitches = actions.filter((a) => a.type === 'pitch').length;
  const scouts = actions.filter((a) => a.type === 'scout').length;
  const offers = actions.filter((a) => a.type === 'offer').length;
  const parts = [
    offers > 0 ? `${offers} offer${offers === 1 ? '' : 's'}` : null,
    pitches > 0 ? `${pitches} pitch${pitches === 1 ? '' : 'es'}` : null,
    scouts > 0 ? `${scouts} scouting report${scouts === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return `Assistant spent the week's hours: ${parts.join(', ')}`;
}

export interface AssistantRunOptions {
  /** Plan scholarship offers against the class budget (shown to the coach). */
  suggestOffers?: boolean;
  /** Delegate offers too: make the suggested offers without asking. */
  autoOffer?: boolean;
}

/**
 * Run the assistant against a week-sim snapshot, so auto-recruiting can spend
 * each week's hours before that week is simulated (including during Sim to End).
 */
export function applyAssistantToWeekState<S extends WeekSimState>(
  state: S,
  shortlistIds: string[],
  random: () => number = Math.random,
  options: AssistantRunOptions = {},
): { state: S; report: AssistantReport } {
  const { dynasty } = state;
  const userTeam = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
  if (!userTeam) return { state, report: { actions: [], needsOffer: [], suggestedOffers: [] } };
  const planOffers = options.suggestOffers || options.autoOffer;
  const result = runRecruitingAssistant({
    recruitBoard: dynasty.recruitBoard,
    recruits: dynasty.recruits,
    shortlistIds,
    scouting: state.scouting,
    activity: state.recruitingActivity,
    userTeam,
    random,
    ...(planOffers
      ? {
          budgetRemaining: LACROSSE_CLASS_SCHOLARSHIP_BUDGET - classScholarshipBudgetUsed(dynasty.recruits, userTeam.id),
          isWinnable: winnableFor(dynasty, userTeam),
        }
      : {}),
  });

  let recruits = result.recruits;
  let suggestedOffers = result.suggestedOffers;
  if (options.autoOffer && suggestedOffers.length > 0) {
    const byId = new Map(suggestedOffers.map((o) => [o.recruitId, o]));
    recruits = recruits.map((r) => {
      const offer = byId.get(r.id);
      if (!offer) return r;
      const multiplier = recruitPrestigeMultiplier(r.starRating, userTeam.reputation.nationalPrestige);
      return applyScholarshipOffer(r, userTeam.id, offer.scholarshipPercent, multiplier);
    });
    for (const offer of suggestedOffers) {
      result.actions.push({ type: 'offer', recruitId: offer.recruitId, name: offer.name, scholarshipPercent: offer.scholarshipPercent });
    }
    suggestedOffers = [];
  }

  const report = { actions: result.actions, needsOffer: result.needsOffer, suggestedOffers };
  if (result.actions.length === 0) return { state, report };
  const recruitBoard = sortRecruitBoardForTeam(userTeam, recruits, dynasty.rosterTargets);
  return {
    state: {
      ...state,
      dynasty: { ...dynasty, recruits, recruitBoard },
      scouting: result.scouting,
      recruitingActivity: result.activity,
    },
    report,
  };
}

/**
 * The coordinator only spends money on races we can win: a recruit three
 * rival offers deep at a program above ours is a Long shot, not a target.
 */
function winnableFor(dynasty: WeekSimState['dynasty'], userTeam: LacrosseTeam): (recruitId: string) => boolean {
  const byId = new Map(dynasty.recruits.map((r) => [r.id, r]));
  const ctx = {
    userTeam,
    teams: dynasty.season.teams,
    currentWeek: dynasty.season.currentWeek,
    finalWeek: dynasty.season.schedule.reduce((max, g) => Math.max(max, g.week), 0) || 10,
    decisionScale: userDecisionScale(dynasty.difficulty),
    cpuInterestScale: cpuRecruitingScale(dynasty.difficulty),
  };
  return (id) => {
    const recruit = byId.get(id);
    if (!recruit) return false;
    return (landChance(recruit, ctx)?.probability ?? 0) >= TOSS_UP_AT;
  };
}
