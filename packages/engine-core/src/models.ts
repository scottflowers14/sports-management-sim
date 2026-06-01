export type ID = string;

export type SeasonYear = number;

export type Rating = number;

export type PlayerClass = 'FR' | 'SO' | 'JR' | 'SR' | 'GR';

export type DevelopmentTrait =
  | 'late_bloomer'
  | 'high_floor'
  | 'raw_athlete'
  | 'polished'
  | 'injury_prone'
  | 'leader'
  | 'low_motivation';

export type RegionId = string;

export interface Region {
  id: RegionId;
  name: string;
  country: string;
  state?: string;
  recruitingHotbedScore: Rating;
}

export interface PersonName {
  first: string;
  last: string;
}

export interface PlayerRatings {
  overall: Rating;
  potential: Rating;
  athleticism: Rating;
  speed: Rating;
  strength: Rating;
  stamina: Rating;
  skill: Rating;
  iq: Rating;
  discipline: Rating;
  workEthic: Rating;
  leadership: Rating;
}

export type RedshirtStatus = 'none' | 'redshirt_available' | 'redshirting' | 'redshirt_used';

export interface EligibilityStatus {
  seasonsPlayed: number;
  seasonsRemaining: number;
  isEligible: boolean;
  reasonIneligible?: string;
}

export interface RecruitingProfile {
  starRating: 1 | 2 | 3 | 4 | 5;
  nationalRank?: number;
  positionRank?: number;
  regionRank?: number;
  interestLevel: Rating;
  academicFit: Rating;
  proximityPreference: Rating;
  playingTimeImportance: Rating;
  prestigeImportance: Rating;
  scholarshipImportance: Rating;
  committedTeamId?: ID;
  signedTeamId?: ID;
}

export interface Player<Position extends string = string, SportTraits = unknown> {
  id: ID;
  name: PersonName;
  age: number;
  classYear: PlayerClass;
  hometown: string;
  regionId: RegionId;
  position: Position;
  secondaryPositions: Position[];
  ratings: PlayerRatings;
  traits: DevelopmentTrait[];
  sportTraits: SportTraits;
  scholarshipPercent: number;
  isWalkOn: boolean;
  morale: Rating;
  health: Rating;
  fatigue: Rating;
  redshirtStatus: RedshirtStatus;
  eligibility: EligibilityStatus;
  recruitingProfile?: RecruitingProfile;
  createdSeason: SeasonYear;
}

export interface TeamReputation {
  nationalPrestige: Rating;
  academicPrestige: Rating;
  coachingPrestige: Rating;
  facilities: Rating;
  fanSupport: Rating;
  recentSuccess: Rating;
}

export interface TeamResources {
  scholarshipLimit: number;
  scholarshipUsed: number;
  recruitingBudget: number;
  staffBudget: number;
  facilitiesBudget: number;
}

export interface TeamRecord {
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  neutralWins: number;
  neutralLosses: number;
}

export interface Team<Position extends string = string, SportTraits = unknown> {
  id: ID;
  name: string;
  shortName: string;
  mascot?: string;
  schoolName: string;
  conferenceId: ID;
  regionId: RegionId;
  reputation: TeamReputation;
  resources: TeamResources;
  roster: Player<Position, SportTraits>[];
  record: TeamRecord;
  coachId?: ID;
  createdSeason: SeasonYear;
}

export interface Conference {
  id: ID;
  name: string;
  shortName: string;
  teamIds: ID[];
  prestige: Rating;
  regionIds: RegionId[];
}

export type GameStatus = 'scheduled' | 'in_progress' | 'final' | 'cancelled' | 'postponed';

export interface ScheduledGame {
  id: ID;
  seasonYear: SeasonYear;
  week: number;
  date?: string;
  homeTeamId: ID;
  awayTeamId: ID;
  neutralSite?: boolean;
  conferenceGame: boolean;
  status: GameStatus;
  result?: GameResult;
}

export interface GameResult<TeamStats = unknown, PlayerStats = unknown> {
  homeScore: number;
  awayScore: number;
  winnerTeamId: ID;
  loserTeamId: ID;
  overtime: boolean;
  teamStats?: {
    home: TeamStats;
    away: TeamStats;
  };
  playerStats?: PlayerStats[];
}

export interface StandingsEntry {
  teamId: ID;
  conferenceId: ID;
  record: TeamRecord;
  pointsFor: number;
  pointsAgainst: number;
  strengthOfSchedule: Rating;
  rankingScore: Rating;
  nationalRank?: number;
  conferenceRank?: number;
}

export type SeasonPhase =
  | 'preseason'
  | 'regular_season'
  | 'conference_tournaments'
  | 'postseason'
  | 'offseason'
  | 'complete';

export interface Season<Position extends string = string, SportTraits = unknown> {
  year: SeasonYear;
  teams: Team<Position, SportTraits>[];
  conferences: Conference[];
  regions: Region[];
  schedule: ScheduledGame[];
  standings: StandingsEntry[];
  currentWeek: number;
  phase: SeasonPhase;
}
