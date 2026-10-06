import type { DynastySeasonRecord } from './history';
import type { SeasonGameRecord } from './series-history';

/**
 * Achievements: milestones a coach unlocks while playing. Each one is checked
 * against a snapshot of the dynasty (finished seasons plus the season in
 * progress), so the same check works after a week, after the offseason, or on
 * an old save loaded for the first time.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementCategory = 'games' | 'seasons' | 'program' | 'players' | 'career';

export const TIER_POINTS: Record<AchievementTier, number> = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  games: 'Games',
  seasons: 'Seasons',
  program: 'Program',
  players: 'Players',
  career: 'Career',
};

/** A game this season, with the opponent's poll rank going into it when known. */
export interface AchievementGame extends SeasonGameRecord {
  opponentRank?: number | null;
}

export interface AchievementSnapshot {
  /** Finished seasons, newest first. */
  history: readonly DynastySeasonRecord[];
  /** The season in progress, if any games have been played. */
  current?: { games: readonly AchievementGame[] };
  /** Hall of Fame inductees at the coach's programs. */
  hallOfFame: number;
  /** Pro draft picks from the coach's programs, all seasons. */
  proPicks: number;
  /** Coach ability tiers bought so far, by ability. */
  abilityTiers: readonly number[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  category: AchievementCategory;
  /** Shown as ??? until unlocked. */
  secret?: boolean;
  check: (s: AchievementSnapshot) => boolean;
}

const regularSeason = (games: readonly SeasonGameRecord[] | undefined) => (games ?? []).filter((g) => !g.postseason);
const won = (g: SeasonGameRecord) => g.goalsFor > g.goalsAgainst;

/** Every game the coach has played: past seasons that kept their games, then this one. */
function allGames(s: AchievementSnapshot): AchievementGame[] {
  return [...s.history.flatMap((h) => h.games ?? []), ...(s.current?.games ?? [])];
}

function careerWins(s: AchievementSnapshot): number {
  const currentWins = regularSeason(s.current?.games).filter(won).length;
  return s.history.reduce((sum, h) => sum + h.wins, 0) + currentWins;
}

function titles(s: AchievementSnapshot): number {
  return s.history.filter((h) => h.nationalChampion).length;
}

/** Longest run of consecutive seasons (newest-first history) matching the test. */
function longestRun(history: readonly DynastySeasonRecord[], test: (h: DynastySeasonRecord) => boolean): number {
  let best = 0;
  let run = 0;
  for (const h of history) {
    run = test(h) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Games
  { id: 'first-win', title: 'Off the Schneid', description: 'Win your first game.', tier: 'bronze', category: 'games', check: (s) => allGames(s).some(won) },
  { id: 'blowout', title: 'Running Clock', description: 'Win a game by 10 or more goals.', tier: 'bronze', category: 'games', check: (s) => allGames(s).some((g) => g.goalsFor - g.goalsAgainst >= 10) },
  { id: 'nail-biter', title: 'Nail-Biter', description: 'Win a game by a single goal.', tier: 'bronze', category: 'games', check: (s) => allGames(s).some((g) => g.goalsFor - g.goalsAgainst === 1) },
  { id: 'lockdown', title: 'Lockdown', description: 'Hold an opponent to 4 goals or fewer.', tier: 'silver', category: 'games', check: (s) => allGames(s).some((g) => g.goalsAgainst <= 4) },
  { id: 'twenty-spot', title: 'Twenty Spot', description: 'Score 20 or more goals in a game.', tier: 'silver', category: 'games', check: (s) => allGames(s).some((g) => g.goalsFor >= 20) },
  {
    id: 'giant-killer',
    title: 'Giant Killer',
    description: 'Beat a team ranked in the top 5.',
    tier: 'silver',
    category: 'games',
    check: (s) => allGames(s).some((g) => won(g) && g.opponentRank != null && g.opponentRank <= 5),
  },
  { id: 'postseason-win', title: 'Playoff Lacrosse', description: 'Win a postseason game.', tier: 'silver', category: 'games', check: (s) => allGames(s).some((g) => g.postseason && won(g)) },

  // Seasons
  { id: 'winning-season', title: 'Over .500', description: 'Finish a season with a winning record.', tier: 'bronze', category: 'seasons', check: (s) => s.history.some((h) => h.wins > h.losses) },
  { id: 'ten-wins', title: 'Double Digits', description: 'Win 10 games in a season.', tier: 'silver', category: 'seasons', check: (s) => s.history.some((h) => h.wins >= 10) },
  {
    id: 'perfect-regular-season',
    title: 'Unblemished',
    description: 'Go unbeaten in the regular season.',
    tier: 'gold',
    category: 'seasons',
    check: (s) => s.history.some((h) => h.losses === 0 && h.wins >= 8),
  },
  { id: 'conference-title', title: 'Conference Kings', description: 'Win a conference championship.', tier: 'silver', category: 'seasons', check: (s) => s.history.some((h) => h.confChampion) },
  { id: 'top-five', title: 'Top Five', description: 'Finish a season ranked in the top 5.', tier: 'silver', category: 'seasons', check: (s) => s.history.some((h) => h.natRankAtEnd != null && h.natRankAtEnd <= 5) },
  { id: 'national-title', title: 'Cut Down the Nets', description: 'Win a national championship.', tier: 'gold', category: 'seasons', check: (s) => titles(s) >= 1 },
  {
    id: 'back-to-back',
    title: 'Back-to-Back',
    description: 'Win national titles in consecutive seasons.',
    tier: 'platinum',
    category: 'seasons',
    check: (s) => longestRun(s.history, (h) => h.nationalChampion) >= 2,
  },
  { id: 'dynasty', title: 'Dynasty', description: 'Win three national championships.', tier: 'platinum', category: 'seasons', check: (s) => titles(s) >= 3 },

  // Program
  {
    id: 'beat-the-pick',
    title: 'Bulletin Board',
    description: 'Finish 3 or more places above your preseason conference pick.',
    tier: 'bronze',
    category: 'program',
    check: (s) => s.history.some((h) => h.predictedConfFinish != null && h.predictedConfFinish - h.confStanding >= 3),
  },
  {
    id: 'turnaround',
    title: 'Turnaround',
    description: 'Win 4 or more games more than the season before, at the same program.',
    tier: 'silver',
    category: 'program',
    check: (s) =>
      s.history.some((h, i) => {
        const prev = s.history[i + 1];
        return prev !== undefined && h.teamName === prev.teamName && h.wins - prev.wins >= 4;
      }),
  },
  { id: 'big-class', title: 'Loaded Class', description: 'Sign a recruiting class of 10 or more.', tier: 'bronze', category: 'program', check: (s) => s.history.some((h) => h.signingClassSize >= 10) },
  {
    id: 'staying-power',
    title: 'Staying Power',
    description: 'Post five straight winning seasons.',
    tier: 'gold',
    category: 'program',
    check: (s) => longestRun(s.history, (h) => h.wins > h.losses) >= 5,
  },

  // Players
  { id: 'all-american', title: 'All-American', description: 'Coach an All-American.', tier: 'bronze', category: 'players', check: (s) => s.history.some((h) => (h.allAmericans?.length ?? 0) > 0) },
  {
    id: 'mvp',
    title: 'Most Valuable',
    description: 'Coach the national MVP.',
    tier: 'gold',
    category: 'players',
    check: (s) => s.history.some((h) => (h.awards ?? []).some((a) => a.award === 'MVP' && a.teamName === h.teamName)),
  },
  { id: 'hall-of-famer', title: 'Enshrined', description: 'Send a player to your program Hall of Fame.', tier: 'silver', category: 'players', check: (s) => s.hallOfFame >= 1 },
  { id: 'pro-pipeline', title: 'Pro Pipeline', description: 'Have 5 players drafted by the pros.', tier: 'silver', category: 'players', check: (s) => s.proPicks >= 5 },

  // Career
  { id: 'fifty-wins', title: 'Fifty', description: 'Win 50 career games.', tier: 'silver', category: 'career', check: (s) => careerWins(s) >= 50 },
  { id: 'hundred-wins', title: 'Century Club', description: 'Win 100 career games.', tier: 'gold', category: 'career', check: (s) => careerWins(s) >= 100 },
  { id: 'ten-seasons', title: 'Lifer', description: 'Coach 10 seasons.', tier: 'gold', category: 'career', check: (s) => s.history.length >= 10 },
  { id: 'coach-of-year', title: 'Coach of the Year', description: 'Be named national Coach of the Year.', tier: 'gold', category: 'career', check: (s) => s.history.some((h) => h.coachOfYear) },
  {
    id: 'journeyman',
    title: 'Have Whistle, Will Travel',
    description: 'Coach at two different programs.',
    tier: 'silver',
    category: 'career',
    secret: true,
    check: (s) => new Set(s.history.map((h) => h.teamName).filter(Boolean)).size >= 2,
  },
  { id: 'first-upgrade', title: 'Continuing Education', description: 'Buy your first coach ability.', tier: 'bronze', category: 'career', check: (s) => s.abilityTiers.some((t) => t > 0) },
  { id: 'master', title: 'Master of the Craft', description: 'Max out a coach ability.', tier: 'gold', category: 'career', check: (s) => s.abilityTiers.some((t) => t >= 3) },
];

export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDef> = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Where and when an achievement was first earned. */
export interface AchievementUnlock {
  year: number;
  teamName?: string;
  coachName?: string;
  /** Wall-clock time of the unlock, for "recent" ordering. */
  at: string;
}

export type UnlockedAchievements = Record<string, AchievementUnlock>;

/** Achievements the snapshot earns that aren't unlocked yet, in list order. */
export function newlyUnlocked(snapshot: AchievementSnapshot, unlocked: Readonly<UnlockedAchievements>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && a.check(snapshot));
}

export function achievementPoints(unlocked: Readonly<UnlockedAchievements>): number {
  return Object.keys(unlocked).reduce((sum, id) => {
    const def = ACHIEVEMENT_BY_ID.get(id);
    return sum + (def ? TIER_POINTS[def.tier] : 0);
  }, 0);
}

export const MAX_ACHIEVEMENT_POINTS = ACHIEVEMENTS.reduce((sum, a) => sum + TIER_POINTS[a.tier], 0);

/** Profile level: one level per 100 achievement points, starting at 1. */
export const POINTS_PER_LEVEL = 100;

export function profileLevel(points: number): { level: number; intoLevel: number; perLevel: number } {
  return { level: Math.floor(points / POINTS_PER_LEVEL) + 1, intoLevel: points % POINTS_PER_LEVEL, perLevel: POINTS_PER_LEVEL };
}
