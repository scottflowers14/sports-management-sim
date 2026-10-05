import { describe, expect, it } from 'vitest';
import type { CareerStatsMap, CareerSeasonLine } from './career-stats';
import {
  archiveRecords,
  brokenRecordHeadlines,
  hallOfFameInductees,
  careerRecords,
  LEAGUE_SCOPE,
  mergeRecords,
  scopeRecords,
  singleSeasonRecords,
} from './records';
import type { PlayerSeasonStats } from './stats';

function stats(goals: number, assists = 0, extra: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats {
  return {
    playerId: '',
    gamesPlayed: 10,
    goals,
    assists,
    shots: 0,
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    goalsAllowed: 0,
    ...extra,
  };
}

function line(year: number, teamName: string, s: PlayerSeasonStats): CareerSeasonLine {
  return { year, teamName, classYear: 'JR', position: 'ATT', stats: s };
}

const careers: CareerStatsMap = {
  a: { playerId: 'a', name: 'Ann Attack', position: 'ATT', seasons: [line(2028, 'durham', stats(40, 10)), line(2029, 'durham', stats(30, 30))] },
  b: { playerId: 'b', name: 'Ben Shooter', position: 'ATT', seasons: [line(2028, 'raleigh', stats(55))] },
  // A transfer: his Durham numbers count for Durham, his Raleigh numbers for Raleigh.
  t: { playerId: 't', name: 'Tom Transfer', position: 'ATT', seasons: [line(2028, 'raleigh', stats(20)), line(2029, 'durham', stats(25))] },
};

describe('record lists', () => {
  it('ranks single seasons, by program or across the league', () => {
    expect(singleSeasonRecords(careers, 'goals').map((e) => [e.name, e.value])).toEqual([
      ['Ben Shooter', 55],
      ['Ann Attack', 40],
      ['Ann Attack', 30],
      ['Tom Transfer', 25],
      ['Tom Transfer', 20],
    ]);
    expect(singleSeasonRecords(careers, 'points', { teamName: 'durham' })[0]).toMatchObject({ name: 'Ann Attack', value: 60, firstYear: 2029 });
  });

  it('totals careers, counting only the seasons spent at the program', () => {
    expect(careerRecords(careers, 'goals')[0]).toMatchObject({ name: 'Ann Attack', value: 70, firstYear: 2028, lastYear: 2029 });
    expect(careerRecords(careers, 'goals', { teamName: 'durham' }).find((e) => e.playerId === 't')?.value).toBe(25);
    expect(careerRecords(careers, 'goals', { teamName: 'raleigh' }).find((e) => e.playerId === 't')?.value).toBe(20);
  });

  it('flags the season in progress and leaves out zeroes', () => {
    const live = singleSeasonRecords(careers, 'goals', { liveYear: 2029 });
    expect(live.find((e) => e.firstYear === 2029 && e.playerId === 'a')?.inProgress).toBe(true);
    expect(singleSeasonRecords(careers, 'saves')).toEqual([]);
  });
});

describe('the saved record book', () => {
  it('keeps a departed player’s record after his career is pruned', () => {
    const archive = archiveRecords({}, careers, ['durham']);
    expect(Object.keys(archive).sort()).toEqual(['durham', LEAGUE_SCOPE]);
    // Ann graduates and drops out of the saved careers.
    const { a: _gone, ...remaining } = careers;
    const book = scopeRecords(archive, 'durham', remaining);
    expect(book.career.goals?.[0]).toMatchObject({ name: 'Ann Attack', value: 70 });
    expect(book.season.points?.[0]).toMatchObject({ name: 'Ann Attack', value: 60 });
  });

  it('lets current numbers replace saved ones for the same player', () => {
    const archived = careerRecords(careers, 'goals');
    const grown = careerRecords(
      { ...careers, b: { ...careers.b!, seasons: [...careers.b!.seasons, line(2029, 'raleigh', stats(50))] } },
      'goals',
    );
    const merged = mergeRecords(archived, grown, 'career');
    expect(merged.filter((e) => e.playerId === 'b')).toHaveLength(1);
    expect(merged[0]).toMatchObject({ playerId: 'b', value: 105 });
  });
});

describe('record news', () => {
  it('announces a record passing from a past season to this one, once', () => {
    const before = scopeRecords({}, 'durham', careers, 2030);
    const chaser: CareerStatsMap = {
      ...careers,
      n: { playerId: 'n', name: 'Nick New', position: 'ATT', seasons: [line(2030, 'durham', stats(45))] },
    };
    const after = scopeRecords({}, 'durham', chaser, 2030);
    const news = brokenRecordHeadlines(before, after, 'Durham', 2030);
    expect(news).toContain('Record book: ATT Nick New breaks the Durham single-season goals record with 45, passing Ann Attack (40, 2028)');
    // Next week he holds it already: no repeat.
    expect(brokenRecordHeadlines(after, after, 'Durham', 2030)).toEqual([]);
  });

  it('stays quiet when a record is set in the season it began', () => {
    const empty = scopeRecords({}, 'durham', {}, 2028);
    const after = scopeRecords({}, 'durham', careers, 2028);
    expect(brokenRecordHeadlines(empty, after, 'Durham', 2028)).toEqual([]);
  });
});

describe('what counts as breaking a record', () => {
  it('needs more than a tie, and a career record needs a real career behind it', () => {
    const tied: CareerStatsMap = {
      ...careers,
      n: { playerId: 'n', name: 'Nick New', position: 'ATT', seasons: [line(2030, 'durham', stats(40))] },
    };
    const before = scopeRecords({}, 'durham', careers, 2030);
    expect(brokenRecordHeadlines(before, scopeRecords({}, 'durham', tied, 2030), 'Durham', 2030)).toEqual([]);

    // Ann's two-season career record (70 goals) falls quietly...
    const big: CareerStatsMap = {
      ...careers,
      n: { playerId: 'n', name: 'Nick New', position: 'ATT', seasons: [line(2029, 'raleigh', stats(1)), line(2030, 'durham', stats(80))] },
    };
    const news = brokenRecordHeadlines(before, scopeRecords({}, 'durham', big, 2030), 'Durham', 2030);
    expect(news.some((h) => h.includes('career goals'))).toBe(false);
    expect(news.some((h) => h.includes('single-season goals'))).toBe(true);
  });
});

describe('the Hall of Fame', () => {
  const longCareers: CareerStatsMap = {
    vet: {
      playerId: 'vet',
      name: 'Val Veteran',
      position: 'ATT',
      seasons: [line(2028, 'durham', stats(30, 10)), line(2029, 'durham', stats(30, 10)), line(2030, 'durham', stats(30, 10))],
    },
    short: { playerId: 'short', name: 'Sid Short', position: 'ATT', seasons: [line(2030, 'durham', stats(95, 40))] },
    stay: {
      playerId: 'stay',
      name: 'Stu Stays',
      position: 'ATT',
      seasons: [line(2028, 'durham', stats(28)), line(2029, 'durham', stats(28)), line(2030, 'durham', stats(28))],
    },
  };
  const records = scopeRecords({}, 'durham', longCareers);

  it('inducts departing players with a top-three career of three seasons or more', () => {
    const inductees = hallOfFameInductees(records, new Set(['vet', 'short']), new Map([['vet', ['MVP 2030']]]), 2030);
    expect(inductees).toHaveLength(1);
    expect(inductees[0]).toMatchObject({ playerId: 'vet', firstYear: 2028, lastYear: 2030, inducted: 2030 });
    expect(inductees[0]!.citation).toBe('#2 career points, #2 career goals, #2 career assists, MVP 2030');
  });

  it('waits until a player leaves, and inducts him once', () => {
    const honors = new Map([['stay', ['All-America 2030']]]);
    expect(hallOfFameInductees(records, new Set(), honors, 2030)).toEqual([]);
    const first = hallOfFameInductees(records, new Set(['stay']), honors, 2030);
    expect(first.map((e) => e.playerId)).toEqual(['stay']);
    expect(hallOfFameInductees(records, new Set(['stay']), honors, 2031, first)).toEqual([]);
  });

  it('needs an honor or a program record on top of a top-three career', () => {
    // Val is #2 everywhere with no honors; Sid holds the records but in one season.
    expect(hallOfFameInductees(records, new Set(['vet', 'stay']), new Map(), 2030)).toEqual([]);
    const solo = scopeRecords({}, 'durham', { vet: longCareers.vet! });
    const inductees = hallOfFameInductees(solo, new Set(['vet']), new Map(), 2030);
    expect(inductees.map((e) => e.playerId)).toEqual(['vet']);
    expect(inductees[0]!.citation).toContain('#1 career goals');
  });
});
