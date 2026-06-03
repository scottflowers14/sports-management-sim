import type { DynastySeasonRecord } from '../history';

export function HistoryScreen({ history }: { history: DynastySeasonRecord[] }) {
  if (history.length === 0) {
    return (
      <article className="card">
        <h2>Dynasty History</h2>
        <p className="dim">Complete your first season to start building the dynasty record.</p>
      </article>
    );
  }

  const totalWins = history.reduce((sum, r) => sum + r.wins, 0);
  const totalLosses = history.reduce((sum, r) => sum + r.losses, 0);
  const confTitles = history.filter((r) => r.confChampion).length;
  const natTitles = history.filter((r) => r.nationalChampion).length;

  return (
    <div className="history-layout">
      <div className="history-summary-row">
        <article className="card history-stat-card">
          <p className="history-stat-num">{totalWins}–{totalLosses}</p>
          <p className="history-stat-label">All-Time Record</p>
        </article>
        <article className="card history-stat-card">
          <p className="history-stat-num">{confTitles}</p>
          <p className="history-stat-label">Conf. Titles</p>
        </article>
        <article className="card history-stat-card">
          <p className="history-stat-num">{natTitles}</p>
          <p className="history-stat-label">Nat. Championships</p>
        </article>
        <article className="card history-stat-card">
          <p className="history-stat-num">{history.length}</p>
          <p className="history-stat-label">Seasons</p>
        </article>
      </div>

      <article className="card">
        <h2>Season Log</h2>
        <table className="standings-table history-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Record</th>
              <th>Conf</th>
              <th>Nat Rank</th>
              <th>Conf</th>
              <th>Natl</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.year}>
                <td className="rank">{record.year}</td>
                <td className="record-cell">{record.wins}–{record.losses}</td>
                <td>#{record.confStanding}</td>
                <td>{record.natRankAtEnd !== null ? `#${record.natRankAtEnd}` : '—'}</td>
                <td>{record.confChampion ? <span className="champ-badge conf-champ">CHAMP</span> : '—'}</td>
                <td>{record.nationalChampion ? <span className="champ-badge natl-champ">CHAMP</span> : '—'}</td>
                <td>{record.signingClassSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
