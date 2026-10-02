import { describe, expect, it } from 'vitest';
import { createNewLacrosseDynasty } from './dynasty';
import type { LacrossePosition, LacrosseTeam } from './models';
import { makeLacrosseRoster, makeLacrosseTeam } from './test-fixtures';
import {
  generateLacrosseCpuPortalOffers,
  LACROSSE_PORTAL_POSITION_CAPS,
  LACROSSE_ROSTER_LIMIT,
  openLacrossePortal,
  resolveLacrossePortal,
} from './transfer-portal';

/** A league-sized roster set after the offseason: every class but freshmen is eligible to move. */
function leagueTeams(): LacrosseTeam[] {
  const dynasty = createNewLacrosseDynasty({ seed: 42, userTeamId: 'maryland-state', seasonYear: 2028 });
  return dynasty.season.teams.map((team) => ({
    ...team,
    roster: team.roster.map((p, i) => ({ ...p, classYear: (['SO', 'JR', 'SR', 'SO'] as const)[i % 4]! })),
  }));
}

describe('openLacrossePortal', () => {
  it('produces a league-sized portal, a few players per program, and takes them off rosters', () => {
    const teams = leagueTeams();
    const before = teams.reduce((sum, t) => sum + t.roster.length, 0);
    const { teams: after, entries } = openLacrossePortal(teams, { seed: 42, season: 2029 });
    const perTeam = entries.length / teams.length;
    expect(perTeam).toBeGreaterThan(1);
    expect(perTeam).toBeLessThan(5);
    expect(after.reduce((sum, t) => sum + t.roster.length, 0)).toBe(before - entries.length);
    for (const entry of entries) {
      const source = after.find((t) => t.id === entry.sourceTeamId)!;
      expect(source.roster.some((p) => p.id === entry.playerId)).toBe(false);
      expect(entry.enteredSeason).toBe(2029);
      expect(entry.player.id).toBe(entry.playerId);
    }
  });

  it('is deterministic for a seed and mostly about playing time', () => {
    const teams = leagueTeams();
    const a = openLacrossePortal(teams, { seed: 9, season: 2029 });
    const b = openLacrossePortal(teams, { seed: 9, season: 2029 });
    expect(a.entries.map((e) => e.id)).toEqual(b.entries.map((e) => e.id));
    const reasons = new Set(a.entries.map((e) => e.reason));
    expect(reasons.has('playing_time')).toBe(true);
    const counts = new Map<string, number>();
    for (const e of a.entries) counts.set(e.reason, (counts.get(e.reason) ?? 0) + 1);
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
    expect(top).toBe('playing_time');
  });

  it('a coach-picked starter is treated as a starter even when lower rated', () => {
    const roster = makeLacrosseRoster(45).map((p) => ({ ...p, classYear: 'JR' as const }));
    const pick = roster[44]!;
    const team: LacrosseTeam = { ...makeLacrosseTeam('t1', roster), depthChart: { MID: [pick.id] } };
    // Across many seeds, the hand-picked first-string middie leaves far less
    // often than a middie buried on the default chart.
    let pickLeft = 0;
    let buriedLeft = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const { entries } = openLacrossePortal([team], { seed, season: 2029 });
      if (entries.some((e) => e.playerId === pick.id)) pickLeft += 1;
      if (entries.some((e) => e.playerId === roster[30]!.id)) buriedLeft += 1;
    }
    expect(pickLeft).toBeLessThan(buriedLeft / 2);
  });
});

describe('generateLacrosseCpuPortalOffers', () => {
  it('CPU programs offer, the user never does, and no position group overfills', () => {
    const teams = leagueTeams();
    const opened = openLacrossePortal(teams, { seed: 42, season: 2029 });
    const offered = generateLacrosseCpuPortalOffers(opened.entries, opened.teams, { seed: 42, userTeamId: 'maryland-state' });
    const offers = offered.flatMap((e) => Object.keys(e.offersByTeamId));
    expect(offers.length).toBeGreaterThan(teams.length);
    expect(offers).not.toContain('maryland-state');
    const byTeam = new Map<string, number>();
    for (const id of offers) byTeam.set(id, (byTeam.get(id) ?? 0) + 1);
    for (const count of byTeam.values()) expect(count).toBeLessThanOrEqual(4);
    for (const entry of offered) expect(Object.keys(entry.offersByTeamId).length).toBeLessThanOrEqual(2);
    for (const team of opened.teams) {
      for (const [position, cap] of Object.entries(LACROSSE_PORTAL_POSITION_CAPS) as [LacrossePosition, number][]) {
        const held = team.roster.filter((p) => p.position === position).length;
        const shopping = offered.filter((e) => e.position === position && e.offersByTeamId[team.id] !== undefined).length;
        if (held >= cap) expect(shopping).toBe(0);
      }
      expect(team.roster.length + offers.filter((id) => id === team.id).length).toBeLessThanOrEqual(LACROSSE_ROSTER_LIMIT);
    }
  });
});

describe('resolveLacrossePortal', () => {
  it('lands commits on new rosters, returns withdrawals, and reports every move', () => {
    const teams = leagueTeams();
    const opened = openLacrossePortal(teams, { seed: 42, season: 2029 });
    const offered = generateLacrosseCpuPortalOffers(opened.entries, opened.teams, { seed: 42, userTeamId: 'maryland-state' });
    const { teams: after, entries, moves } = resolveLacrossePortal(offered, opened.teams, 2029);
    expect(entries.every((e) => e.status !== 'available')).toBe(true);
    expect(moves).toHaveLength(entries.length);
    const committed = entries.filter((e) => e.status === 'committed');
    expect(committed.length).toBeGreaterThan(0);
    const withdrawn = entries.filter((e) => e.status === 'withdrawn');
    expect(withdrawn.length).toBeGreaterThan(0);
    // Most of the portal finds a new home rather than going back.
    expect(committed.length).toBeGreaterThan(entries.length * 0.35);
    for (const entry of committed) {
      const dest = after.find((t) => t.id === entry.committedTeamId)!;
      const landed = dest.roster.find((p) => p.id === entry.playerId);
      expect(landed?.transfers?.at(-1)).toEqual({ season: 2029, fromTeamId: entry.sourceTeamId, toTeamId: entry.committedTeamId });
      expect(landed?.scholarshipPercent).toBe(entry.offersByTeamId[entry.committedTeamId!]);
    }
    for (const entry of withdrawn) {
      const home = after.find((t) => t.id === entry.sourceTeamId)!;
      expect(home.roster.some((p) => p.id === entry.playerId)).toBe(!entry.player.isWalkOn);
    }
    // Only unwanted walk-ons leave the league.
    const before = teams.reduce((sum, t) => sum + t.roster.length, 0);
    const gone = moves.filter((m) => m.outcome === 'left_division').length;
    expect(after.reduce((sum, t) => sum + t.roster.length, 0)).toBe(before - gone);
  });

});
