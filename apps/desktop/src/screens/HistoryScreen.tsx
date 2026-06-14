import type { DynastySeasonRecord, SeasonAwardRecord } from '../history';
import { buildRecordBook } from '../history';
import { formatTeamName } from '../ui/format';

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
  const recordBook = buildRecordBook(history);

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
          <p className="history-stat-num">
            {recordBook.bestFinish ? `#${recordBook.bestFinish.value}` : '—'}
          </p>
          <p className="history-stat-label">Best Finish</p>
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
              <th>Coach</th>
              <th>Record</th>
              <th>Conf</th>
              <th>Nat Rank</th>
              <th>Top Scorer</th>
              <th>Conf</th>
              <th>Natl</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.year}>
                <td className="rank">{record.year}</td>
                <td className="dim">{record.coachName ?? '—'}</td>
                <td className="record-cell">{record.wins}–{record.losses}</td>
                <td>#{record.confStanding}</td>
                <td>{record.natRankAtEnd !== null ? `#${record.natRankAtEnd}` : '—'}</td>
                <td>
                  {record.teamLeader
                    ? `${record.teamLeader.playerName} · ${record.teamLeader.goals}G ${record.teamLeader.assists}A`
                    : '—'}
                </td>
                <td>{record.confChampion ? <span className="champ-badge conf-champ">CHAMP</span> : '—'}</td>
                <td>{record.nationalChampion ? <span className="champ-badge natl-champ">CHAMP</span> : '—'}</td>
                <td>{record.signingClassSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <div className="history-detail-row">
        <RecordBookCard recordBook={recordBook} />
        <NationalChampionsCard history={history} />
      </div>

      <AwardsHistoryCard history={history} />
    </div>
  );
}

function RecordBookCard({ recordBook }: { recordBook: ReturnType<typeof buildRecordBook> }) {
  const rows: Array<{ label: string; value: string }> = [];
  if (recordBook.mostWins) {
    rows.push({ label: 'Most Wins (Season)', value: `${recordBook.mostWins.value} (${recordBook.mostWins.year})` });
  }
  if (recordBook.bestScoringSeason) {
    rows.push({
      label: 'Top Scoring Season',
      value: `${recordBook.bestScoringSeason.player} · ${recordBook.bestScoringSeason.value} pts (${recordBook.bestScoringSeason.year})`,
    });
  }
  if (recordBook.bestFinish) {
    rows.push({ label: 'Best National Finish', value: `#${recordBook.bestFinish.value} (${recordBook.bestFinish.year})` });
  }
  rows.push({ label: 'Conference Titles', value: String(recordBook.confTitles) });
  rows.push({ label: 'National Titles', value: String(recordBook.natTitles) });
  rows.push({ label: 'Longest Winning-Season Streak', value: `${recordBook.longestWinStreakSeasons} yr` });

  return (
    <article className="card history-record-book">
      <h2>Program Record Book</h2>
      <table className="standings-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="dim">{row.label}</td>
              <td className="record-cell">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function NationalChampionsCard({ history }: { history: DynastySeasonRecord[] }) {
  const champions = history.filter((r) => r.nationalChampionName);
  return (
    <article className="card">
      <h2>National Champions</h2>
      {champions.length === 0 ? (
        <p className="dim">No champion crowned yet — run the postseason to the title.</p>
      ) : (
        <table className="standings-table">
          <tbody>
            {champions.map((record) => (
              <tr key={record.year}>
                <td className="rank">{record.year}</td>
                <td className={record.nationalChampion ? 'record-cell user-row' : 'record-cell'}>
                  {formatTeamName(record.nationalChampionName ?? '')}
                  {record.nationalChampion ? ' 🏆' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

function AwardsHistoryCard({ history }: { history: DynastySeasonRecord[] }) {
  const seasonsWithAwards = history.filter((r) => r.awards && r.awards.length > 0);
  if (seasonsWithAwards.length === 0) return null;

  return (
    <article className="card">
      <h2>Awards &amp; Honors</h2>
      <table className="standings-table history-awards-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Award</th>
            <th>Player</th>
            <th>Team</th>
            <th>Stat Line</th>
          </tr>
        </thead>
        <tbody>
          {seasonsWithAwards.flatMap((record) =>
            (record.awards ?? []).map((award: SeasonAwardRecord, i) => (
              <tr key={`${record.year}-${award.award}`}>
                {i === 0 ? <td className="rank" rowSpan={record.awards!.length}>{record.year}</td> : null}
                <td>{award.award}</td>
                <td>{award.playerName}</td>
                <td className="dim">{formatTeamName(award.teamName)}</td>
                <td className="record-cell">{award.statLine ?? '—'}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </article>
  );
}
