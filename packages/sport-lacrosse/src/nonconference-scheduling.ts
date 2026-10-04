import type { ScheduledGame } from '@sports-management-sim/engine-core';

/**
 * Non-conference scheduling, in the spirit of College Football dynasty's
 * schedule editor: before the season the user can trade a non-conference
 * opponent for any other program free that week. The two games swap
 * partners, so every program still plays once a week and nobody gains or
 * loses a game.
 */
export interface NonConferenceSwapContext {
  schedule: ScheduledGame[];
  conferences: Array<{ id: string; teamIds: string[] }>;
  userTeamId: string;
}

export interface NonConferenceSlot {
  week: number;
  game: ScheduledGame;
  opponentId: string;
  home: boolean;
}

export function userNonConferenceSlots({ schedule, userTeamId }: Omit<NonConferenceSwapContext, 'conferences'>): NonConferenceSlot[] {
  return schedule
    .filter((g) => !g.conferenceGame && (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId))
    .sort((a, b) => a.week - b.week)
    .map((game) => {
      const home = game.homeTeamId === userTeamId;
      return { week: game.week, game, opponentId: home ? game.awayTeamId : game.homeTeamId, home };
    });
}

function conferenceOf(conferences: NonConferenceSwapContext['conferences'], teamId: string): string | undefined {
  return conferences.find((c) => c.teamIds.includes(teamId))?.id;
}

function plays(schedule: ScheduledGame[], a: string, b: string, except: ScheduledGame[]): boolean {
  return schedule.some(
    (g) => !except.includes(g) && ((g.homeTeamId === a && g.awayTeamId === b) || (g.homeTeamId === b && g.awayTeamId === a)),
  );
}

function involves(game: ScheduledGame, teamId: string): boolean {
  return game.homeTeamId === teamId || game.awayTeamId === teamId;
}

function gameId(game: Pick<ScheduledGame, 'seasonYear' | 'week' | 'homeTeamId' | 'awayTeamId'>): string {
  return `${game.seasonYear}-week-${game.week}-${game.homeTeamId}-vs-${game.awayTeamId}`;
}

/**
 * The schedule with the user facing `newOpponentId` in `week` instead of
 * their current opponent, or null when the swap would break the schedule:
 * the newcomer must be out of conference, free of a game with the user all
 * season, and playing a non-conference game that week whose other team can
 * take the user's old opponent without a rematch or a conference clash.
 */
export function swapNonConferenceOpponent(
  context: NonConferenceSwapContext,
  week: number,
  newOpponentId: string,
): ScheduledGame[] | null {
  const { schedule, conferences, userTeamId } = context;
  const userGame = schedule.find((g) => g.week === week && !g.conferenceGame && involves(g, userTeamId));
  if (!userGame || userGame.status !== 'scheduled') return null;
  const oldOpponentId = userGame.homeTeamId === userTeamId ? userGame.awayTeamId : userGame.homeTeamId;
  if (newOpponentId === oldOpponentId || newOpponentId === userTeamId) return null;

  const otherGame = schedule.find((g) => g.week === week && involves(g, newOpponentId));
  if (!otherGame || otherGame.conferenceGame || otherGame.status !== 'scheduled') return null;
  const partnerId = otherGame.homeTeamId === newOpponentId ? otherGame.awayTeamId : otherGame.homeTeamId;
  if (partnerId === oldOpponentId) return null;

  const userConference = conferenceOf(conferences, userTeamId);
  if (conferenceOf(conferences, newOpponentId) === userConference) return null;
  if (conferenceOf(conferences, partnerId) === conferenceOf(conferences, oldOpponentId)) return null;
  const touched = [userGame, otherGame];
  if (plays(schedule, userTeamId, newOpponentId, touched) || plays(schedule, oldOpponentId, partnerId, touched)) return null;

  // The user keeps their side of the field; the old opponent takes the
  // newcomer's side against the newcomer's partner.
  const userHome = userGame.homeTeamId === userTeamId;
  const partnerHome = otherGame.homeTeamId === partnerId;
  const newUserGame: ScheduledGame = {
    ...userGame,
    homeTeamId: userHome ? userTeamId : newOpponentId,
    awayTeamId: userHome ? newOpponentId : userTeamId,
  };
  const newOtherGame: ScheduledGame = {
    ...otherGame,
    homeTeamId: partnerHome ? partnerId : oldOpponentId,
    awayTeamId: partnerHome ? oldOpponentId : partnerId,
  };
  return schedule.map((g) => {
    if (g === userGame) return { ...newUserGame, id: gameId(newUserGame) };
    if (g === otherGame) return { ...newOtherGame, id: gameId(newOtherGame) };
    return g;
  });
}

/** Every program the user could face in `week` instead. */
export function eligibleNonConferenceOpponents(context: NonConferenceSwapContext, week: number): string[] {
  const teamIds = context.conferences.flatMap((c) => c.teamIds);
  return teamIds.filter((teamId) => swapNonConferenceOpponent(context, week, teamId) !== null);
}
