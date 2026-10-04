import { describe, expect, it } from 'vitest';
import { carouselHeadline, ensureHeadCoaches, expectedWinPct, runCoachingCarousel } from './coaching-carousel';
import type { HeadCoach } from './coaching-carousel';
import type { LacrosseTeam } from './models';
import { makeLacrosseTeam } from './test-fixtures';

function program(id: string, prestige: number, wins: number, losses: number, coach?: Partial<HeadCoach>): LacrosseTeam {
  const base = makeLacrosseTeam(id, []);
  return {
    ...base,
    reputation: { ...base.reputation, nationalPrestige: prestige, coachingPrestige: 60 },
    record: { ...base.record, wins, losses },
    ...(coach
      ? {
          headCoach: {
            id: `coach-${id}`,
            name: { first: 'Coach', last: id.toUpperCase() },
            rating: 60,
            age: 50,
            hiredYear: 2024,
            wins: 30,
            losses: 30,
            careerWins: 60,
            careerLosses: 50,
            hotSeat: 0,
            ...coach,
          },
        }
      : {}),
  };
}

const YEAR = 2028;

describe('expectedWinPct', () => {
  it('asks .500 of an average program, more of bigger names', () => {
    expect(expectedWinPct(program('a', 60, 0, 0), 60)).toBeCloseTo(0.5);
    expect(expectedWinPct(program('a', 80, 0, 0), 60)).toBeCloseTo(0.62);
    expect(expectedWinPct(program('a', 30, 0, 0), 60)).toBeCloseTo(0.32);
    expect(expectedWinPct(program('a', 100, 0, 0), 40)).toBe(0.75);
  });
});

describe('ensureHeadCoaches', () => {
  it('gives every CPU program a coach at its coaching prestige, and none to the user', () => {
    const teams = ensureHeadCoaches([program('user', 70, 0, 0), program('cpu', 70, 0, 0)], 'user', YEAR, 1);
    expect(teams[0]!.headCoach).toBeUndefined();
    const coach = teams[1]!.headCoach!;
    expect(coach.rating).toBe(60);
    // A sitting coach arrives with a record to match his tenure.
    expect(coach.hiredYear).toBeLessThan(YEAR);
    expect(coach.wins + coach.losses).toBe((YEAR - coach.hiredYear) * 10);
    expect(coach.careerWins + coach.careerLosses).toBeGreaterThanOrEqual(coach.wins + coach.losses);
  });

  it('removes the coach from a program the user took over', () => {
    const [team] = ensureHeadCoaches([program('user', 70, 0, 0, {})], 'user', YEAR, 1);
    expect(team!.headCoach).toBeUndefined();
  });
});

describe('runCoachingCarousel', () => {
  it('fires a coach after a second straight losing season and hires a replacement', () => {
    const { teams, changes } = runCoachingCarousel(
      [program('user', 70, 10, 4), program('slump', 80, 3, 11, { hotSeat: 1 })],
      { userTeamId: 'user', year: YEAR, seed: 3 },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ teamId: 'slump', outgoing: { name: 'Coach SLUMP', reason: 'fired', wins: 33, losses: 41, seasons: 5 } });
    const hired = teams.find((t) => t.id === 'slump')!.headCoach!;
    expect(hired.hiredYear).toBe(YEAR + 1);
    expect(hired.wins).toBe(0);
    expect(teams.find((t) => t.id === 'slump')!.reputation.coachingPrestige).toBe(hired.rating);
  });

  it('gives a new coach two seasons before the seat gets hot', () => {
    const { changes } = runCoachingCarousel(
      [program('user', 70, 10, 4), program('rookie', 80, 1, 13, { hotSeat: 1, hiredYear: YEAR })],
      { userTeamId: 'user', year: YEAR, seed: 3 },
    );
    expect(changes).toEqual([]);
  });

  it('keeps a coach who meets expectations and credits his record', () => {
    const { teams, changes } = runCoachingCarousel(
      [program('user', 70, 10, 4), program('steady', 50, 8, 6, { hotSeat: 1 })],
      { userTeamId: 'user', year: YEAR, seed: 3 },
    );
    expect(changes).toEqual([]);
    const coach = teams.find((t) => t.id === 'steady')!.headCoach!;
    expect(coach).toMatchObject({ wins: 38, losses: 36, careerWins: 68, careerLosses: 56, hotSeat: 0, age: 51 });
    // Beating expectations by a wide margin lifts his rating, and the program's coaching prestige with it.
    expect(coach.rating).toBe(62);
    expect(teams.find((t) => t.id === 'steady')!.reputation.coachingPrestige).toBe(62);
  });

  it('lets a big program hire away a rising coach, which opens his old job', () => {
    // Several seeds: poaching happens most of the time, not every time.
    let poached = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const { teams, changes } = runCoachingCarousel(
        [
          program('user', 70, 10, 4),
          program('blueblood', 90, 2, 12, { hotSeat: 1 }),
          program('riser', 40, 13, 1, { rating: 72 }),
        ],
        { userTeamId: 'user', year: YEAR, seed },
      );
      const bigJob = changes.find((c) => c.teamId === 'blueblood')!;
      if (bigJob.incoming.fromTeamId !== 'riser') continue;
      poached += 1;
      expect(bigJob.incoming.name).toBe('Coach RISER');
      expect(changes.find((c) => c.teamId === 'riser')).toMatchObject({ outgoing: { name: 'Coach RISER', reason: 'poached' } });
      const riserCoach = teams.find((t) => t.id === 'riser')!.headCoach!;
      expect(riserCoach.name.last).not.toBe('RISER');
      // He brings his career record and a better reputation; the record at his new program starts over.
      expect(teams.find((t) => t.id === 'blueblood')!.headCoach).toMatchObject({ careerWins: 73, wins: 0, rating: 74 });
    }
    expect(poached).toBeGreaterThan(5);
    expect(poached).toBeLessThan(20);
  });

  it('retires old coaches', () => {
    const { changes } = runCoachingCarousel(
      [program('user', 70, 10, 4), program('legend', 70, 9, 5, { age: 75 })],
      { userTeamId: 'user', year: YEAR, seed: 3 },
    );
    expect(changes[0]).toMatchObject({ teamId: 'legend', outgoing: { reason: 'retired' } });
  });

  it('never touches the user program', () => {
    const { teams, changes } = runCoachingCarousel(
      [program('user', 90, 0, 14), program('cpu', 50, 7, 7, {})],
      { userTeamId: 'user', year: YEAR, seed: 3 },
    );
    expect(changes).toEqual([]);
    expect(teams[0]!.headCoach).toBeUndefined();
    expect(teams[0]!.reputation.coachingPrestige).toBe(60);
  });
});

describe('carouselHeadline', () => {
  const name = (id: string) => `${id[0]!.toUpperCase()}${id.slice(1)}`;

  it('describes each kind of move', () => {
    const outgoing = { name: 'Sam Ryan', wins: 12, losses: 26, seasons: 3 };
    expect(carouselHeadline({ teamId: 'delta', outgoing: { ...outgoing, reason: 'fired' }, incoming: { name: 'Ty Moss', rating: 70, fromTeamId: 'echo' } }, name))
      .toBe('Coaching carousel: Delta fires Sam Ryan (12-26 in 3 seasons) and hires Ty Moss away from Echo');
    expect(carouselHeadline({ teamId: 'delta', outgoing: { ...outgoing, reason: 'retired', seasons: 1 }, incoming: { name: 'Ty Moss', rating: 70 } }, name))
      .toBe('Coaching carousel: Sam Ryan retires at Delta (12-26 in 1 season); Delta hires Ty Moss');
    expect(carouselHeadline({ teamId: 'echo', outgoing: { ...outgoing, reason: 'poached' }, incoming: { name: 'Al Kim', rating: 55 } }, name))
      .toBe('Coaching carousel: Echo loses Sam Ryan (12-26 in 3 seasons) and hires Al Kim');
  });
});
