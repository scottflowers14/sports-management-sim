interface DepthChartPlayer {
  id: string;
  position: string;
  name: { first: string; last: string };
  ratings: { overall: number };
  classYear: string;
}

interface DepthChartTeam {
  roster: DepthChartPlayer[];
}

export function DepthChart({ team, injuries }: { team: DepthChartTeam; injuries: Set<string> }) {
  const positions = ['ATT', 'MID', 'DEF', 'GK', 'FOGO', 'LSM'] as const;

  return (
    <table className="depth-chart-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Starter</th>
          <th>Backup</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => {
          const byPos = [...team.roster]
            .filter((p) => p.position === pos)
            .sort((a, b) => b.ratings.overall - a.ratings.overall);
          const starter = byPos[0];
          const backup = byPos[1];

          return (
            <tr key={pos}>
              <td className="depth-pos">{pos}</td>
              <td className={injuries.has(starter?.id ?? '') ? 'depth-injured' : ''}>
                {starter ? (
                  <>
                    <span className="depth-name">{starter.name.first[0]}. {starter.name.last}</span>
                    <span className="depth-ovr">{starter.ratings.overall}</span>
                    {injuries.has(starter.id) && <span className="inj-badge">INJ</span>}
                  </>
                ) : <span className="depth-empty">—</span>}
              </td>
              <td className={injuries.has(backup?.id ?? '') ? 'depth-injured' : ''}>
                {backup ? (
                  <>
                    <span className="depth-name">{backup.name.first[0]}. {backup.name.last}</span>
                    <span className="depth-ovr">{backup.ratings.overall}</span>
                    {injuries.has(backup.id) && <span className="inj-badge">INJ</span>}
                  </>
                ) : <span className="depth-empty">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
