import type { LacrossePosition, LacrosseTeam, LacrosseTeamRating } from '@sports-management-sim/sport-lacrosse';
import { DepthChart } from '../components/DepthChart';
import { formatTeamName } from '../ui/format';

const POSITION_ORDER: LacrossePosition[] = ['ATT', 'MID', 'DEF', 'LSM', 'GK', 'FOGO'];

const POSITION_LABELS: Record<LacrossePosition, string> = {
  ATT: 'Attack',
  MID: 'Midfield',
  DEF: 'Defense',
  LSM: 'Long-Stick Midfield',
  GK: 'Goalie',
  FOGO: 'Face-Off / Get-Off',
};

export function TeamScreen({
  team,
  injuries,
  injuredCount,
  rating,
  onSelectPlayer,
  onDepthChartChange,
}: {
  team: LacrosseTeam;
  injuries: Set<string>;
  injuredCount: number;
  rating: LacrosseTeamRating;
  onSelectPlayer: (playerId: string) => void;
  onDepthChartChange: (position: LacrossePosition, slotIndex: number, playerId: string) => void;
}) {
  const rosterGroups = POSITION_ORDER.map((pos) => ({
    position: pos,
    label: POSITION_LABELS[pos],
    players: [...team.roster]
      .filter((p) => p.position === pos)
      .sort((a, b) => b.ratings.overall - a.ratings.overall),
  })).filter((g) => g.players.length > 0);

  return (
    <div className="team-view-layout">
      <article className="card team-overview-card">
        <p className="eyebrow">Current Team</p>
        <h2>{formatTeamName(team.name)}</h2>
        <div className="team-view-metrics">
          <div>
            <span className="metric">{team.record.wins}–{team.record.losses}</span>
            <span className="sub-metric">Record</span>
          </div>
          <div>
            <span className="metric">{team.roster.length}</span>
            <span className="sub-metric">Players</span>
          </div>
          <div>
            <span className="metric">{team.resources.scholarshipUsed.toFixed(1)}</span>
            <span className="sub-metric">Scholarships Used</span>
          </div>
          <div>
            <span className="metric">{injuredCount}</span>
            <span className="sub-metric">Injuries</span>
          </div>
        </div>
        <div className="team-rating-summary wide" aria-label="Team rating summary">
          <div className="team-rating-overall">
            <span className="team-rating-number">{rating.overall}</span>
            <span className="team-rating-label">Team OVR</span>
          </div>
          <div className="team-rating-breakdown wide">
            <span>OFF {rating.offense}</span>
            <span>DEF {rating.defense}</span>
            <span>GK {rating.goalie}</span>
            <span>FO {rating.faceoff}</span>
            <span>DEPTH {rating.depth}</span>
          </div>
        </div>
      </article>

      <article className="card team-depth-card">
        <h2>Depth Chart</h2>
        <p className="dim">Set starters by position. These choices feed the live team rating and game simulation.</p>
        <DepthChart team={team} injuries={injuries} onDepthChartChange={onDepthChartChange} />
      </article>

      <article className="card team-roster-card">
        <h2>Full Roster</h2>
        <table className="standings-table roster-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Class</th>
              <th>OVR</th>
              <th>Skill</th>
              <th>IQ</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rosterGroups.flatMap(({ position, label, players }) => [
              <tr key={`pos-header-${position}`} className="roster-position-header">
                <td colSpan={6}>
                  <span className="roster-pos-tag">{position}</span>
                  {label}
                </td>
              </tr>,
              ...players.map((player) => {
                const isInjured = injuries.has(player.id);
                return (
                  <tr
                    key={player.id}
                    className={`clickable-row${isInjured ? ' player-injured' : ''}`}
                    onClick={() => onSelectPlayer(player.id)}
                  >
                    <td>
                      <strong>{player.name.first} {player.name.last}</strong>
                    </td>
                    <td>{player.classYear}</td>
                    <td>{player.ratings.overall}</td>
                    <td>{player.ratings.skill}</td>
                    <td>{player.ratings.iq}</td>
                    <td>{isInjured ? <span className="inj-badge">INJ</span> : 'Available'}</td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </article>
    </div>
  );
}
