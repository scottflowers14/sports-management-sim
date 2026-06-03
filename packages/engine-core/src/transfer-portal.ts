import type { ID, PersonName, PlayerClass, PlayerRatings, Rating, RegionId, Team } from './models';
import type { RecruitPreferences } from './recruiting';

export type PortalStatus = 'available' | 'committed' | 'withdrawn';

export interface PortalEntry<Position extends string = string, SportTraits = unknown> {
  id: string;
  playerId: ID;
  name: PersonName;
  position: Position;
  classYear: PlayerClass;
  ratings: PlayerRatings;
  sportTraits?: SportTraits;
  sourceTeamId: ID;
  regionId: RegionId;
  status: PortalStatus;
  preferences: RecruitPreferences;
  interestByTeamId: Record<ID, Rating>;
  offersByTeamId: Record<ID, number>;
  committedTeamId?: ID;
}

export function applyPortalOffer<Position extends string, SportTraits>(
  entry: PortalEntry<Position, SportTraits>,
  teamId: ID,
  scholarshipPercent: number,
): PortalEntry<Position, SportTraits> {
  const clamped = Math.min(100, Math.max(0, scholarshipPercent));
  const current = entry.interestByTeamId[teamId] ?? 0;
  const boost = Math.round(clamped * (entry.preferences.scholarshipImportance / 100) * 0.35);
  return {
    ...entry,
    offersByTeamId: { ...entry.offersByTeamId, [teamId]: clamped },
    interestByTeamId: { ...entry.interestByTeamId, [teamId]: Math.min(100, current + boost) },
  };
}

export function resolvePortalCommitments<Position extends string, SportTraits>(
  entries: PortalEntry<Position, SportTraits>[],
  teams: Team<Position, SportTraits>[],
): PortalEntry<Position, SportTraits>[] {
  return entries.map((entry) => {
    if (entry.status !== 'available') return entry;

    const offeringTeamIds = Object.keys(entry.offersByTeamId);
    if (offeringTeamIds.length === 0) return { ...entry, status: 'withdrawn' as const };

    const offeringTeams = teams.filter((t) => offeringTeamIds.includes(t.id));
    if (offeringTeams.length === 0) return { ...entry, status: 'withdrawn' as const };

    const totalWeight =
      entry.preferences.prestigeImportance +
      entry.preferences.proximityImportance +
      entry.preferences.academicImportance;

    const ranked = offeringTeams
      .map((team) => {
        const interest = entry.interestByTeamId[team.id] ?? 0;
        const prestigeScore = (team.reputation.nationalPrestige + team.reputation.recentSuccess) / 2;
        const proximityScore = entry.regionId === team.regionId ? 100 : 30;
        const fitScore =
          totalWeight > 0
            ? Math.round(
                (prestigeScore * entry.preferences.prestigeImportance +
                  proximityScore * entry.preferences.proximityImportance +
                  team.reputation.academicPrestige * entry.preferences.academicImportance) /
                  totalWeight,
              )
            : 50;
        return { teamId: team.id, score: Math.round(interest * 0.65 + fitScore * 0.35) };
      })
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < 15) return { ...entry, status: 'withdrawn' as const };

    return { ...entry, status: 'committed' as const, committedTeamId: best.teamId };
  });
}
