import { describe, expect, it } from 'vitest';
import type { Player, Team } from './models';
import { makePlayer, makeTeam } from './test-fixtures';
import {
  applyPortalOffer,
  applyPortalResolution,
  cpuPortalTargets,
  createPortalEntry,
  decidePortalEntry,
  generateCpuPortalOffers,
  openTransferPortal,
  portalPreferencesFor,
  portalScholarshipsPending,
  rankPortalCandidates,
  resolvePortalCommitments,
  withdrawPortalOffer,
  type PortalEntry,
} from './transfer-portal';

type Pos = 'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO';
type P = Player<Pos>;
type T = Team<Pos>;

function player(id: string, position: Pos, overrides: Partial<P> = {}): P {
  const base = makePlayer(id, position);
  return { ...base, classYear: 'JR', scholarshipPercent: 50, isWalkOn: false, ...overrides, ratings: { ...base.ratings, ...(overrides.ratings ?? {}) } };
}

function team(id: string, roster: P[], overrides: Partial<T> = {}): T {
  const base = makeTeam();
  return {
    ...base,
    id,
    name: `${id} University`,
    roster,
    resources: { ...base.resources, scholarshipUsed: roster.reduce((s, p) => s + p.scholarshipPercent / 100, 0) },
    ...overrides,
  };
}

const always = () => 0;
const never = () => 0.999;
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function entryFor(p: P, from: T, reason: 'playing_time' | 'bigger_stage' | 'closer_to_home' | 'scholarship' = 'playing_time'): PortalEntry<Pos> {
  return createPortalEntry(p, from, reason, 2029, always);
}

describe('decidePortalEntry', () => {
  const home = team('home', []);

  it('never moves freshmen, grad students, or players out of eligibility', () => {
    expect(decidePortalEntry(player('a', 'ATT', { classYear: 'FR' }), home, { depthRank: 9, starters: 3, random: always })).toBeNull();
    expect(decidePortalEntry(player('a', 'ATT', { classYear: 'GR' }), home, { depthRank: 9, starters: 3, random: always })).toBeNull();
    const done = player('a', 'ATT', { eligibility: { seasonsPlayed: 4, seasonsRemaining: 0, isEligible: false } });
    expect(decidePortalEntry(done, home, { depthRank: 9, starters: 3, random: always })).toBeNull();
  });

  it('buried players leave for playing time far more often than starters', () => {
    const trials = 4000;
    let buried = 0;
    let starters = 0;
    const random = seeded(7);
    for (let i = 0; i < trials; i += 1) {
      if (decidePortalEntry(player('b', 'MID'), home, { depthRank: 15, starters: 6, random })) buried += 1;
      if (decidePortalEntry(player('s', 'MID'), home, { depthRank: 1, starters: 6, random })) starters += 1;
    }
    expect(buried / trials).toBeGreaterThan(0.1);
    expect(buried / trials).toBeLessThan(0.2);
    expect(starters / trials).toBeLessThan(0.06);
    expect(buried).toBeGreaterThan(starters * 3);
  });

  it('a good starter at a modest program seeks a bigger stage', () => {
    const modest = team('modest', [], { reputation: { ...home.reputation, nationalPrestige: 40 } });
    const star = player('star', 'ATT', { ratings: { ...makePlayer('x', 'ATT').ratings, overall: 75 } });
    expect(decidePortalEntry(star, modest, { depthRank: 1, starters: 3, random: always })).toBe('bigger_stage');
    // The same player at a power program just stays put when the roll misses.
    expect(decidePortalEntry(star, home, { depthRank: 1, starters: 3, random: () => 0.05 })).toBeNull();
  });

  it('buried walk-ons go looking for a scholarship', () => {
    const walkOn = player('w', 'DEF', { isWalkOn: true, scholarshipPercent: 0 });
    expect(decidePortalEntry(walkOn, home, { depthRank: 8, starters: 3, random: always })).toBe('scholarship');
  });

  it('players far from home sometimes head back toward it', () => {
    const away = player('f', 'DEF', { regionId: 'west' });
    // First roll enters, second roll picks the reason.
    const rolls = [0, 0.1];
    expect(decidePortalEntry(away, home, { depthRank: 8, starters: 3, random: () => rolls.shift() ?? 0 })).toBe('closer_to_home');
    const rolls2 = [0, 0.9];
    expect(decidePortalEntry(away, home, { depthRank: 8, starters: 3, random: () => rolls2.shift() ?? 0 })).toBe('playing_time');
  });

  it('leaders stick around; low-motivation players bolt', () => {
    const chanceOf = (p: P) => {
      let entries = 0;
      const random = seeded(11);
      for (let i = 0; i < 3000; i += 1) if (decidePortalEntry(p, home, { depthRank: 10, starters: 3, random })) entries += 1;
      return entries / 3000;
    };
    const leader = chanceOf(player('l', 'MID', { traits: ['leader'] }));
    const plain = chanceOf(player('p', 'MID'));
    const unmotivated = chanceOf(player('u', 'MID', { traits: ['low_motivation'] }));
    expect(leader).toBeLessThan(plain);
    expect(unmotivated).toBeGreaterThan(plain);
  });

  it('stays home when the roll misses', () => {
    expect(decidePortalEntry(player('a', 'ATT'), home, { depthRank: 9, starters: 3, random: never })).toBeNull();
  });
});

describe('portalPreferencesFor', () => {
  it('weights the thing the player left over', () => {
    expect(portalPreferencesFor('playing_time', always).playingTimeImportance).toBeGreaterThanOrEqual(85);
    expect(portalPreferencesFor('bigger_stage', always).prestigeImportance).toBeGreaterThanOrEqual(85);
    expect(portalPreferencesFor('closer_to_home', always).proximityImportance).toBeGreaterThanOrEqual(85);
    expect(portalPreferencesFor('scholarship', always).scholarshipImportance).toBeGreaterThanOrEqual(85);
  });
});

describe('openTransferPortal', () => {
  it('pulls entrants off their roster, frees their scholarship, and keeps the full player', () => {
    const buried = player('buried', 'MID', { scholarshipPercent: 100 });
    const starter = player('starter', 'MID');
    const roster = [starter, buried];
    const teams = [team('t1', roster)];
    const rolls = [0.999, 0]; // starter stays, buried goes
    const result = openTransferPortal(teams, {
      season: 2029,
      random: () => rolls.shift() ?? 0.5,
      depthRankFor: (_t, p) => (p.id === 'starter' ? 1 : 2),
      startersAt: () => 1,
    });
    expect(result.entries.map((e) => e.playerId)).toEqual(['buried']);
    expect(result.entries[0]?.player).toBe(buried);
    expect(result.entries[0]?.id).toBe('portal-2029-buried');
    expect(result.entries[0]?.status).toBe('available');
    expect(result.teams[0]?.roster.map((p) => p.id)).toEqual(['starter']);
    expect(result.teams[0]?.resources.scholarshipUsed).toBe(0.5);
  });

  it('leaves untouched teams as the same object', () => {
    const teams = [team('t1', [player('a', 'ATT')])];
    const result = openTransferPortal(teams, { season: 2029, random: never, depthRankFor: () => 1, startersAt: () => 1 });
    expect(result.teams[0]).toBe(teams[0]);
    expect(result.entries).toEqual([]);
  });
});

describe('offers', () => {
  const from = team('from', []);
  const base = entryFor(player('p', 'ATT'), from);

  it('applyPortalOffer records the offer and lifts interest by scholarship importance', () => {
    const offered = applyPortalOffer(base, 'us', 100);
    expect(offered.offersByTeamId.us).toBe(100);
    expect(offered.interestByTeamId.us).toBe(Math.round(100 * (base.preferences.scholarshipImportance / 100) * 0.35));
    expect(applyPortalOffer(base, 'us', 500).offersByTeamId.us).toBe(100);
  });

  it('withdrawPortalOffer clears the offer and its interest', () => {
    const offered = applyPortalOffer(base, 'us', 50);
    const pulled = withdrawPortalOffer(offered, 'us');
    expect(pulled.offersByTeamId).toEqual({});
    expect(pulled.interestByTeamId).toEqual({});
    expect(withdrawPortalOffer(base, 'nobody')).toBe(base);
  });

  it('portalScholarshipsPending sums only live offers from one team', () => {
    const a = applyPortalOffer(base, 'us', 100);
    const b = applyPortalOffer({ ...base, id: 'e2' }, 'us', 50);
    const gone = { ...applyPortalOffer({ ...base, id: 'e3' }, 'us', 100), status: 'committed' as const };
    expect(portalScholarshipsPending([a, b, gone], 'us')).toBe(1.5);
    expect(portalScholarshipsPending([a, b, gone], 'them')).toBe(0);
  });
});

describe('cpuPortalTargets and generateCpuPortalOffers', () => {
  const ovr = (overall: number) => ({ ...makePlayer('x', 'ATT').ratings, overall });
  const from = team('from', []);
  const weakRoster = [player('a1', 'ATT', { ratings: ovr(55) }), player('a2', 'ATT', { ratings: ovr(52) }), player('g1', 'GK', { ratings: ovr(70) })];

  it('targets players who would start, best upgrade first, with pay by rating', () => {
    const cpu = team('cpu', weakRoster);
    const stud = entryFor(player('stud', 'ATT', { ratings: ovr(74) }), from);
    const solid = entryFor(player('solid', 'ATT', { ratings: ovr(64) }), from);
    const worse = entryFor(player('worse', 'ATT', { ratings: ovr(50) }), from);
    const goalie = entryFor(player('gk', 'GK', { ratings: ovr(71) }), from);
    const targets = cpuPortalTargets(cpu, [worse, solid, stud, goalie], { random: always, startersAt: (pos) => (pos === 'GK' ? 1 : 2), rosterLimit: 48 });
    expect(targets.map((t) => t.entry.playerId)).toEqual(['stud', 'solid']);
    expect(targets.map((t) => t.scholarshipPercent)).toEqual([100, 50]);
  });

  it('a thin position group takes anyone better than its worst player', () => {
    const cpu = team('cpu', [player('a1', 'ATT', { ratings: ovr(70) }), player('a2', 'ATT', { ratings: ovr(50) })]);
    const depth = entryFor(player('depth', 'ATT', { ratings: ovr(56) }), from);
    expect(cpuPortalTargets(cpu, [depth], { random: always, startersAt: () => 2, rosterLimit: 48 })).toHaveLength(1);
    const deep = team('deep', [70, 68, 66, 64].map((o, i) => player(`a${i}`, 'ATT', { ratings: ovr(o) })));
    expect(cpuPortalTargets(deep, [depth], { random: always, startersAt: () => 2, rosterLimit: 48 })).toHaveLength(0);
  });

  it('skips its own departures, taken entries, and full position groups', () => {
    const cpu = team('cpu', weakRoster);
    const own = entryFor(player('own', 'ATT', { ratings: ovr(80) }), cpu);
    const taken = { ...entryFor(player('taken', 'ATT', { ratings: ovr(80) }), from), status: 'committed' as const };
    const good = entryFor(player('good', 'ATT', { ratings: ovr(80) }), from);
    expect(cpuPortalTargets(cpu, [own, taken, good], { random: always, startersAt: () => 2, rosterLimit: 48 }).map((t) => t.entry.playerId)).toEqual(['good']);
    expect(cpuPortalTargets(cpu, [good], { random: always, startersAt: () => 2, rosterLimit: 48, positionCapFor: () => 2 })).toEqual([]);
  });

  it('weak programs do not chase elite transfers', () => {
    const cpu = team('cpu', weakRoster, { reputation: { ...from.reputation, nationalPrestige: 30 } });
    const elite = entryFor(player('elite', 'ATT', { ratings: ovr(85) }), from);
    expect(cpuPortalTargets(cpu, [elite], { random: always, startersAt: () => 2, rosterLimit: 48 })).toEqual([]);
  });

  it('every CPU team offers within its roster room, budget, and per-team cap, skipping the user', () => {
    const entries = ['e1', 'e2', 'e3', 'e4', 'e5'].map((id, i) => entryFor(player(id, 'ATT', { ratings: ovr(70 + i) }), from));
    const cpu = team('cpu', weakRoster);
    const user = team('user', weakRoster);
    const broke = team('broke', weakRoster, { resources: { ...from.resources, scholarshipLimit: 12.6, scholarshipUsed: 12.6 } });
    const full = team('full', weakRoster);
    const offered = generateCpuPortalOffers(entries, [cpu, user, broke, full], {
      random: seeded(3),
      startersAt: () => 2,
      rosterLimit: 3,
      skipTeamIds: ['user'],
      maxOffersPerTeam: 2,
    });
    // `full` and `cpu` both sit at the roster limit of 3, so nobody has room.
    expect(offered.every((e) => Object.keys(e.offersByTeamId).length === 0)).toBe(true);

    const roomy = generateCpuPortalOffers(entries, [cpu, user, broke], {
      random: seeded(3),
      startersAt: () => 2,
      rosterLimit: 48,
      skipTeamIds: ['user'],
      maxOffersPerTeam: 2,
    });
    const cpuOffers = roomy.filter((e) => e.offersByTeamId.cpu !== undefined);
    expect(cpuOffers).toHaveLength(2);
    // Best upgrades first: the two highest-rated entries.
    expect(cpuOffers.map((e) => e.playerId).sort()).toEqual(['e4', 'e5']);
    expect(roomy.some((e) => e.offersByTeamId.user !== undefined)).toBe(false);
    // Out of scholarship money means walk-on offers only.
    for (const e of roomy) if (e.offersByTeamId.broke !== undefined) expect(e.offersByTeamId.broke).toBe(0);
  });

  it('caps how many programs pile onto one player', () => {
    const entry = entryFor(player('hot', 'ATT', { ratings: ovr(76) }), from);
    const teams = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id) => team(id, weakRoster));
    const [offered] = generateCpuPortalOffers([entry], teams, { random: seeded(1), startersAt: () => 2, rosterLimit: 48 });
    expect(Object.keys(offered!.offersByTeamId)).toHaveLength(2);
  });
});

describe('rankPortalCandidates and resolvePortalCommitments', () => {
  const ovr = (overall: number) => ({ ...makePlayer('x', 'ATT').ratings, overall });
  const from = team('from', []);

  it('a playing-time transfer picks the program with the clearest path to the field', () => {
    const entry = entryFor(player('p', 'ATT', { ratings: ovr(65) }), from, 'playing_time');
    const crowded = team('crowded', [player('c1', 'ATT', { ratings: ovr(80) }), player('c2', 'ATT', { ratings: ovr(78) }), player('c3', 'ATT', { ratings: ovr(70) })]);
    const open = team('open', [player('o1', 'ATT', { ratings: ovr(55) })]);
    const offered = applyPortalOffer(applyPortalOffer(entry, 'crowded', 100), 'open', 100);
    const ranked = rankPortalCandidates(offered, [crowded, open]);
    expect(ranked[0]?.teamId).toBe('open');
    expect(ranked[0]?.playersAhead).toBe(0);
    expect(ranked[1]?.playersAhead).toBe(3);
    expect(ranked).toHaveLength(2);
  });

  it('a bigger-stage transfer picks prestige', () => {
    const entry = entryFor(player('p', 'ATT', { ratings: ovr(72) }), from, 'bigger_stage');
    const power = team('power', [], { reputation: { ...from.reputation, nationalPrestige: 95, recentSuccess: 95 } });
    const small = team('small', [], { reputation: { ...from.reputation, nationalPrestige: 35, recentSuccess: 35 } });
    const offered = applyPortalOffer(applyPortalOffer(entry, 'small', 100), 'power', 100);
    expect(rankPortalCandidates(offered, [small, power])[0]?.teamId).toBe('power');
  });

  it('commits to the top candidate and withdraws without offers', () => {
    const entry = entryFor(player('p', 'ATT', { ratings: ovr(65) }), from);
    const dest = team('dest', []);
    const resolved = resolvePortalCommitments([applyPortalOffer(entry, 'dest', 50), { ...entry, id: 'none' }], [dest]);
    expect(resolved[0]?.status).toBe('committed');
    expect(resolved[0]?.committedTeamId).toBe('dest');
    expect(resolved[1]?.status).toBe('withdrawn');
    // Already-resolved entries pass through.
    expect(resolvePortalCommitments(resolved, [dest])).toEqual(resolved);
  });

  it('withdraws when the only offer comes from a team that no longer exists', () => {
    const entry = applyPortalOffer(entryFor(player('p', 'ATT'), from), 'ghost', 100);
    expect(resolvePortalCommitments([entry], [from])[0]?.status).toBe('withdrawn');
  });
});

describe('applyPortalResolution', () => {
  it('moves commits onto their new roster with the offered scholarship and a transfer record', () => {
    const mover = player('mover', 'ATT', { scholarshipPercent: 100 });
    const from = team('from', []);
    const dest = team('dest', [player('d1', 'ATT')]);
    const entry = { ...applyPortalOffer(entryFor(mover, from), 'dest', 50), status: 'committed' as const, committedTeamId: 'dest' };
    const { teams, moves } = applyPortalResolution([from, dest], [entry], 2029);
    const landed = teams[1]?.roster.find((p) => p.id === 'mover');
    expect(landed?.scholarshipPercent).toBe(50);
    expect(landed?.isWalkOn).toBe(false);
    expect(landed?.transfers).toEqual([{ season: 2029, fromTeamId: 'from', toTeamId: 'dest' }]);
    expect(teams[1]?.resources.scholarshipUsed).toBe(1);
    expect(teams[0]?.roster).toEqual([]);
    expect(moves).toEqual([
      expect.objectContaining({ playerId: 'mover', fromTeamId: 'from', toTeamId: 'dest', overall: 60, outcome: 'transferred' }),
    ]);
  });

  it('sends withdrawals back to their old program', () => {
    const stayer = player('stayer', 'MID');
    const from = team('from', [player('m1', 'MID')]);
    const entry = { ...entryFor(stayer, from), status: 'withdrawn' as const };
    const { teams, moves } = applyPortalResolution([from], [entry], 2029);
    expect(teams[0]?.roster.map((p) => p.id)).toEqual(['m1', 'stayer']);
    expect(teams[0]?.roster[1]?.morale).toBe(40);
    expect(moves[0]?.toTeamId).toBeUndefined();
    expect(moves[0]?.outcome).toBe('returned');
  });

  it('a walk-on nobody offered leaves for a smaller school', () => {
    const walkOn = player('w', 'MID', { isWalkOn: true, scholarshipPercent: 0 });
    const from = team('from', []);
    const entry = { ...entryFor(walkOn, from, 'scholarship'), status: 'withdrawn' as const };
    const { teams, moves } = applyPortalResolution([from], [entry], 2029);
    expect(teams[0]?.roster).toEqual([]);
    expect(moves[0]?.outcome).toBe('left_division');
  });

  it('ignores entries still deciding and never duplicates a player already on the roster', () => {
    const p = player('p', 'MID');
    const from = team('from', [p]);
    const pending = entryFor(p, from);
    const dup = { ...pending, status: 'withdrawn' as const };
    expect(applyPortalResolution([from], [pending], 2029).teams[0]).toBe(from);
    expect(applyPortalResolution([from], [dup], 2029).teams[0]?.roster).toHaveLength(1);
  });

  it('a committed walk-on offer lands as a walk-on', () => {
    const p = player('p', 'MID', { scholarshipPercent: 25 });
    const from = team('from', []);
    const dest = team('dest', []);
    const entry = { ...applyPortalOffer(entryFor(p, from), 'dest', 0), status: 'committed' as const, committedTeamId: 'dest' };
    expect(applyPortalResolution([from, dest], [entry], 2029).teams[1]?.roster[0]?.isWalkOn).toBe(true);
  });
});
