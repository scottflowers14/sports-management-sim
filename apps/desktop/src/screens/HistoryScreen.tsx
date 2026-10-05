import { useState } from 'react';
import { buildCoachCareer } from '../coach-of-year';
import type { CoachCareer } from '../coach-of-year';
import type { DynastySeasonRecord, SeasonAwardRecord } from '../history';
import { buildRecordBook } from '../history';
import { versusPrediction } from '../preseason';
import type { HallOfFameEntry } from '../records';
import { formatTeamName } from '../ui/format';
import { formatStreak, type SeriesRecord } from '../series-history';

export function HistoryScreen({
  history,
  hallOfFame = [],
  coachName = null,
  series = [],
  teamName = (id) => id,
}: {
  history: DynastySeasonRecord[];
  hallOfFame?: HallOfFameEntry[];
  coachName?: string | null;
  /** Head-to-head with every opponent, this season included. */
  series?: SeriesRecord[];
  teamName?: (teamId: string) => string;
}) {
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

      {coachName && <CoachCareerCard career={buildCoachCareer(history, coachName)} name={coachName} />}

      <article className="card">
        <h2>Season Log</h2>
        <table className="standings-table history-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Coach</th>
              <th>Record</th>
              <th>Conf</th>
              <th>Picked</th>
              <th>Nat Rank</th>
              <th>Top Scorer</th>
              <th>Conf</th>
              <th>Natl</th>
              <th>Class</th>
              <th title="Players taken in the pro draft">Pros</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.year}>
                <td className="rank">{record.year}</td>
                <td className="dim">
                  {record.coachName ?? '—'}
                  {record.coachOfYear && <span className="honor-pill coy-pill" title="Coach of the Year">COY</span>}
                </td>
                <td className="record-cell">{record.wins}–{record.losses}</td>
                <td>#{record.confStanding}</td>
                <td
                  className={
                    record.predictedConfFinish === undefined
                      ? 'dim'
                      : record.confStanding < record.predictedConfFinish
                        ? 'mood-happy'
                        : record.confStanding > record.predictedConfFinish
                          ? 'mood-unhappy'
                          : undefined
                  }
                  title={versusPrediction(record.predictedConfFinish, record.confStanding) ?? undefined}
                >
                  {record.predictedConfFinish !== undefined ? `#${record.predictedConfFinish}` : '—'}
                </td>
                <td>{record.natRankAtEnd !== null ? `#${record.natRankAtEnd}` : '—'}</td>
                <td>
                  {record.teamLeader
                    ? `${record.teamLeader.playerName} · ${record.teamLeader.goals}G ${record.teamLeader.assists}A`
                    : '—'}
                </td>
                <td>{record.confChampion ? <span className="champ-badge conf-champ">CHAMP</span> : '—'}</td>
                <td>{record.nationalChampion ? <span className="champ-badge natl-champ">CHAMP</span> : '—'}</td>
                <td>{record.signingClassSize}</td>
                <td>{record.proPicks ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <HeadToHeadCard series={series} teamName={teamName} />

      <div className="history-detail-row">
        <RecordBookCard recordBook={recordBook} />
        <NationalChampionsCard history={history} />
      </div>

      <HallOfFameCard entries={hallOfFame} />

      <AwardsHistoryCard history={history} />
      <HonorRollCard history={history} title="All-Americans" pick={(r) => r.allAmericans} firstLabel="1st" tierSuffix=" All-America" />
      <HonorRollCard history={history} title="All-Conference" pick={(r) => r.allConference} firstLabel="1st" tierSuffix=" All-Conference" />
    </div>
  );
}

function CoachCareerCard({ career, name }: { career: CoachCareer; name: string }) {
  const pct = career.wins + career.losses > 0 ? career.wins / (career.wins + career.losses) : 0;
  const best = career.bestSeason;
  return (
    <article className="card coach-career-card" aria-label="Coach career">
      <h2>Coach {name}</h2>
      <div className="kv-strip">
        <div className="kv"><span className="kv-label">Seasons</span><span className="kv-value">{career.seasons}</span></div>
        <div className="kv"><span className="kv-label">Record</span><span className="kv-value">{career.wins}–{career.losses}</span></div>
        <div className="kv"><span className="kv-label">Win %</span><span className="kv-value">{pct.toFixed(3).replace(/^0/, '')}</span></div>
        <div className="kv"><span className="kv-label">Conf Titles</span><span className="kv-value">{career.confTitles}</span></div>
        <div className="kv"><span className="kv-label">Natl Titles</span><span className="kv-value">{career.nationalTitles}</span></div>
        <div className="kv"><span className="kv-label">Coach of Year</span><span className="kv-value">{career.coachOfYearYears.length}</span></div>
      </div>
      <ul className="coach-career-stints">
        {career.stints.map((stint) => (
          <li key={`${stint.teamName}-${stint.firstYear}`}>
            <strong>{formatTeamName(stint.teamName)}</strong>
            <span className="dim">
              {stint.firstYear === stint.lastYear ? stint.firstYear : `${stint.firstYear}–${stint.lastYear}`} · {stint.wins}–{stint.losses}
            </span>
          </li>
        ))}
      </ul>
      {(best || career.coachOfYearYears.length > 0) && (
        <p className="dim coach-career-note">
          {best && <>Best season: {best.year}, {best.wins}–{best.losses}{best.nationalChampion ? ', national champions' : best.confChampion ? ', conference champions' : ''}. </>}
          {career.coachOfYearYears.length > 0 && <>Coach of the Year {career.coachOfYearYears.join(', ')}.</>}
        </p>
      )}
    </article>
  );
}

function HallOfFameCard({ entries }: { entries: HallOfFameEntry[] }) {
  return (
    <article className="card hall-of-fame-card" aria-label="Hall of Fame">
      <h2>Program Hall of Fame</h2>
      {entries.length === 0 ? (
        <p className="dim">
          Players who finish a career of three seasons or more among the program's top three in a stat are inducted when
          they leave. Nobody has made it yet.
        </p>
      ) : (
        <ul className="hall-of-fame-list">
          {entries.map((entry) => (
            <li key={entry.playerId} className="hall-of-fame-plaque">
              <strong>{entry.name}</strong>
              <span className="dim">
                {' '}
                {entry.position} · {entry.firstYear}–{entry.lastYear} · inducted {entry.inducted}
              </span>
              <div className="hall-of-fame-citation">{entry.citation}</div>
            </li>
          ))}
        </ul>
      )}
    </article>
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

function HonorRollCard({
  history,
  title,
  pick,
  firstLabel,
  tierSuffix,
}: {
  history: DynastySeasonRecord[];
  title: string;
  pick: (record: DynastySeasonRecord) => SeasonAwardRecord[] | undefined;
  /** How a first-team pick's award label starts. */
  firstLabel: string;
  /** Trimmed from award labels in the table. */
  tierSuffix: string;
}) {
  const seasons = history.filter((r) => (pick(r)?.length ?? 0) > 0);
  if (seasons.length === 0) return null;
  const all = seasons.flatMap((r) => pick(r)!);
  const firstTeam = all.filter((a) => a.award.startsWith(firstLabel)).length;
  return (
    <article className="card" aria-label={`Program ${title}`}>
      <h2>{title}</h2>
      <p className="dim">
        {all.length} selection{all.length === 1 ? '' : 's'}, {firstTeam} on the first team.
      </p>
      <table className="standings-table history-awards-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Honor</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Stat Line</th>
          </tr>
        </thead>
        <tbody>
          {seasons.flatMap((record) =>
            pick(record)!.map((a, i) => (
              <tr key={`${record.year}-${a.award}-${a.playerName}`}>
                {i === 0 ? <td className="rank" rowSpan={pick(record)!.length}>{record.year}</td> : null}
                <td>{a.award.replace(tierSuffix, '')}</td>
                <td>{a.playerName}</td>
                <td>{a.position}</td>
                <td className="record-cell">{a.statLine ?? '—'}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </article>
  );
}

function HeadToHeadCard({ series, teamName }: { series: SeriesRecord[]; teamName: (teamId: string) => string }) {
  const [showAll, setShowAll] = useState(false);
  if (series.length === 0) return null;
  const rows = [...series].sort(
    (a, b) => b.wins + b.losses - (a.wins + a.losses) || b.wins - a.wins || teamName(a.opponentId).localeCompare(teamName(b.opponentId)),
  );
  const shown = showAll ? rows : rows.slice(0, 10);
  return (
    <article className="card" aria-label="Head-to-head">
      <h2>Head-to-Head</h2>
      <table className="standings-table history-table">
        <thead>
          <tr>
            <th>Opponent</th>
            <th>Series</th>
            <th>GF</th>
            <th>GA</th>
            <th>Streak</th>
            <th>Last Meeting</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.opponentId}>
              <td>{teamName(s.opponentId)}</td>
              <td className={s.wins > s.losses ? 'mood-happy record-cell' : s.wins < s.losses ? 'mood-unhappy record-cell' : 'record-cell'}>
                {s.wins}–{s.losses}
              </td>
              <td>{s.goalsFor}</td>
              <td>{s.goalsAgainst}</td>
              <td>{formatStreak(s)}</td>
              <td className="dim">
                {s.last
                  ? `${s.last.won ? 'W' : 'L'} ${s.last.goalsFor}-${s.last.goalsAgainst}, ${s.last.year}${s.last.postseason ? ' (postseason)' : ''}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <button className="hub-nav-link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show top 10' : `Show all ${rows.length} opponents`}
        </button>
      )}
    </article>
  );
}
