import type { LacrosseGamePlan, LacrossePlayer, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { ROTATION_LABELS, buildLacrosseLineup, midfieldLineShares } from '@sports-management-sim/sport-lacrosse';
import { withoutInjured } from '../week-sim';

/**
 * The units a team actually sends out: who plays the offensive end, the
 * defensive end, each midfield shift, the draws, and the extra-man units.
 */
export function Lineups({
  team,
  injuries,
  gamePlan,
  onSelectPlayer,
}: {
  team: LacrosseTeam;
  injuries: Set<string>;
  gamePlan: LacrosseGamePlan;
  onSelectPlayer?: (playerId: string) => void;
}) {
  // Injured players sit, so the lines show who actually goes out this week.
  const lineup = buildLacrosseLineup(withoutInjured(team, injuries));
  const shares = midfieldLineShares(lineup.midfieldLines.length, gamePlan.rotation);

  const units: Array<{ label: string; note?: string | undefined; players: LacrossePlayer[] }> = [
    { label: 'Attack', note: 'offensive end', players: lineup.attack },
    ...lineup.midfieldLines.map((line, i) => ({
      label: `Midfield ${i + 1}`,
      note: `${Math.round((shares[i] ?? 0) * 100)}% of shifts`,
      players: line,
    })),
    { label: 'Close Defense', note: 'defensive end', players: lineup.closeDefense },
    { label: 'LSM', players: lineup.longStickMid ? [lineup.longStickMid] : [] },
    { label: 'Goalie', players: lineup.goalie ? [lineup.goalie] : [] },
    { label: 'Faceoff', note: lineup.faceoff.length > 1 ? 'starter, backup' : undefined, players: lineup.faceoff },
    { label: 'Man-Up', note: 'extra-man offense', players: lineup.manUp },
    { label: 'Man-Down', note: 'penalty kill', players: lineup.manDown },
  ];

  return (
    <div className="lineups" aria-label="Lines">
      <p className="lineups-rotation">
        <span className="section-label">Rotation</span> {ROTATION_LABELS[gamePlan.rotation].label} · {ROTATION_LABELS[gamePlan.rotation].hint}
      </p>
      {units.map((unit) => (
        <div key={unit.label} className="lineup-unit">
          <div className="lineup-unit-head">
            <span className="lineup-unit-label">{unit.label}</span>
            {unit.note && <span className="lineup-unit-note">{unit.note}</span>}
          </div>
          <div className="lineup-players">
            {unit.players.length === 0 && <span className="depth-empty">—</span>}
            {unit.players.map((player) => (
              <button
                key={`${unit.label}-${player.id}`}
                type="button"
                className="lineup-player"
                onClick={() => onSelectPlayer?.(player.id)}
                title={`${player.name.first} ${player.name.last} · ${player.position} · ${player.ratings.overall} OVR · ${player.ratings.stamina} STA`}
              >
                <span className="lineup-pos">{player.position}</span>
                <span className="lineup-name">{player.name.first[0]}. {player.name.last}</span>
                <span className="lineup-ovr">{player.ratings.overall}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
