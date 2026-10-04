import type { LacrosseTeam } from './models';
import { LACROSSE_FIRST_NAMES, LACROSSE_LAST_NAMES } from './names';

/**
 * The CPU programs' head coaches. The user coaches their own program, so it
 * never carries one.
 */
export interface HeadCoach {
  id: string;
  name: { first: string; last: string };
  /** Drives the program's coaching prestige: recruiting pull and staff quality. */
  rating: number;
  age: number;
  hiredYear: number;
  /** Record at the current program. */
  wins: number;
  losses: number;
  careerWins: number;
  careerLosses: number;
  /** Consecutive seasons well short of what the program expects. */
  hotSeat: number;
  /** The last season's win percentage beat expectations by a wide margin. */
  rising?: boolean;
}

export type CoachDepartureReason = 'fired' | 'retired' | 'poached';

export interface CarouselChange {
  teamId: string;
  outgoing: { name: string; reason: CoachDepartureReason; wins: number; losses: number; seasons: number };
  incoming: { name: string; rating: number; fromTeamId?: string };
}

/** Coaches retire from this age, more often the older they get. */
const RETIREMENT_AGE = 64;
/** Two straight seasons this far below expectations gets a coach fired. */
const HOT_SEAT_MARGIN = 0.12;
const HOT_SEAT_LIMIT = 2;
/** A season this far below expectations can end it on its own. */
const DISASTER_MARGIN = 0.3;
/** Beating expectations by this much puts a coach on bigger programs' lists. */
const RISING_MARGIN = 0.12;
/** A bigger job is at least this much more prestigious. */
const BIGGER_JOB_GAP = 8;
const POACH_CHANCE = 0.6;
/** Games in a regular season, for coaches' records from before the dynasty began. */
const PAST_SEASON_GAMES = 10;

/**
 * What a program expects: .500 for a program of the league's average
 * prestige, more for bigger names, less for smaller ones.
 */
export function expectedWinPct(team: LacrosseTeam, leaguePrestige = 50): number {
  return clamp(0.5 + (team.reputation.nationalPrestige - leaguePrestige) * 0.006, 0.3, 0.75);
}

function winPct(wins: number, losses: number): number {
  return wins + losses > 0 ? wins / (wins + losses) : 0;
}

export function coachName(coach: HeadCoach): string {
  return `${coach.name.first} ${coach.name.last}`;
}

/** Programs that don't have a head coach yet (new dynasties, older saves) get one in line with their coaching prestige. */
export function ensureHeadCoaches(teams: LacrosseTeam[], userTeamId: string, year: number, seed: number): LacrosseTeam[] {
  return teams.map((team) => {
    // A user who took this job replaced its coach.
    if (team.id === userTeamId) return team.headCoach ? withoutCoach(team) : team;
    if (team.headCoach) return team;
    const random = seededRandom(hash(`coach:${team.id}:${seed}`));
    const coach = newCoach(random, `coach-${team.id}-${year}`, team.reputation.coachingPrestige, year);
    // Sitting coaches have been there a while, and some coached elsewhere first.
    const seasonsHere = 1 + Math.floor(random() * 8);
    const seasonsBefore = Math.floor(random() * 6);
    const pastRecord = (seasons: number) => {
      const wins = Math.round(seasons * PAST_SEASON_GAMES * clamp(0.2 + coach.rating / 160 + (random() - 0.5) * 0.2, 0.2, 0.8));
      return { wins, losses: seasons * PAST_SEASON_GAMES - wins };
    };
    const here = pastRecord(seasonsHere);
    const before = pastRecord(seasonsBefore);
    return {
      ...team,
      headCoach: {
        ...coach,
        hiredYear: year - seasonsHere,
        age: 38 + seasonsHere + seasonsBefore + Math.floor(random() * 14),
        wins: here.wins,
        losses: here.losses,
        careerWins: here.wins + before.wins,
        careerLosses: here.losses + before.losses,
      },
    };
  });
}

function newCoach(random: () => number, id: string, rating: number, year: number): HeadCoach {
  return {
    id,
    name: {
      first: LACROSSE_FIRST_NAMES[Math.floor(random() * LACROSSE_FIRST_NAMES.length)]!,
      last: LACROSSE_LAST_NAMES[Math.floor(random() * LACROSSE_LAST_NAMES.length)]!,
    },
    rating: clamp(Math.round(rating), 40, 95),
    age: 34 + Math.floor(random() * 14),
    hiredYear: year,
    wins: 0,
    losses: 0,
    careerWins: 0,
    careerLosses: 0,
    hotSeat: 0,
  };
}

/** Adds the finished season to the coach's record and judges it against the program's expectations. */
function creditSeason(team: LacrosseTeam, coach: HeadCoach, leaguePrestige: number): HeadCoach {
  const { wins, losses } = team.record;
  const pct = winPct(wins, losses);
  const gap = pct - expectedWinPct(team, leaguePrestige);
  // Winning grows a coach's reputation; losing wears it down.
  const ratingChange =
    gap > RISING_MARGIN ? 2 : gap > 0.04 ? 1 : gap < -HOT_SEAT_MARGIN ? -2 : gap < -0.04 ? -1 : 0;
  return {
    ...coach,
    wins: coach.wins + wins,
    losses: coach.losses + losses,
    careerWins: coach.careerWins + wins,
    careerLosses: coach.careerLosses + losses,
    rating: clamp(coach.rating + ratingChange, 40, 95),
    hotSeat: gap < -HOT_SEAT_MARGIN ? coach.hotSeat + 1 : 0,
    rising: gap > RISING_MARGIN,
    age: coach.age + 1,
  };
}

function departureReason(
  team: LacrosseTeam,
  coach: HeadCoach,
  { year, leaguePrestige }: { year: number; leaguePrestige: number },
  random: () => number,
): CoachDepartureReason | null {
  const seasons = year - coach.hiredYear + 1;
  if (coach.age >= RETIREMENT_AGE && random() < 0.25 + (coach.age - RETIREMENT_AGE) * 0.15) return 'retired';
  // A new coach gets two seasons before the seat gets hot.
  if (seasons < 2) return null;
  if (coach.hotSeat >= HOT_SEAT_LIMIT) return 'fired';
  const gap = winPct(team.record.wins, team.record.losses) - expectedWinPct(team, leaguePrestige);
  if (gap < -DISASTER_MARGIN && random() < 0.5) return 'fired';
  return null;
}

/**
 * The offseason coaching carousel for CPU programs: coaches who fell short
 * are fired, old coaches retire, and the open jobs (biggest first) hire away
 * rising coaches from smaller programs or bring in a new head coach. Each new
 * coach sets his program's coaching prestige.
 *
 * Runs on the finished season's records, before they reset.
 */
export function runCoachingCarousel(
  teams: LacrosseTeam[],
  { userTeamId, year, seed }: { userTeamId: string; year: number; seed: number },
): { teams: LacrosseTeam[]; changes: CarouselChange[] } {
  const random = seededRandom(hash(`carousel:${year}:${seed}`));
  const withCoaches = ensureHeadCoaches(teams, userTeamId, year, seed);
  const leaguePrestige = teams.reduce((sum, team) => sum + team.reputation.nationalPrestige, 0) / Math.max(1, teams.length);
  const byId = new Map(
    withCoaches.map((team) => [team.id, team.headCoach ? { ...team, headCoach: creditSeason(team, team.headCoach, leaguePrestige) } : team]),
  );

  const departures = new Map<string, { coach: HeadCoach; reason: CoachDepartureReason }>();
  for (const team of byId.values()) {
    if (!team.headCoach) continue;
    const reason = departureReason(team, team.headCoach, { year, leaguePrestige }, random);
    if (reason) departures.set(team.id, { coach: team.headCoach, reason });
  }

  const changes: CarouselChange[] = [];
  const open = [...departures.keys()];
  const filled = new Set<string>();
  while (open.length > 0) {
    // The biggest open job hires first.
    open.sort((a, b) => byId.get(b)!.reputation.nationalPrestige - byId.get(a)!.reputation.nationalPrestige);
    const teamId = open.shift()!;
    const team = byId.get(teamId)!;
    const departed = departures.get(teamId)!;

    const target = [...byId.values()]
      .filter(
        (other) =>
          other.id !== teamId &&
          other.headCoach?.rising === true &&
          !departures.has(other.id) &&
          !filled.has(other.id) &&
          other.reputation.nationalPrestige <= team.reputation.nationalPrestige - BIGGER_JOB_GAP,
      )
      .sort((a, b) => b.headCoach!.rating - a.headCoach!.rating)[0];

    let incoming: HeadCoach;
    let fromTeamId: string | undefined;
    if (target && random() < POACH_CHANCE) {
      const poached = target.headCoach!;
      incoming = { ...poached, hiredYear: year + 1, wins: 0, losses: 0, hotSeat: 0, rising: false };
      fromTeamId = target.id;
      // His old program is now looking too.
      departures.set(target.id, { coach: poached, reason: 'poached' });
      open.push(target.id);
      byId.set(target.id, withoutCoach(target));
    } else {
      const rating = team.reputation.nationalPrestige * 0.6 + 25 + (random() - 0.5) * 24;
      incoming = newCoach(random, `coach-${teamId}-${year + 1}`, rating, year + 1);
    }

    filled.add(teamId);
    byId.set(teamId, {
      ...team,
      headCoach: incoming,
      reputation: { ...team.reputation, coachingPrestige: incoming.rating },
    });
    changes.push({
      teamId,
      outgoing: {
        name: coachName(departed.coach),
        reason: departed.reason,
        wins: departed.coach.wins,
        losses: departed.coach.losses,
        seasons: year - departed.coach.hiredYear + 1,
      },
      incoming: { name: coachName(incoming), rating: incoming.rating, ...(fromTeamId ? { fromTeamId } : {}) },
    });
  }

  // Coaches who stayed carry their reputation into the program's prestige.
  const result = withCoaches.map((original) => {
    const team = byId.get(original.id)!;
    if (!team.headCoach || filled.has(team.id)) return team;
    return { ...team, reputation: { ...team.reputation, coachingPrestige: team.headCoach.rating } };
  });
  return { teams: result, changes };
}

/** One line per carousel move, e.g. "Carousel: Delta fires Sam Ryan (12-26 in 3 seasons) and hires Ty Moss from Echo." */
export function carouselHeadline(change: CarouselChange, teamName: (teamId: string) => string): string {
  const { outgoing, incoming } = change;
  const record = `${outgoing.wins}-${outgoing.losses} in ${outgoing.seasons} season${outgoing.seasons === 1 ? '' : 's'}`;
  const hire = incoming.fromTeamId
    ? `hires ${incoming.name} away from ${teamName(incoming.fromTeamId)}`
    : `hires ${incoming.name}`;
  const program = teamName(change.teamId);
  switch (outgoing.reason) {
    case 'fired':
      return `Coaching carousel: ${program} fires ${outgoing.name} (${record}) and ${hire}`;
    case 'retired':
      return `Coaching carousel: ${outgoing.name} retires at ${program} (${record}); ${program} ${hire}`;
    case 'poached':
      return `Coaching carousel: ${program} loses ${outgoing.name} (${record}) and ${hire}`;
  }
}

function withoutCoach(team: LacrosseTeam): LacrosseTeam {
  const copy = { ...team };
  delete copy.headCoach;
  return copy;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
