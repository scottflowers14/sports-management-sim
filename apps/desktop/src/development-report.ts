import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { DevelopmentTrait } from '@sports-management-sim/engine-core';

export type DevelopmentEvent = 'breakout' | 'steady_rise' | 'plateau' | 'regression';

export interface PlayerDevelopmentEntry {
  playerId: string;
  name: string;
  position: string;
  classYear: string;
  oldOverall: number;
  newOverall: number;
  delta: number;
  event: DevelopmentEvent;
  traitNote: string | null;
}

export interface DevelopmentReport {
  entries: PlayerDevelopmentEntry[];
  breakouts: PlayerDevelopmentEntry[];
  regressions: PlayerDevelopmentEntry[];
  steadyRisers: PlayerDevelopmentEntry[];
}

/** Snapshot type for capturing ratings before the offseason runs */
export type PreOffseasonSnapshot = Map<
  string,
  { overall: number; name: string; position: string; classYear: string; traits: DevelopmentTrait[] }
>;

export function capturePreOffseasonSnapshot(team: LacrosseTeam): PreOffseasonSnapshot {
  const snap: PreOffseasonSnapshot = new Map();
  for (const p of team.roster) {
    snap.set(p.id, {
      overall: p.ratings.overall,
      name: `${p.name.first} ${p.name.last}`,
      position: p.position,
      classYear: p.classYear,
      traits: [...p.traits],
    });
  }
  return snap;
}

export function computeDevelopmentReport(
  postOffseasonTeam: LacrosseTeam,
  snapshot: PreOffseasonSnapshot,
): DevelopmentReport {
  const entries: PlayerDevelopmentEntry[] = [];

  for (const player of postOffseasonTeam.roster) {
    const pre = snapshot.get(player.id);
    if (!pre) continue;

    const delta = player.ratings.overall - pre.overall;
    const event = classifyEvent(delta, pre.traits, pre.classYear);
    const traitNote = buildTraitNote(event, pre.traits, pre.classYear);

    entries.push({
      playerId: player.id,
      name: pre.name,
      position: pre.position,
      classYear: pre.classYear,
      oldOverall: pre.overall,
      newOverall: player.ratings.overall,
      delta,
      event,
      traitNote,
    });
  }

  entries.sort((a, b) => b.delta - a.delta || b.newOverall - a.newOverall);

  return {
    entries,
    breakouts: entries.filter((e) => e.event === 'breakout'),
    regressions: entries.filter((e) => e.event === 'regression'),
    steadyRisers: entries.filter((e) => e.event === 'steady_rise'),
  };
}

function classifyEvent(delta: number, traits: DevelopmentTrait[], classYear: string): DevelopmentEvent {
  if (delta <= -2) return 'regression';
  if (delta === 0 || delta === -1) return 'plateau';

  // Breakout: big jump, or late-bloomer in JR/SR, or raw athlete with big jump
  const isLateBloom =
    traits.includes('late_bloomer') && (classYear === 'JR' || classYear === 'SR');
  const isRawAthlete = traits.includes('raw_athlete') && delta >= 3;

  if (delta >= 4 || isLateBloom || isRawAthlete) return 'breakout';
  return 'steady_rise';
}

function buildTraitNote(
  event: DevelopmentEvent,
  traits: DevelopmentTrait[],
  classYear: string,
): string | null {
  if (event === 'breakout') {
    if (traits.includes('late_bloomer') && (classYear === 'JR' || classYear === 'SR')) {
      return 'Late bloomer hitting their stride';
    }
    if (traits.includes('raw_athlete')) {
      return 'Raw athleticism is starting to translate';
    }
    if (traits.includes('high_floor')) {
      return 'Polished ceiling finally unlocked';
    }
    if (traits.includes('leader')) {
      return 'Leadership role bringing out peak performance';
    }
  }
  if (event === 'regression') {
    if (traits.includes('low_motivation')) return 'Motivation concerns proving real';
    if (traits.includes('injury_prone')) return 'Recurring injuries slowing development';
  }
  if (event === 'steady_rise' && traits.includes('high_floor')) {
    return 'Consistent improvement — high floor trait';
  }
  if (event === 'steady_rise' && traits.includes('polished')) {
    return 'Polished technique continuing to refine';
  }
  return null;
}
