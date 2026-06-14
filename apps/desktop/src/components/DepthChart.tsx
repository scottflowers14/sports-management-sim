import type { LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { getLacrosseDepthChart, LACROSSE_STARTER_COUNTS } from '@sports-management-sim/sport-lacrosse';

type DepthChartPlayer = LacrosseTeam['roster'][number];

export function DepthChart({
  team,
  injuries,
  onDepthChartChange,
}: {
  team: LacrosseTeam;
  injuries: Set<string>;
  onDepthChartChange?: (position: LacrossePosition, slotIndex: number, playerId: string) => void;
}) {
  const positions = Object.keys(LACROSSE_STARTER_COUNTS) as LacrossePosition[];
  const depthChart = getLacrosseDepthChart(team);
  const byId = new Map(team.roster.map((player) => [player.id, player]));

  return (
    <table className="depth-chart-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Slot</th>
          <th>Starter</th>
          <th>Next Up</th>
        </tr>
      </thead>
      <tbody>
        {positions.flatMap((pos) => {
          const orderedIds = depthChart[pos];
          const positionPlayers = orderedIds
            .map((id) => byId.get(id))
            .filter((player): player is DepthChartPlayer => Boolean(player));
          const starterCount = LACROSSE_STARTER_COUNTS[pos];

          // Injured players are auto-removed from starter/backup slots.
          // They still appear in the dropdown so the user can manage the order.
          const healthyPositionPlayers = positionPlayers.filter((p) => !injuries.has(p.id));

          return Array.from({ length: starterCount }, (_, slotIndex) => {
            const starter = healthyPositionPlayers[slotIndex];
            const backup = healthyPositionPlayers[starterCount + slotIndex];
            const rowKey = `${pos}-${slotIndex}`;

            return (
              <tr key={rowKey}>
                <td className="depth-pos">{slotIndex === 0 ? pos : ''}</td>
                <td className="depth-slot">{slotIndex + 1}</td>
                <td>
                  {starter ? (
                    <DepthPlayerSelect
                      players={positionPlayers}
                      injuries={injuries}
                      selectedPlayerId={starter.id}
                      disabled={!onDepthChartChange}
                      onChange={(playerId) => onDepthChartChange?.(pos, slotIndex, playerId)}
                    />
                  ) : <span className="depth-empty">—</span>}
                  {starter && <DepthPlayerMeta player={starter} injuries={injuries} />}
                </td>
                <td>
                  {backup ? (
                    <>
                      <span className="depth-name">{backup.name.first[0]}. {backup.name.last}</span>
                      <span className="depth-ovr">{backup.ratings.overall}</span>
                    </>
                  ) : <span className="depth-empty">—</span>}
                </td>
              </tr>
            );
          });
        })}
      </tbody>
    </table>
  );
}

function DepthPlayerSelect({
  players,
  injuries,
  selectedPlayerId,
  disabled,
  onChange,
}: {
  players: DepthChartPlayer[];
  injuries: Set<string>;
  selectedPlayerId: string;
  disabled: boolean;
  onChange: (playerId: string) => void;
}) {
  return (
    <select
      className="depth-select"
      aria-label="Depth chart starter"
      value={selectedPlayerId}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {players.map((player) => {
        const isInjured = injuries.has(player.id);
        return (
          <option key={player.id} value={player.id}>
            {player.name.first[0]}. {player.name.last} · {player.ratings.overall}{isInjured ? ' (INJ)' : ''}
          </option>
        );
      })}
    </select>
  );
}

function DepthPlayerMeta({ player, injuries }: { player: DepthChartPlayer; injuries: Set<string> }) {
  return (
    <span className="depth-meta">
      <span className="depth-ovr">{player.ratings.overall}</span>
      {injuries.has(player.id) && <span className="inj-badge">INJ</span>}
    </span>
  );
}
