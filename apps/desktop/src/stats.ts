import type { LacrosseTeam, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import type { ScheduledGame } from '@sports-management-sim/engine-core';

export interface PlayerSeasonStats {
  playerId: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  groundBalls: number;
  turnovers: number;
  causedTurnovers: number;
  faceoffWins: number;
  faceoffAttempts: number;
  saves: number;
  goalsAllowed: number;
}

export type SeasonStatsMap = Record<string, PlayerSeasonStats>;

export function emptySeasonStats(): SeasonStatsMap {
  return {};
}

function blankStats(playerId: string): PlayerSeasonStats {
  return {
    playerId,
    gamesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    goalsAllowed: 0,
  };
}

function addDelta(base: PlayerSeasonStats, delta: Partial<Omit<PlayerSeasonStats, 'playerId'>>): PlayerSeasonStats {
  return {
    playerId: base.playerId,
    gamesPlayed: base.gamesPlayed + (delta.gamesPlayed ?? 0),
    goals: base.goals + (delta.goals ?? 0),
    assists: base.assists + (delta.assists ?? 0),
    shots: base.shots + (delta.shots ?? 0),
    groundBalls: base.groundBalls + (delta.groundBalls ?? 0),
    turnovers: base.turnovers + (delta.turnovers ?? 0),
    causedTurnovers: base.causedTurnovers + (delta.causedTurnovers ?? 0),
    faceoffWins: base.faceoffWins + (delta.faceoffWins ?? 0),
    faceoffAttempts: base.faceoffAttempts + (delta.faceoffAttempts ?? 0),
    saves: base.saves + (delta.saves ?? 0),
    goalsAllowed: base.goalsAllowed + (delta.goalsAllowed ?? 0),
  };
}

function distributeToTeam(
  teamStats: LacrosseTeamStats,
  opponentGoals: number,
  team: LacrosseTeam,
): Array<{ playerId: string; delta: Partial<Omit<PlayerSeasonStats, 'playerId'>> }> {
  const { roster } = team;
  if (roster.length === 0) return [];

  const out: Array<{ playerId: string; delta: Partial<Omit<PlayerSeasonStats, 'playerId'>> }> = roster.map((p) => ({
    playerId: p.id,
    delta: { gamesPlayed: 1, goals: 0, assists: 0, shots: 0, groundBalls: 0, turnovers: 0, causedTurnovers: 0, faceoffWins: 0, faceoffAttempts: 0, saves: 0, goalsAllowed: 0 },
  }));

  const idx = (id: string) => roster.findIndex((p) => p.id === id);

  // GK: saves + goals allowed
  const gk = roster.find((p) => p.position === 'GK');
  if (gk) {
    const i = idx(gk.id);
    if (i >= 0) {
      out[i]!.delta.saves = teamStats.saves;
      out[i]!.delta.goalsAllowed = opponentGoals;
    }
  }

  // FOGO: faceoffs
  const fogo = roster.find((p) => p.position === 'FOGO');
  if (fogo) {
    const i = idx(fogo.id);
    if (i >= 0) {
      out[i]!.delta.faceoffWins = teamStats.faceoffWins;
      out[i]!.delta.faceoffAttempts = teamStats.faceoffAttempts;
    }
  }

  // ATT + MID: goals, assists, shots — weighted by skill+speed
  const offRoster = roster.filter((p) => p.position === 'ATT' || p.position === 'MID');
  if (offRoster.length > 0) {
    const weights = offRoster.map((p) => Math.max(1, p.ratings.skill + p.ratings.speed));
    const totalW = weights.reduce((s, w) => s + w, 0);
    let goalsLeft = teamStats.goals;
    let assistsLeft = teamStats.assists;
    let shotsLeft = teamStats.shots;

    for (let k = 0; k < offRoster.length; k++) {
      const i = idx(offRoster[k]!.id);
      if (i < 0) continue;
      const w = weights[k]! / totalW;
      const last = k === offRoster.length - 1;
      const g = last ? goalsLeft : Math.round(teamStats.goals * w);
      const a = last ? assistsLeft : Math.round(teamStats.assists * w);
      const s = last ? shotsLeft : Math.round(teamStats.shots * w);
      out[i]!.delta.goals = Math.max(0, g);
      out[i]!.delta.assists = Math.max(0, a);
      out[i]!.delta.shots = Math.max(0, s);
      goalsLeft -= g;
      assistsLeft -= a;
      shotsLeft -= s;
    }
  }

  // DEF + LSM: caused turnovers
  const defRoster = roster.filter((p) => p.position === 'DEF' || p.position === 'LSM');
  if (defRoster.length > 0) {
    const weights = defRoster.map((p) => Math.max(1, p.ratings.discipline + p.ratings.athleticism));
    const totalW = weights.reduce((s, w) => s + w, 0);
    let ctLeft = teamStats.causedTurnovers;

    for (let k = 0; k < defRoster.length; k++) {
      const i = idx(defRoster[k]!.id);
      if (i < 0) continue;
      const w = weights[k]! / totalW;
      const last = k === defRoster.length - 1;
      const ct = last ? ctLeft : Math.round(teamStats.causedTurnovers * w);
      out[i]!.delta.causedTurnovers = Math.max(0, ct);
      ctLeft -= ct;
    }
  }

  // Ground balls: evenly across all
  const gbEach = Math.floor(teamStats.groundBalls / roster.length);
  const gbRem = teamStats.groundBalls - gbEach * roster.length;
  for (let k = 0; k < roster.length; k++) {
    out[k]!.delta.groundBalls = gbEach + (k < gbRem ? 1 : 0);
  }

  // Turnovers: evenly across non-GK
  const fieldPlayers = roster.filter((p) => p.position !== 'GK');
  if (fieldPlayers.length > 0) {
    const toEach = Math.floor(teamStats.turnovers / fieldPlayers.length);
    const toRem = teamStats.turnovers - toEach * fieldPlayers.length;
    for (let k = 0; k < fieldPlayers.length; k++) {
      const i = idx(fieldPlayers[k]!.id);
      if (i >= 0) {
        out[i]!.delta.turnovers = toEach + (k < toRem ? 1 : 0);
      }
    }
  }

  return out;
}

export function updateSeasonStats(
  current: SeasonStatsMap,
  games: ScheduledGame[],
  teams: LacrosseTeam[],
  forWeek: number,
): SeasonStatsMap {
  const updated = { ...current };

  for (const game of games) {
    if (game.week !== forWeek || game.status !== 'final' || !game.result?.teamStats) continue;

    const homeTeam = teams.find((t) => t.id === game.homeTeamId);
    const awayTeam = teams.find((t) => t.id === game.awayTeamId);
    if (!homeTeam || !awayTeam) continue;

    const homeDeltas = distributeToTeam(
      game.result.teamStats.home as LacrosseTeamStats,
      game.result.awayScore,
      homeTeam,
    );
    const awayDeltas = distributeToTeam(
      game.result.teamStats.away as LacrosseTeamStats,
      game.result.homeScore,
      awayTeam,
    );

    for (const { playerId, delta } of [...homeDeltas, ...awayDeltas]) {
      updated[playerId] = addDelta(updated[playerId] ?? blankStats(playerId), delta);
    }
  }

  return updated;
}
