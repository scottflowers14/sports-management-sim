import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { seededGameRandom } from './halftime';
export { seededGameRandom } from './halftime';
import {
  advanceSeasonWeek,
  applyCampusVisit,
  FINALIST_ANNOUNCE_LEAD,
  finalistTeamIds,
  recruitDecisionWeek,
  recruitPrestigeMultiplier,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import {
  applyCpuCaptains,
  dynastyRivalries,
  recordRivalryGame,
  rivalryForGame,
  seriesSummary,
  applyCpuRedshirts,
  autoDevelopmentPlans,
  moodLabel,
  moraleReason,
  runMoraleWeek,
  DEFAULT_GAME_PLAN,
  DEFAULT_PRACTICE_PLAN,
  deriveCpuGamePlan,
  PRACTICE_INTENSITIES,
  programStaffRating,
  runPracticeWeek,
  programCoachingEdge,
  simulateLacrosseGameWithLog,
  type GameLog,
  type LacrosseDynastyState,
  type LacrosseGamePlan,
  type LacrossePracticePlan,
  type MoraleChange,
  type PracticeGain,
  type LacrosseStaff,
  type LacrossePlayer,
  type RivalrySeriesMap,
  type LacrossePlayerGameStats,
  type LacrosseTeam,
} from '@sports-management-sim/sport-lacrosse';
import { autoCommitWeekly, processInjuries } from './dynasty-helpers';
import { formatTeamName } from './ui/format';
import type { InjuredPlayer } from './dynasty-helpers';
import { computeNationalRankings } from './rankings';
import type { RankingEntry } from './rankings';
import { generateWeeklyNews, generateRecruitingNews } from './news-feed';
import type { NewsItem } from './news-feed';
import { advanceScoutingWeek } from './scouting';
import type { ScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import type { RecruitingActivity } from './recruiting-activity';
import { updateSeasonStats } from './stats';
import { pickWeeklyHonors, weeklyHonorNews } from './weekly-honors';
import type { WeeklyHonor } from './weekly-honors';
import type { SeasonStatsMap } from './stats';

// About ten items a week, so this keeps the whole regular season.
const MAX_NEWS_ITEMS = 120;

export interface WeekSimState {
  dynasty: LacrosseDynastyState;
  rankings: RankingEntry[];
  injuries: InjuredPlayer[];
  newsItems: NewsItem[];
  scouting: ScoutingState;
  recruitingActivity: RecruitingActivity;
  /** Change in the user's interest with each recruit over the last simulated week. */
  recruitTrends: Record<string, number>;
  seasonStats: SeasonStatsMap;
  gameLogs: Map<string, GameLog>;
  bestNatRank: number | null;
  lastSimWeek: number | null;
  /** The user's hired coordinators; CPU staff quality comes from prestige. */
  userStaff?: LacrosseStaff;
  /** The user's practice intensity and individual development plans. */
  practicePlan?: LacrossePracticePlan;
  /** Rating points the user's players gained at practice this season, newest first. */
  practiceGains?: PracticeLogEntry[];
  /** Every rivalry's all-time series, carried across seasons. */
  rivalrySeries?: RivalrySeriesMap;
  /** This season's Player of the Week honors, oldest first. */
  weeklyHonors?: WeeklyHonor[];
}

export interface PracticeLogEntry extends PracticeGain {
  week: number;
}

/** Keeps a season of practice gains for the Practice screen. */
const MAX_PRACTICE_LOG = 80;

/** The user's game this week, played with a halftime adjustment. */
export interface CoachedGame {
  /** Seeds the game's dice, so the first half replays exactly as previewed. */
  seed: number;
  secondHalfPlan: LacrosseGamePlan;
}

/** CPU staffs name captains and make their redshirt calls before the opener. */
function seasonReadyForWeek(dynasty: WeekSimState['dynasty']): WeekSimState['dynasty']['season'] {
  const firstWeek = dynasty.season.schedule.reduce((min, game) => Math.min(min, game.week), Infinity);
  if (dynasty.season.currentWeek !== firstWeek) return dynasty.season;
  return {
    ...dynasty.season,
    teams: dynasty.season.teams.map((t) => (t.id === dynasty.userTeamId ? t : applyCpuCaptains(applyCpuRedshirts(t)))),
  };
}

/** Everything a game this week is played with, except the dice. */
function weekGameInput(state: WeekSimState, homeTeam: LacrosseTeam, awayTeam: LacrosseTeam, userGamePlan: LacrosseGamePlan) {
  const { dynasty } = state;
  const injuredIds = new Set(state.injuries.map((inj) => inj.playerId));
  const staffOwner = { teamId: dynasty.userTeamId, ...(state.userStaff ? { staff: state.userStaff } : {}) };
  const planFor = (team: LacrosseTeam): LacrosseGamePlan => (team.id === dynasty.userTeamId ? userGamePlan : deriveCpuGamePlan(team));
  // Injured and redshirting players sit: the depth chart promotes the next man up for the
  // rating, the game plan, and the box score.
  const home = withoutUnavailable(homeTeam, injuredIds);
  const away = withoutUnavailable(awayTeam, injuredIds);
  return {
    homeTeam: home,
    awayTeam: away,
    homeGamePlan: planFor(home),
    awayGamePlan: planFor(away),
    homeCoaching: programCoachingEdge(home, staffOwner),
    awayCoaching: programCoachingEdge(away, staffOwner),
  };
}

/**
 * Plays the user's game this week with a fixed seed and returns its log, so
 * the first half can be shown at halftime before the week is simmed. Null when
 * the user has no game this week.
 */
export function previewUserGame(state: WeekSimState, userGamePlan: LacrosseGamePlan, seed: number): { game: ScheduledGame; log: GameLog } | null {
  const { dynasty } = state;
  const season = seasonReadyForWeek(dynasty);
  const game = season.schedule.find(
    (g) =>
      g.week === season.currentWeek &&
      g.status === 'scheduled' &&
      (g.homeTeamId === dynasty.userTeamId || g.awayTeamId === dynasty.userTeamId),
  );
  if (!game) return null;
  const homeTeam = season.teams.find((t) => t.id === game.homeTeamId)!;
  const awayTeam = season.teams.find((t) => t.id === game.awayTeamId)!;
  const { log } = simulateLacrosseGameWithLog({ ...weekGameInput(state, homeTeam, awayTeam, userGamePlan), random: seededGameRandom(seed) });
  return { game, log };
}

export function simulateOneWeek(
  state: WeekSimState,
  userGamePlan: LacrosseGamePlan = DEFAULT_GAME_PLAN,
  random: () => number = Math.random,
  coached?: CoachedGame,
): WeekSimState {
  const { dynasty } = state;
  const weekToSim = dynasty.season.currentWeek;
  const prevCommittedIds = new Set(dynasty.recruits.filter((r) => r.status !== 'open').map((r) => r.id));
  const prevCommitmentTeamById = new Map(
    dynasty.recruits
      .filter((r) => r.status === 'committed' && r.committedTeamId !== undefined)
      .map((r) => [r.id, r.committedTeamId as string]),
  );
  const prevUserInterestById = new Map(
    dynasty.recruits.map((r) => [r.id, r.interestByTeamId[dynasty.userTeamId] ?? 0]),
  );
  const finalWeek = dynasty.season.schedule.reduce((max, game) => Math.max(max, game.week), 0) || 10;
  const teamMap = new Map(dynasty.season.teams.map((t) => [t.id, t.name]));

  const weekLogs = new Map<string, GameLog>();
  const weekPlayerLines = new Map<string, LacrossePlayerGameStats[]>();
  const injuredIds = new Set(state.injuries.map((inj) => inj.playerId));
  const staffOwner = { teamId: dynasty.userTeamId, ...(state.userStaff ? { staff: state.userStaff } : {}) };
  const seasonBeforeGames = seasonReadyForWeek(dynasty);
  const seasonAfterGames = advanceSeasonWeek(seasonBeforeGames, (game, homeTeam, awayTeam) => {
    const input = weekGameInput(state, homeTeam, awayTeam, userGamePlan);
    const coachedHere = coached && (homeTeam.id === dynasty.userTeamId || awayTeam.id === dynasty.userTeamId);
    const { log, players, ...result } = simulateLacrosseGameWithLog({
      ...input,
      random: coachedHere ? seededGameRandom(coached.seed) : random,
      ...(coachedHere
        ? homeTeam.id === dynasty.userTeamId
          ? { homeSecondHalfPlan: coached.secondHalfPlan }
          : { awaySecondHalfPlan: coached.secondHalfPlan }
        : {}),
    });
    weekLogs.set(game.id, log);
    weekPlayerLines.set(game.id, [...players.home, ...players.away]);
    return result;
  });

  // Every program practices after the week's games. CPU staffs run a normal
  // week with plans on their highest-upside young players.
  const rivalries = dynastyRivalries(dynasty);
  let rivalrySeries = state.rivalrySeries ?? {};
  const rivalryNews: NewsItem[] = [];
  for (const game of seasonAfterGames.schedule) {
    if (game.week !== weekToSim || game.status !== 'final' || !game.result) continue;
    const rivalry = rivalryForGame(rivalries, game);
    if (!rivalry) continue;
    const previousHolder = rivalrySeries[rivalry.key]?.holderId ?? null;
    rivalrySeries = recordRivalryGame(rivalrySeries, rivalry, game, dynasty.season.year);
    const { winnerTeamId, loserTeamId, homeScore, awayScore } = game.result;
    const verb = previousHolder === null ? 'wins' : previousHolder === winnerTeamId ? 'keeps' : 'takes back';
    const involvesUser = winnerTeamId === dynasty.userTeamId || loserTeamId === dynasty.userTeamId;
    rivalryNews.push({
      id: `rivalry-${dynasty.season.year}-${weekToSim}-${rivalry.key}`,
      week: weekToSim,
      category: 'game',
      ...(involvesUser ? { featured: true } : {}),
      headline: `Rivalry: ${formatTeamName(teamMap.get(winnerTeamId) ?? winnerTeamId)} ${verb} ${rivalry.trophy}, beating ${formatTeamName(teamMap.get(loserTeamId) ?? loserTeamId)} ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} (${seriesSummary(rivalrySeries[rivalry.key], winnerTeamId, loserTeamId).toLowerCase()})`,
    });
  }

  const playedTeamIds = new Set(
    seasonAfterGames.schedule
      .filter((g) => g.week === weekToSim && g.status === 'final')
      .flatMap((g) => [g.homeTeamId, g.awayTeamId]),
  );
  const userPractice = state.practicePlan ?? DEFAULT_PRACTICE_PLAN;
  const practiceGains: PracticeGain[] = [];
  const moraleChanges: MoraleChange[] = [];
  const newSeason = {
    ...seasonAfterGames,
    teams: seasonAfterGames.teams.map((team) => {
      const isUser = team.id === dynasty.userTeamId;
      const plan = isUser ? userPractice : { intensity: 'normal' as const, developmentPlans: autoDevelopmentPlans(team) };
      const practiced = runPracticeWeek(team, plan, {
        developmentRating: programStaffRating(team, 'development', staffOwner),
        played: playedTeamIds.has(team.id),
        skipPlayerIds: injuredIds,
      });
      if (isUser) practiceGains.push(...practiced.gains);
      // Then the locker room reacts to the week: roles, the result, practice.
      const game = seasonAfterGames.schedule.find(
        (g) => g.week === weekToSim && g.status === 'final' && (g.homeTeamId === team.id || g.awayTeamId === team.id),
      );
      const won = game?.result ? game.result.winnerTeamId === team.id : null;
      const rivalry = game ? rivalryForGame(rivalries, game) !== null : false;
      const mood = runMoraleWeek(practiced.team, { won, intensity: plan.intensity, rivalry });
      if (isUser) moraleChanges.push(...mood.changes);
      return mood.team;
    }),
  };

  const updatedUserTeam = newSeason.teams.find((t) => t.id === dynasty.userTeamId)!;

  // Resolve campus visits against the game the recruit actually watched.
  const visitNews: NewsItem[] = [];
  let recruitsAfterVisits = dynasty.recruits;
  if (state.recruitingActivity.visitIds.length > 0) {
    const userGame = newSeason.schedule.find(
      (g) =>
        g.week === weekToSim &&
        g.status === 'final' &&
        g.result !== undefined &&
        (g.homeTeamId === dynasty.userTeamId || g.awayTeamId === dynasty.userTeamId),
    );
    const hostedHome = userGame !== undefined && userGame.homeTeamId === dynasty.userTeamId;
    const won = hostedHome && userGame.result?.winnerTeamId === dynasty.userTeamId;
    const opponentId = hostedHome ? userGame.awayTeamId : null;
    const opponentRankRaw = opponentId !== null
      ? state.rankings.find((r) => r.teamId === opponentId)?.rank ?? null
      : null;
    const opponentRank = opponentRankRaw !== null && opponentRankRaw <= 20 ? opponentRankRaw : null;
    const visitIdSet = new Set(state.recruitingActivity.visitIds);

    recruitsAfterVisits = dynasty.recruits.map((recruit) => {
      if (!visitIdSet.has(recruit.id) || recruit.status !== 'open') return recruit;
      const outcome = applyCampusVisit(recruit, dynasty.userTeamId, {
        won,
        opponentRank,
        facilities: updatedUserTeam.reputation.facilities,
        interestMultiplier: recruitPrestigeMultiplier(
          recruit.starRating,
          updatedUserTeam.reputation.nationalPrestige,
        ),
      });
      const impressionText =
        outcome.impression === 'electric'
          ? 'left campus buzzing'
          : outcome.impression === 'positive'
            ? 'enjoyed the visit'
            : 'left underwhelmed';
      const gameText = hostedHome && opponentId !== null
        ? ` after the ${won ? 'win over' : 'loss to'} ${opponentRank !== null ? `#${opponentRank} ` : ''}${teamMap.get(opponentId) ?? opponentId}`
        : '';
      visitNews.push({
        id: `visit-${weekToSim}-${visitNews.length}`,
        week: weekToSim,
        category: 'recruiting',
        featured: true,
        headline: `Campus visit: ${recruit.position} ${recruit.name.first} ${recruit.name.last} ${impressionText}${gameText} (+${outcome.interestChange} interest)`,
      });
      return outcome.recruit;
    });
  }

  const newRecruits = autoCommitWeekly(
    recruitsAfterVisits,
    newSeason.teams,
    dynasty.userTeamId,
    weekToSim,
    random,
    finalWeek,
  );
  const newBoard = sortRecruitBoardForTeam(updatedUserTeam, newRecruits, dynasty.rosterTargets);
  const newDynasty = { ...dynasty, season: newSeason, recruits: newRecruits, recruitBoard: newBoard };

  const newRankings = computeNationalRankings(newSeason.teams, state.rankings);
  const userInjuryRisk = PRACTICE_INTENSITIES[userPractice.intensity].injuryRisk;
  const { injuries: newInjuries, newlyInjured, recovered, setbacks } = processInjuries(
    state.injuries,
    newSeason.teams,
    random,
    playedTeamIds,
    (teamId) => (teamId === dynasty.userTeamId ? userInjuryRisk : 1),
  );

  const newlyCommitted = newRecruits.filter((r) => r.status !== 'open' && !prevCommittedIds.has(r.id));

  // Recruiting drama: decommitments and recruits publicly naming finalists.
  const dramaNews: NewsItem[] = [];
  for (const recruit of newRecruits) {
    if (recruit.status === 'open' && prevCommittedIds.has(recruit.id)) {
      const formerTeamId = prevCommitmentTeamById.get(recruit.id);
      const formerName = formerTeamId !== undefined ? teamMap.get(formerTeamId) ?? formerTeamId : 'their school';
      dramaNews.push({
        id: `decommit-${weekToSim}-${dramaNews.length}`,
        week: weekToSim,
        category: 'recruiting',
        headline: `${'★'.repeat(recruit.starRating)} ${recruit.position} ${recruit.name.first} ${recruit.name.last} decommits from ${formerName}`,
      });
    }
  }
  for (const recruit of newRecruits) {
    if (recruit.status !== 'open') continue;
    if (!recruit.scholarshipOffers.some((o) => o.teamId === dynasty.userTeamId)) continue;
    if (recruit.scholarshipOffers.length < 2) continue;
    const decisionWeek = recruitDecisionWeek(recruit.id, recruit.starRating, finalWeek);
    if (weekToSim !== decisionWeek - FINALIST_ANNOUNCE_LEAD) continue;
    const finalists = finalistTeamIds(recruit).map((teamId) => teamMap.get(teamId) ?? teamId);
    dramaNews.push({
      id: `finalists-${weekToSim}-${dramaNews.length}`,
      week: weekToSim,
      category: 'recruiting',
      featured: true,
      headline: `${recruit.position} ${recruit.name.first} ${recruit.name.last} narrows his list to ${finalists.join(', ')} — decision expected Week ${decisionWeek}`,
    });
  }

  const recruitTrends: Record<string, number> = {};
  for (const recruit of newRecruits) {
    const before = prevUserInterestById.get(recruit.id) ?? 0;
    const after = recruit.interestByTeamId[dynasty.userTeamId] ?? 0;
    if (before !== 0 || after !== 0) {
      recruitTrends[recruit.id] = after - before;
    }
  }

  const weekNews = generateWeeklyNews({
    week: weekToSim,
    season: newSeason,
    previousRankings: state.rankings,
    newRankings,
    userTeamId: dynasty.userTeamId,
    teamMap,
  });
  const recruitNews = generateRecruitingNews({
    week: weekToSim,
    recruits: newlyCommitted,
    userTeamId: dynasty.userTeamId,
    teamMap,
  });
  const injuryNews: NewsItem[] = [
    ...newlyInjured
      .filter((inj) => inj.teamId === dynasty.userTeamId)
      .map((inj, i) => ({
        id: `injury-${weekToSim}-${i}`,
        week: weekToSim,
        category: 'injury' as const,
        featured: true,
        headline:
          inj.weeksRemaining >= 10
            ? `${inj.playerName} is out for the season (${inj.description})`
            : `${inj.playerName} is out ${inj.weeksRemaining} week${inj.weeksRemaining > 1 ? 's' : ''} (${inj.description})`,
      })),
    ...recovered
      .filter((r) => r.teamId === dynasty.userTeamId)
      .map((r, i) => ({
        id: `recovery-${weekToSim}-${i}`,
        week: weekToSim,
        category: 'injury' as const,
        featured: true,
        headline: `${r.playerName} has returned from injury`,
      })),
    ...setbacks
      .filter((sb) => sb.teamId === dynasty.userTeamId)
      .map((sb, i) => {
        const player = newSeason.teams.find((t) => t.id === sb.teamId)?.roster.find((p) => p.id === sb.playerId);
        const name = player ? `${player.name.first} ${player.name.last}` : 'A rushed player';
        return {
          id: `setback-${weekToSim}-${i}`,
          week: weekToSim,
          category: 'injury' as const,
          featured: true,
          headline: `${name} suffers a setback after rushing back and is out ${sb.weeksRemaining} more week${sb.weeksRemaining > 1 ? 's' : ''}`,
        };
      }),
  ];

  const practiceNews: NewsItem[] = [];
  if (practiceGains.length > 0) {
    const names = practiceGains.map((gain) => {
      const player = updatedUserTeam.roster.find((p) => p.id === gain.playerId);
      const name = player ? `${player.position} ${player.name.first[0]}. ${player.name.last}` : 'A player';
      return `${name} up to ${gain.to}`;
    });
    practiceNews.push({
      id: `practice-${weekToSim}`,
      week: weekToSim,
      category: 'coaching',
      headline: `Practice report: ${names.join(', ')}`,
    });
  }

  // A player who turns unhappy makes it known.
  for (const change of moraleChanges) {
    if (change.from < 50 || change.to >= 50) continue;
    const player = updatedUserTeam.roster.find((p) => p.id === change.playerId);
    if (!player) continue;
    practiceNews.push({
      id: `morale-${weekToSim}-${player.id}`,
      week: weekToSim,
      category: 'coaching',
      featured: true,
      headline: `${player.position} ${player.name.first} ${player.name.last} is ${moodLabel(change.to).toLowerCase()}: ${moraleReason(updatedUserTeam, player).toLowerCase()}`,
    });
  }

  const newSeasonStats = updateSeasonStats(state.seasonStats, newSeason.schedule, newSeason.teams, weekToSim, weekPlayerLines);
  const weekHonors = pickWeeklyHonors(weekToSim, state.seasonStats, newSeasonStats, newSeason.teams);
  const playerOfWeekNews = weeklyHonorNews(weekHonors, newSeason.teams, dynasty.userTeamId);

  const mergedLogs = new Map(state.gameLogs);
  for (const [id, log] of weekLogs) mergedLogs.set(id, log);

  const userRank = newRankings.find((r) => r.teamId === dynasty.userTeamId)?.rank ?? null;
  const bestNatRank =
    userRank !== null && (state.bestNatRank === null || userRank < state.bestNatRank)
      ? userRank
      : state.bestNatRank;

  return {
    dynasty: newDynasty,
    rankings: newRankings,
    injuries: newInjuries,
    rivalrySeries,
    newsItems: [...rivalryNews, ...playerOfWeekNews, ...weekNews, ...visitNews, ...recruitNews, ...dramaNews, ...injuryNews, ...practiceNews, ...state.newsItems].slice(0, MAX_NEWS_ITEMS),
    scouting: advanceScoutingWeek(state.scouting),
    recruitingActivity: emptyRecruitingActivity(),
    recruitTrends,
    seasonStats: newSeasonStats,
    gameLogs: mergedLogs,
    bestNatRank,
    lastSimWeek: weekToSim,
    ...(state.userStaff ? { userStaff: state.userStaff } : {}),
    ...(state.practicePlan ? { practicePlan: state.practicePlan } : {}),
    practiceGains: [
      ...practiceGains.map((gain) => ({ ...gain, week: weekToSim })).reverse(),
      ...(state.practiceGains ?? []),
    ].slice(0, MAX_PRACTICE_LOG),
    weeklyHonors: [...(state.weeklyHonors ?? []), ...weekHonors],
  };
}

/** The roster that can dress for a game: no injured or redshirting players. */
export function withoutUnavailable(team: LacrosseTeam, injuredIds: ReadonlySet<string>): LacrosseTeam {
  const sitsOut = (p: LacrossePlayer) => injuredIds.has(p.id) || p.redshirtStatus === 'redshirting';
  if (!team.roster.some(sitsOut)) return team;
  return { ...team, roster: team.roster.filter((p) => !sitsOut(p)) };
}

export function simulateRemainingWeeks(
  state: WeekSimState,
  userGamePlan: LacrosseGamePlan = DEFAULT_GAME_PLAN,
  random: () => number = Math.random,
  /** Runs before each week is simulated, e.g. the auto recruiting assistant. */
  beforeWeek?: (state: WeekSimState) => WeekSimState,
): WeekSimState {
  let current = state;
  // Safety bound: a season is far shorter than 64 weeks
  for (let i = 0; i < 64; i += 1) {
    if (!current.dynasty.season.schedule.some((g) => g.status === 'scheduled')) break;
    if (beforeWeek) current = beforeWeek(current);
    current = simulateOneWeek(current, userGamePlan, random);
  }
  return current;
}
