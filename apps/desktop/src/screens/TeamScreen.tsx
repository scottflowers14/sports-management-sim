import { classLabel, REDSHIRT_GAME_LIMIT } from '@sports-management-sim/engine-core';
import {
  lacrosseRedshirtBlock,
  REDSHIRT_BLOCK_LABELS,
  suggestRedshirts,
  type LacrosseGamePlan,
  type LacrossePlayer,
  type LacrossePosition,
  type LacrosseTeam,
  type LacrosseTeamRating,
} from '@sports-management-sim/sport-lacrosse';
import { DepthChart } from '../components/DepthChart';
import { Lineups } from '../components/Lineups';
import { FormBadge } from '../components/FormWatchCard';
import type { PlayerForm } from '../player-form';
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

export interface TeamRedshirtControls {
  /** False once the regular season is over. */
  open: boolean;
  gamesPlayedFor: (playerId: string) => number;
  onSetRedshirt: (playerId: string, redshirt: boolean) => void;
}

function RedshirtButton({ team, player, controls }: { team: LacrosseTeam; player: LacrossePlayer; controls: TeamRedshirtControls }) {
  if (player.redshirtStatus === 'redshirting') {
    return (
      <button
        type="button"
        className="offer-btn redshirt-btn"
        disabled={!controls.open}
        onClick={(e) => {
          e.stopPropagation();
          controls.onSetRedshirt(player.id, false);
        }}
      >
        Remove RS
      </button>
    );
  }
  const block = lacrosseRedshirtBlock(team, player, controls.gamesPlayedFor(player.id));
  if (block === 'used' || block === 'graduate') return <span className="dim">—</span>;
  return (
    <button
      type="button"
      className="offer-btn redshirt-btn"
      disabled={!controls.open || block !== null}
      title={block ? REDSHIRT_BLOCK_LABELS[block] : 'Sit him out this season and keep the year of eligibility'}
      onClick={(e) => {
        e.stopPropagation();
        controls.onSetRedshirt(player.id, true);
      }}
    >
      Redshirt
    </button>
  );
}

function RedshirtCard({ team, controls, onSelectPlayer }: { team: LacrosseTeam; controls: TeamRedshirtControls; onSelectPlayer: (id: string) => void }) {
  const redshirting = team.roster.filter((p) => p.redshirtStatus === 'redshirting');
  const suggestions = controls.open ? suggestRedshirts(team, controls.gamesPlayedFor).slice(0, 5) : [];
  const row = (player: LacrossePlayer, note: string) => (
    <li key={player.id} className="redshirt-row">
      <button type="button" className="practice-name-btn" onClick={() => onSelectPlayer(player.id)}>
        {player.name.first} {player.name.last}
      </button>
      <span className="dim">
        {player.position} · {classLabel(player)} · {player.ratings.overall} / {player.ratings.potential} POT · {note}
      </span>
      <RedshirtButton team={team} player={player} controls={controls} />
    </li>
  );
  return (
    <article className="card team-redshirt-card" aria-label="Redshirts">
      <h2>Redshirts</h2>
      <p className="dim">
        A redshirting player sits out every game but keeps practicing, and the season doesn't count against his
        eligibility: he comes back next year in the same class, with an extra boost to his development. A player can
        still redshirt after playing up to {REDSHIRT_GAME_LIMIT} games, and only once in his career.
      </p>
      {!controls.open && <p className="dim">Redshirt decisions are closed until next season.</p>}
      <h3 className="redshirt-subhead">Redshirting ({redshirting.length})</h3>
      {redshirting.length === 0 ? (
        <p className="dim">Nobody is redshirting this season.</p>
      ) : (
        <ul className="redshirt-list">{redshirting.map((p) => row(p, 'sitting out'))}</ul>
      )}
      {suggestions.length > 0 && (
        <>
          <h3 className="redshirt-subhead">Suggested</h3>
          <ul className="redshirt-list">{suggestions.map((p) => row(p, 'buried on the depth chart'))}</ul>
        </>
      )}
    </article>
  );
}

export function TeamScreen({
  team,
  injuries,
  injuredCount,
  rating,
  gamePlan,
  onSelectPlayer,
  onDepthChartChange,
  onResetDepthChart,
  redshirts,
  form,
}: {
  team: LacrosseTeam;
  injuries: Set<string>;
  injuredCount: number;
  rating: LacrosseTeamRating;
  gamePlan: LacrosseGamePlan;
  onSelectPlayer: (playerId: string) => void;
  onDepthChartChange: (position: LacrossePosition, slotIndex: number, playerId: string) => void;
  onResetDepthChart?: () => void;
  redshirts?: TeamRedshirtControls;
  /** Players currently hot or cold. */
  form?: ReadonlyMap<string, PlayerForm>;
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
        <div className="depth-chart-header">
          <h2>Depth Chart</h2>
          {onResetDepthChart && (team as { depthChart?: object }).depthChart && (
            <button type="button" className="offer-btn depth-reset-btn" onClick={onResetDepthChart}>
              Best lineup
            </button>
          )}
        </div>
        <p className="dim">
          Set starters by position. These choices feed the live team rating and game simulation. Players rated higher
          than their spot notice; Best lineup puts everyone back in rating order.
        </p>
        <DepthChart team={team} injuries={injuries} onDepthChartChange={onDepthChartChange} />
      </article>

      <article className="card team-lines-card">
        <h2>Lines</h2>
        <p className="dim">
          The units the depth chart sends out. Attack and close defense play their whole end of the field; the midfield lines
          split shifts by the rotation in your game plan, and the man-up and man-down units are picked from the best available.
        </p>
        <Lineups team={team} injuries={injuries} gamePlan={gamePlan} onSelectPlayer={onSelectPlayer} />
      </article>

      {redshirts && <RedshirtCard team={team} controls={redshirts} onSelectPlayer={onSelectPlayer} />}

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
              {redshirts && <th aria-label="Redshirt" />}
            </tr>
          </thead>
          <tbody>
            {rosterGroups.flatMap(({ position, label, players }) => [
              <tr key={`pos-header-${position}`} className="roster-position-header">
                <td colSpan={redshirts ? 7 : 6}>
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
                      <FormBadge form={form?.get(player.id)} />
                    </td>
                    <td>{classLabel(player)}</td>
                    <td>{player.ratings.overall}</td>
                    <td>{player.ratings.skill}</td>
                    <td>{player.ratings.iq}</td>
                    <td>
                      {isInjured ? (
                        <span className="inj-badge">INJ</span>
                      ) : player.redshirtStatus === 'redshirting' ? (
                        <span className="rs-badge">RS</span>
                      ) : (
                        'Available'
                      )}
                    </td>
                    {redshirts && (
                      <td>
                        <RedshirtButton team={team} player={player} controls={redshirts} />
                      </td>
                    )}
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
