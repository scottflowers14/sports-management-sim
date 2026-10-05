import { describe, expect, it } from 'vitest';
import { createNewLacrosseDynasty, createLacrosseSeasonSchedule } from './dynasty';
import { buildRivalries } from './rivalries';
import {
  REALIGNMENT_PRESTIGE_GAP,
  applyRealignment,
  bestRealignmentCase,
  conferenceStrength,
  planRealignment,
  realignmentHeadline,
  realignmentInvolves,
} from './realignment';
import type { LacrosseTeam } from './models';

const dynasty = createNewLacrosseDynasty({ seed: 5, userTeamId: 'maryland-state', seasonYear: 2028 });
const { conferences } = dynasty.season;
const rivalries = buildRivalries(conferences, dynasty.season.teams);
const prestigeOf = (teams: LacrosseTeam[]) => (id: string) => teams.find((t) => t.id === id)!.reputation.nationalPrestige;

/** Pumps one rivalry pair in the weakest league so it clearly outgrows a stronger one. */
function withRisingPair(): { teams: LacrosseTeam[]; pair: [string, string]; weakest: string } {
  const weakest = [...conferences].sort(
    (a, b) => conferenceStrength(a, prestigeOf(dynasty.season.teams)) - conferenceStrength(b, prestigeOf(dynasty.season.teams)),
  )[0]!;
  const rivalry = rivalries.find((r) => weakest.teamIds.includes(r.teamIds[0]) && !r.teamIds.includes('maryland-state'))!;
  const teams = dynasty.season.teams.map((t) =>
    rivalry.teamIds.includes(t.id) ? { ...t, reputation: { ...t.reputation, nationalPrestige: 95 } } : t,
  );
  return { teams, pair: [...rivalry.teamIds], weakest: weakest.id };
}

const base = { conferences, rivalries, year: 2029, userTeamId: 'maryland-state' };

describe('conference realignment', () => {
  it('moves a rising pair up and a fading pair down', () => {
    const { teams, pair, weakest } = withRisingPair();
    const move = bestRealignmentCase({ ...base, teams })!;
    expect(move).not.toBeNull();
    expect([...move.risingTeamIds].sort()).toEqual([...pair].sort());
    expect(move.fromConferenceId).toBe(weakest);
    expect(conferenceStrength(conferences.find((c) => c.id === move.toConferenceId)!, prestigeOf(teams))).toBeGreaterThan(
      conferenceStrength(conferences.find((c) => c.id === weakest)!, prestigeOf(teams)),
    );
    const p = prestigeOf(teams);
    const avg = (ids: readonly string[]) => (p(ids[0]!) + p(ids[1]!)) / 2;
    expect(avg(move.risingTeamIds) - avg(move.fadingTeamIds)).toBeGreaterThanOrEqual(REALIGNMENT_PRESTIGE_GAP);
    expect(realignmentHeadline(move, (id) => id, (id) => id)).toContain(`jump from the ${weakest}`);
  });

  it('keeps conference sizes, trophy games and a sound schedule after the swap', () => {
    const { teams } = withRisingPair();
    const move = bestRealignmentCase({ ...base, teams })!;
    const after = applyRealignment(conferences, teams, move);
    expect(after.conferences.map((c) => c.teamIds.length)).toEqual(conferences.map((c) => c.teamIds.length));
    for (const t of after.teams) expect(after.conferences.find((c) => c.id === t.conferenceId)!.teamIds).toContain(t.id);
    for (const r of rivalries) {
      const home = after.conferences.find((c) => c.teamIds.includes(r.teamIds[0]))!;
      expect(home.teamIds).toContain(r.teamIds[1]);
    }
    const schedule = createLacrosseSeasonSchedule(2029, after.conferences);
    for (const r of rivalries) {
      const game = schedule.find((g) => [g.homeTeamId, g.awayTeamId].sort().join() === [...r.teamIds].sort().join());
      expect(game?.conferenceGame).toBe(true);
    }
  });

  it('never pushes the user down, but can invite the user up', () => {
    // Make the user's league the strongest, then put the user at the bottom of it.
    const userConf = conferences.find((c) => c.teamIds.includes('maryland-state'))!;
    const userRival = rivalries.find((r) => r.teamIds.includes('maryland-state'))!;
    const teams = dynasty.season.teams.map((t) => {
      const nationalPrestige = userRival.teamIds.includes(t.id) ? 20 : userConf.teamIds.includes(t.id) ? 99 : t.reputation.nationalPrestige;
      return { ...t, reputation: { ...t.reputation, nationalPrestige } };
    });
    const move = bestRealignmentCase({ ...base, teams });
    expect(move).not.toBeNull();
    expect(move!.fadingTeamIds).not.toContain('maryland-state');

    // Now the user's pair is a rising star in the weakest league.
    const risingTeams = dynasty.season.teams.map((t) => {
      const nationalPrestige = userRival.teamIds.includes(t.id) ? 99 : userConf.teamIds.includes(t.id) ? 30 : t.reputation.nationalPrestige;
      return { ...t, reputation: { ...t.reputation, nationalPrestige } };
    });
    const invite = bestRealignmentCase({ ...base, teams: risingTeams })!;
    expect(realignmentInvolves(invite, 'maryland-state')).toBe(true);
    expect(invite.risingTeamIds).toContain('maryland-state');
  });

  it('only happens in some offseasons, and not without a case', () => {
    const { teams } = withRisingPair();
    const years = Array.from({ length: 200 }, (_, i) => 2029 + i);
    const moves = years.filter((year) => planRealignment({ ...base, teams, year, seed: 9 }) !== null).length;
    expect(moves / years.length).toBeGreaterThan(0.25);
    expect(moves / years.length).toBeLessThan(0.45);
    const flat = dynasty.season.teams.map((t) => ({ ...t, reputation: { ...t.reputation, nationalPrestige: 60 } }));
    expect(years.some((year) => planRealignment({ ...base, teams: flat, year, seed: 9 }))).toBe(false);
  });
});
