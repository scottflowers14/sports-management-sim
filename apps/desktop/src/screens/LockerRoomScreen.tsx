import {
  moodLabel,
  moraleReason,
  playerRoleStatus,
  PLAYER_TALK_BOOST,
  TEAM_MEETING_BOOST,
  teamChemistry,
  type LacrossePlayer,
  type LacrosseTeam,
  type MoodLabel,
} from '@sports-management-sim/sport-lacrosse';
import { classLabel, portalMoraleMultiplier } from '@sports-management-sim/engine-core';

const MOODS: MoodLabel[] = ['Delighted', 'Happy', 'Content', 'Unhappy', 'Furious'];
const ROLE_LABEL = { starter: 'Starter', rotation: 'Rotation', reserve: 'Reserve' } as const;

interface LockerRoomScreenProps {
  team: LacrosseTeam;
  talkedIds: readonly string[];
  canHoldMeeting: boolean;
  meetingReadyWeek: number | null;
  onTalk: (playerId: string) => void;
  onTeamMeeting: () => void;
  onSelectPlayer: (playerId: string) => void;
}

function moodClass(mood: MoodLabel): string {
  return `mood mood-${mood.toLowerCase()}`;
}

/** Seniors graduate before the portal opens; everyone else could leave. */
function portalRisk(player: LacrossePlayer): string | null {
  if (player.classYear === 'SR' || player.classYear === 'GR') return null;
  const multiplier = portalMoraleMultiplier(player.morale);
  if (multiplier >= 2) return 'High';
  if (multiplier > 1) return 'Elevated';
  return null;
}

export function LockerRoomScreen({
  team,
  talkedIds,
  canHoldMeeting,
  meetingReadyWeek,
  onTalk,
  onTeamMeeting,
  onSelectPlayer,
}: LockerRoomScreenProps) {
  const chemistry = teamChemistry(team);
  const counts = new Map<MoodLabel, number>(MOODS.map((m) => [m, 0]));
  for (const p of team.roster) counts.set(moodLabel(p.morale), (counts.get(moodLabel(p.morale)) ?? 0) + 1);
  const talked = new Set(talkedIds);
  const roster = [...team.roster].sort((a, b) => a.morale - b.morale || a.id.localeCompare(b.id));
  const concerns = roster.filter((p) => p.morale < 50);

  const talkButton = (player: LacrossePlayer) => (
    <button
      type="button"
      className="offer-btn locker-talk-btn"
      disabled={talked.has(player.id)}
      title={talked.has(player.id) ? 'Already talked this season' : `Lifts his morale by ${PLAYER_TALK_BOOST}`}
      onClick={() => onTalk(player.id)}
    >
      {talked.has(player.id) ? 'Talked' : 'Talk'}
    </button>
  );

  return (
    <div className="locker-layout">
      <article className="card" aria-label="Team chemistry">
        <div className="practice-header">
          <div>
            <p className="eyebrow">Locker room</p>
            <h2>Team Chemistry</h2>
          </div>
          <div className="locker-chemistry">
            <strong className={moodClass(moodLabel(chemistry))}>{chemistry}</strong>
            <span>{moodLabel(chemistry)}</span>
          </div>
        </div>
        <div className="locker-mood-bar" aria-label="Mood breakdown">
          {MOODS.map((mood) => {
            const count = counts.get(mood) ?? 0;
            if (count === 0) return null;
            return (
              <div
                key={mood}
                className={`locker-mood-segment mood-bg-${mood.toLowerCase()}`}
                style={{ flexGrow: count }}
                title={`${count} ${mood.toLowerCase()}`}
              >
                {count}
              </div>
            );
          })}
        </div>
        <div className="locker-mood-legend">
          {MOODS.map((mood) => (
            <span key={mood} className={moodClass(mood)}>
              {mood} {counts.get(mood) ?? 0}
            </span>
          ))}
        </div>
        <p className="dim practice-note">
          Players judge their spot on the depth chart against their rating, and react to wins, losses and how hard you
          practice. Happy players develop faster; unhappy ones are more likely to enter the transfer portal.
        </p>
        <div className="locker-meeting">
          <button type="button" className="offer-btn" disabled={!canHoldMeeting} onClick={onTeamMeeting}>
            Hold team meeting
          </button>
          <span className="dim">
            {canHoldMeeting
              ? `Lifts everyone's morale by ${TEAM_MEETING_BOOST}.`
              : `The team needs a break from meetings until week ${meetingReadyWeek}.`}
          </span>
        </div>
      </article>

      <article className="card" aria-label="Player concerns">
        <h2>Concerns</h2>
        {concerns.length === 0 && <p className="dim">Nobody is unhappy right now.</p>}
        <ul className="locker-concerns">
          {concerns.map((player) => {
            const risk = portalRisk(player);
            return (
              <li key={player.id} className="locker-concern">
                <div>
                  <button type="button" className="practice-name-btn" onClick={() => onSelectPlayer(player.id)}>
                    {player.name.first} {player.name.last}
                  </button>
                  <span className="dim">
                    {' '}
                    {player.position} · {classLabel(player)} · {player.ratings.overall} OVR
                  </span>
                  <div className="dim">{moraleReason(team, player)}</div>
                </div>
                <span className={moodClass(moodLabel(player.morale))}>
                  {moodLabel(player.morale)} {Math.round(player.morale)}
                </span>
                {risk && <span className="locker-risk">Portal risk: {risk}</span>}
                {talkButton(player)}
              </li>
            );
          })}
        </ul>
      </article>

      <article className="card" aria-label="Player morale">
        <h2>Player Morale</h2>
        <table className="standings-table locker-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Cls</th>
              <th>OVR</th>
              <th>Role</th>
              <th>Mood</th>
              <th>Why</th>
              <th aria-label="Talk" />
            </tr>
          </thead>
          <tbody>
            {roster.map((player) => {
              const status = playerRoleStatus(team, player);
              const mood = moodLabel(player.morale);
              return (
                <tr key={player.id}>
                  <td>
                    <button type="button" className="practice-name-btn" onClick={() => onSelectPlayer(player.id)}>
                      {player.name.first} {player.name.last}
                    </button>
                  </td>
                  <td>{player.position}</td>
                  <td>{classLabel(player)}</td>
                  <td>{player.ratings.overall}</td>
                  <td>
                    {ROLE_LABEL[status.actual]}
                    {status.actual !== status.expected && (
                      <span className="dim"> (rates as {ROLE_LABEL[status.expected].toLowerCase()})</span>
                    )}
                  </td>
                  <td>
                    <div className="locker-morale-cell">
                      <div className="practice-progress">
                        <div className={`practice-progress-fill mood-bg-${mood.toLowerCase()}`} style={{ width: `${player.morale}%` }} />
                      </div>
                      <span className={moodClass(mood)}>{Math.round(player.morale)}</span>
                    </div>
                  </td>
                  <td className="dim">{moraleReason(team, player)}</td>
                  <td>{talkButton(player)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
    </div>
  );
}
