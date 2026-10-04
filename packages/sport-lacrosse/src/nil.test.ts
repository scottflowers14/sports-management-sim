import { describe, expect, it } from 'vitest';
import { applyPortalOffer } from '@sports-management-sim/engine-core';
import { createNewLacrosseDynasty } from './dynasty';
import { openLacrossePortal } from './transfer-portal';
import {
  NIL_PORTAL_INTEREST_BOOST,
  NIL_RETENTION_ODDS,
  cancelNilPortalDeal,
  nilCollectiveBudget,
  nilRemaining,
  nilRetentionAsk,
  nilRetentionRoll,
  nilValue,
  pitchNilRetention,
  signNilPortalDeal,
  type NilState,
} from './nil';

const dynasty = createNewLacrosseDynasty({ seed: 11, userTeamId: 'maryland-state', seasonYear: 2028 });
const portal = openLacrossePortal(dynasty.season.teams, { seed: 11, season: 2029 });
const user = 'maryland-state';
const fresh = (budget = 10_000_000): NilState => ({ year: 2029, budget, deals: [] });

/** A source team with someone in the portal, standing in for the user. */
const sourceId = portal.entries[0]!.sourceTeamId;
const ours = portal.entries.filter((e) => e.sourceTeamId === sourceId);

describe('NIL collective', () => {
  it('raises more money at bigger programs and pays stars more', () => {
    expect(nilCollectiveBudget({ reputation: { nationalPrestige: 80 } } as never)).toBeGreaterThan(
      nilCollectiveBudget({ reputation: { nationalPrestige: 50 } } as never),
    );
    expect(nilValue(80)).toBeGreaterThan(nilValue(65));
    expect(nilValue(40)).toBe(10_000);
  });

  it('keeps a player home or lets him go, the same way every time', () => {
    for (const entry of ours) {
      const result = pitchNilRetention(fresh(), portal.teams, portal.entries, entry.id, sourceId, 5)!;
      expect(result.retained).toBe(nilRetentionRoll(entry.id, 5) < NIL_RETENTION_ODDS[entry.reason]);
      const team = result.teams.find((t) => t.id === sourceId)!;
      if (result.retained) {
        expect(team.roster.some((p) => p.id === entry.playerId)).toBe(true);
        expect(result.entries.some((e) => e.id === entry.id)).toBe(false);
        expect(team.resources.scholarshipUsed).toBeGreaterThanOrEqual(
          portal.teams.find((t) => t.id === sourceId)!.resources.scholarshipUsed,
        );
        expect(nilRemaining(result.state)).toBe(10_000_000 - nilRetentionAsk(entry));
      } else {
        expect(result.entries).toBe(portal.entries);
        expect(nilRemaining(result.state)).toBe(10_000_000);
      }
      // One pitch per player.
      expect(pitchNilRetention(result.state, result.teams, portal.entries, entry.id, sourceId, 5)).toBeNull();
    }
  });

  it('lands retention deals at about the advertised rate', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `portal-2029-p${i}`);
    const kept = ids.filter((id) => nilRetentionRoll(id, 3) < 0.5).length;
    expect(kept / ids.length).toBeGreaterThan(0.45);
    expect(kept / ids.length).toBeLessThan(0.55);
  });

  it('refuses players from other programs and deals the collective cannot cover', () => {
    const entry = ours[0]!;
    expect(pitchNilRetention(fresh(), portal.teams, portal.entries, entry.id, user === sourceId ? 'other' : user, 5)).toBeNull();
    expect(pitchNilRetention(fresh(nilRetentionAsk(entry) - 5_000), portal.teams, portal.entries, entry.id, sourceId, 5)).toBeNull();
  });

  it('sweetens a portal offer and refunds it when cancelled', () => {
    const target = portal.entries.find((e) => e.sourceTeamId !== user)!;
    expect(signNilPortalDeal(fresh(), portal.entries, target.id, user)).toBeNull();
    const offered = portal.entries.map((e) => (e.id === target.id ? applyPortalOffer(e, user, 100) : e));
    const before = offered.find((e) => e.id === target.id)!.interestByTeamId[user]!;
    const signed = signNilPortalDeal(fresh(1_000_000), offered, target.id, user)!;
    expect(signed.entries.find((e) => e.id === target.id)!.interestByTeamId[user]).toBe(Math.min(100, before + NIL_PORTAL_INTEREST_BOOST));
    expect(nilRemaining(signed.state)).toBeLessThan(1_000_000);
    expect(signNilPortalDeal(signed.state, signed.entries, target.id, user)).toBeNull();
    expect(nilRemaining(cancelNilPortalDeal(signed.state, target.id))).toBe(1_000_000);
  });
});
