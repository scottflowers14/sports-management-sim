import { advanceSeasonWeek } from '@sports-management-sim/engine-core';
import { createNewLacrosseDynasty, offerLacrossePortalPlayer, simulateLacrosseGame } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseDynastyState } from '@sports-management-sim/sport-lacrosse';
import { describe, expect, it } from 'vitest';
import { resolveAndApplyPortal, runOffseason } from './dynasty-helpers';

function simFullSeason(dynasty: LacrosseDynastyState): LacrosseDynastyState {
  let season = dynasty.season;
  while (season.schedule.some((g) => g.status === 'scheduled')) {
    season = advanceSeasonWeek(season, (_game, homeTeam, awayTeam) =>
      simulateLacrosseGame({ homeTeam, awayTeam }),
    );
  }
  return { ...dynasty, season };
}

describe('multi-season dynasty rollover', () => {
  it('rolls over three seasons: year increments, new schedule, class years advance', () => {
    let dynasty = createNewLacrosseDynasty({
      seed: 42,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });

    const initialRosterIds = new Set(
      dynasty.season.teams.find((t) => t.id === 'maryland-state')!.roster.map((p) => p.id),
    );

    for (let cycle = 0; cycle < 3; cycle++) {
      const yearBefore = dynasty.season.year;

      dynasty = simFullSeason(dynasty);

      expect(dynasty.season.schedule.every((g) => g.status === 'final')).toBe(true);
      expect(dynasty.season.standings).toHaveLength(8);

      const { newDynasty } = runOffseason(dynasty);
      dynasty = newDynasty;

      expect(dynasty.season.year).toBe(yearBefore + 1);
      expect(dynasty.season.currentWeek).toBe(1);
      expect(dynasty.season.phase).toBe('regular_season');
      expect(dynasty.season.schedule.every((g) => g.status === 'scheduled')).toBe(true);
      expect(dynasty.season.schedule.length).toBeGreaterThan(0);
      expect(dynasty.recruits.length).toBeGreaterThan(0);
    }

    expect(dynasty.season.year).toBe(2031);
  });

  it('graduates seniors and adds freshmen each offseason', () => {
    let dynasty = createNewLacrosseDynasty({
      seed: 77,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });

    const userTeamBefore = dynasty.season.teams.find((t) => t.id === 'maryland-state')!;
    const seniorsBefore = userTeamBefore.roster.filter((p) => p.classYear === 'SR').map((p) => p.id);

    dynasty = simFullSeason(dynasty);

    // Offer scholarships to some recruits so they sign
    const openRecruits = dynasty.recruits.filter((r) => r.status === 'open').slice(0, 5);
    for (const recruit of openRecruits) {
      const idx = dynasty.recruits.findIndex((r) => r.id === recruit.id);
      dynasty = {
        ...dynasty,
        recruits: dynasty.recruits.map((r, i) =>
          i === idx
            ? {
                ...r,
                status: 'committed' as const,
                committedTeamId: 'maryland-state',
                scholarshipOffers: [{ teamId: 'maryland-state', scholarshipPercent: 100 }],
              }
            : r,
        ),
      };
    }

    const { newDynasty, summary } = runOffseason(dynasty);

    // Seniors should be gone
    const userTeamAfter = newDynasty.season.teams.find((t) => t.id === 'maryland-state')!;
    for (const seniorId of seniorsBefore) {
      expect(userTeamAfter.roster.find((p) => p.id === seniorId)).toBeUndefined();
    }

    // Summary lists graduates
    expect(summary.graduates.length).toBe(seniorsBefore.length);

    // Freshmen from signing class should be on the roster
    expect(summary.signingClass.length).toBeGreaterThan(0);
    const freshmen = userTeamAfter.roster.filter((p) => p.classYear === 'FR');
    expect(freshmen.length).toBeGreaterThan(0);

    // No seniors remain from previous class (they graduated)
    const returningFromBefore = userTeamAfter.roster.filter((p) =>
      seniorsBefore.includes(p.id),
    );
    expect(returningFromBefore).toHaveLength(0);
  });

  it('advances all player class years after offseason', () => {
    let dynasty = createNewLacrosseDynasty({
      seed: 99,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });

    const userTeamBefore = dynasty.season.teams.find((t) => t.id === 'maryland-state')!;
    const freshmenBefore = userTeamBefore.roster
      .filter((p) => p.classYear === 'FR')
      .map((p) => p.id);

    dynasty = simFullSeason(dynasty);
    const { newDynasty } = runOffseason(dynasty);

    const userTeamAfter = newDynasty.season.teams.find((t) => t.id === 'maryland-state')!;
    for (const frId of freshmenBefore) {
      const player = userTeamAfter.roster.find((p) => p.id === frId);
      expect(player?.classYear).toBe('SO');
    }
  });

  it('sets createdSeason on freshmen to the upcoming season year, not the outgoing year', () => {
    let dynasty = createNewLacrosseDynasty({
      seed: 88,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });

    // Commit some recruits manually so they sign during offseason
    dynasty = {
      ...dynasty,
      recruits: dynasty.recruits.map((r, i) =>
        i < 4
          ? {
              ...r,
              status: 'committed' as const,
              committedTeamId: 'maryland-state',
              scholarshipOffers: [{ teamId: 'maryland-state', scholarshipPercent: 100 }],
            }
          : r,
      ),
    };

    dynasty = simFullSeason(dynasty);
    const { newDynasty } = runOffseason(dynasty);

    const freshmen = newDynasty.season.teams
      .find((t) => t.id === 'maryland-state')!
      .roster.filter((p) => p.classYear === 'FR');

    expect(freshmen.length).toBeGreaterThan(0);
    for (const player of freshmen) {
      expect(player.createdSeason).toBe(newDynasty.season.year);
    }
  });

  it('generates a fresh recruit pool each season', () => {
    let dynasty = createNewLacrosseDynasty({
      seed: 55,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });
    const recruitIdsBefore = new Set(dynasty.recruits.map((r) => r.id));

    dynasty = simFullSeason(dynasty);
    const { newDynasty } = runOffseason(dynasty);

    const recruitIdsAfter = new Set(newDynasty.recruits.map((r) => r.id));
    const overlap = [...recruitIdsAfter].filter((id) => recruitIdsBefore.has(id));
    expect(overlap).toHaveLength(0);
    expect(newDynasty.recruits.length).toBeGreaterThan(0);
  });

  it('prunes graduated player IDs from the stored depth chart', () => {
    let dynasty = createNewLacrosseDynasty({
      seed: 33,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });

    // Manually set a depth chart with a player who will graduate (SR)
    const userTeam = dynasty.season.teams.find((t) => t.id === 'maryland-state')!;
    const seniorPlayer = userTeam.roster.find((p) => p.classYear === 'SR');
    if (seniorPlayer) {
      dynasty = {
        ...dynasty,
        season: {
          ...dynasty.season,
          teams: dynasty.season.teams.map((t) =>
            t.id === 'maryland-state'
              ? { ...t, depthChart: { [seniorPlayer.position]: [seniorPlayer.id] } }
              : t,
          ),
        },
      };
    }

    dynasty = simFullSeason(dynasty);
    const { newDynasty } = runOffseason(dynasty);

    const updatedTeam = newDynasty.season.teams.find((t) => t.id === 'maryland-state')!;
    const dc = (updatedTeam as typeof updatedTeam & { depthChart?: Record<string, string[]> }).depthChart;
    if (dc && seniorPlayer) {
      for (const ids of Object.values(dc)) {
        expect(ids).not.toContain(seniorPlayer.id);
      }
    }
  });
});

describe('transfer portal lifecycle', () => {
  it('generates portal entries after offseason and hydrates empty for new dynasties', () => {
    const dynasty = createNewLacrosseDynasty({
      seed: 99,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });
    // Fresh dynasty has no portal entries
    expect(dynasty.portalEntries).toEqual([]);

    const afterSeason = simFullSeason(dynasty);
    const { newDynasty } = runOffseason(afterSeason);
    // After first offseason, portal entries are generated from AI team rosters
    expect(newDynasty.portalEntries.length).toBeGreaterThan(0);
    expect(newDynasty.portalEntries.every((e) => e.status === 'available')).toBe(true);
    // Portal players all come from AI teams, never from the user team
    expect(newDynasty.portalEntries.every((e) => e.sourceTeamId !== 'maryland-state')).toBe(true);
  });

  it('offered portal player commits to user team, leaves source team, and updates scholarship', () => {
    const dynasty = createNewLacrosseDynasty({
      seed: 77,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });

    const afterSeason = simFullSeason(dynasty);
    const { newDynasty } = runOffseason(afterSeason);

    // Pick the first available portal entry and offer
    const target = newDynasty.portalEntries.find((e) => e.status === 'available');
    expect(target).toBeDefined();
    if (!target) return;

    const withOffer = offerLacrossePortalPlayer(newDynasty, target.id, 100);
    expect(withOffer.portalEntries.find((e) => e.id === target.id)?.offersByTeamId['maryland-state']).toBe(100);

    const resolved = resolveAndApplyPortal(withOffer);
    const committedEntry = resolved.portalEntries.find((e) => e.id === target.id);

    // Entry resolved one way or another
    expect(committedEntry?.status).not.toBe('available');

    if (committedEntry?.committedTeamId === 'maryland-state') {
      // Player is on user roster
      const userTeam = resolved.season.teams.find((t) => t.id === 'maryland-state')!;
      const isOnRoster = userTeam.roster.some((p) => p.name.first === target.name.first && p.name.last === target.name.last);
      expect(isOnRoster).toBe(true);

      // Player is NOT on source team anymore
      const sourceTeam = resolved.season.teams.find((t) => t.id === target.sourceTeamId)!;
      const stillOnSource = sourceTeam.roster.some((p) => p.id === target.playerId);
      expect(stillOnSource).toBe(false);

      // Scholarship usage is within the cap and the new player has the offered percent
      expect(userTeam.resources.scholarshipUsed).toBeLessThanOrEqual(userTeam.resources.scholarshipLimit);
      // Portal players get a deterministic ID: portal-player-<entry.id>
      const newPlayer = userTeam.roster.find((p) => p.id === `portal-player-${target.id}`);
      expect(newPlayer).toBeDefined();
      expect(newPlayer?.scholarshipPercent).toBe(100);
    } else {
      // Player still left source team (they went elsewhere or withdrew)
      const sourceTeam = resolved.season.teams.find((t) => t.id === target.sourceTeamId)!;
      const stillOnSource = sourceTeam.roster.some((p) => p.id === target.playerId);
      expect(stillOnSource).toBe(false);
    }
  });

  it('portal players are always removed from source teams on resolution regardless of destination', () => {
    const dynasty = createNewLacrosseDynasty({
      seed: 55,
      userTeamId: 'maryland-state',
      seasonYear: 2028,
    });

    const afterSeason = simFullSeason(dynasty);
    const { newDynasty } = runOffseason(afterSeason);
    // Resolve without offering — all entries should withdraw
    const resolved = resolveAndApplyPortal(newDynasty);

    for (const entry of resolved.portalEntries) {
      const sourceTeam = resolved.season.teams.find((t) => t.id === entry.sourceTeamId);
      if (!sourceTeam) continue;
      const stillPresent = sourceTeam.roster.some((p) => p.id === entry.playerId);
      expect(stillPresent).toBe(false);
    }
  });
});
