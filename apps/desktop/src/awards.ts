import type { LacrosseSeason } from '@sports-management-sim/sport-lacrosse';

export interface AwardWinner {
  playerName: string;
  teamName: string;
  position: string;
  overall: number;
}

export interface SeasonAwards {
  seasonYear: number;
  mvp: AwardWinner;
  offensivePlayer: AwardWinner;
  defensivePlayer: AwardWinner;
  freshmanOfYear: AwardWinner | null;
  allConference: AwardWinner[];
}

export function computeSeasonAwards(season: LacrosseSeason, _userTeamId: string): SeasonAwards {
  type PlayerWithTeam = { player: (typeof season.teams)[0]['roster'][0]; team: (typeof season.teams)[0] };

  const allPlayers: PlayerWithTeam[] = [];
  for (const team of season.teams) {
    for (const player of team.roster) {
      allPlayers.push({ player, team });
    }
  }

  function buildAwardWinner(entry: PlayerWithTeam): AwardWinner {
    return {
      playerName: `${entry.player.name.first} ${entry.player.name.last}`,
      teamName: entry.team.name,
      position: entry.player.position,
      overall: entry.player.ratings.overall,
    };
  }

  function pickBest(candidates: PlayerWithTeam[]): PlayerWithTeam | null {
    if (candidates.length === 0) return null;
    return candidates.reduce((best, current) =>
      current.player.ratings.overall > best.player.ratings.overall ? current : best,
    );
  }

  // MVP: highest overall among players on the team with the most wins
  const sortedByWins = [...season.teams].sort((a, b) => b.record.wins - a.record.wins);
  const topTeam = sortedByWins[0];
  const mvpCandidates = topTeam !== undefined
    ? allPlayers.filter((entry) => entry.team.id === topTeam.id)
    : allPlayers;
  const mvpEntry = pickBest(mvpCandidates) ?? pickBest(allPlayers);

  if (mvpEntry === null) {
    throw new Error('No players found to compute MVP');
  }

  // Offensive Player: highest overall at ATT or MID
  const offEntry = pickBest(allPlayers.filter((e) => e.player.position === 'ATT' || e.player.position === 'MID'));
  if (offEntry === null) {
    throw new Error('No offensive players found');
  }

  // Defensive Player: highest overall at DEF, GK, or LSM
  const defEntry = pickBest(
    allPlayers.filter((e) => e.player.position === 'DEF' || e.player.position === 'GK' || e.player.position === 'LSM'),
  );
  if (defEntry === null) {
    throw new Error('No defensive players found');
  }

  // Freshman of Year: highest overall among FR or SO
  const freshmanEntry = pickBest(
    allPlayers.filter((e) => e.player.classYear === 'FR' || e.player.classYear === 'SO'),
  );

  // All-Conference: one per position (ATT, MID, DEF, GK)
  const allConferencePositions = ['ATT', 'MID', 'DEF', 'GK'] as const;
  const allConference: AwardWinner[] = [];
  for (const pos of allConferencePositions) {
    const best = pickBest(allPlayers.filter((e) => e.player.position === pos));
    if (best !== null) {
      allConference.push(buildAwardWinner(best));
    }
  }

  return {
    seasonYear: season.year,
    mvp: buildAwardWinner(mvpEntry),
    offensivePlayer: buildAwardWinner(offEntry),
    defensivePlayer: buildAwardWinner(defEntry),
    freshmanOfYear: freshmanEntry !== null ? buildAwardWinner(freshmanEntry) : null,
    allConference,
  };
}
