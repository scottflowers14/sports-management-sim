import type { ReactNode } from 'react';
import type { PlayerCardData } from '../player-card-model';

/**
 * Presentational identity card shared by every detail view (recruits, roster
 * players, transfers). Pass context-specific extras — season stats, career
 * tables, recruiting actions — via `footer`.
 */
export function PlayerCard({ data, footer }: { data: PlayerCardData; footer?: ReactNode }) {
  return (
    <>
      <div>
        <p className="panel-name">
          {data.name}
          {data.badges.map((b) => (
            <span key={b.label} className={`card-badge card-badge-${b.tone}`}>{b.label}</span>
          ))}
        </p>
        <p className="panel-meta">{data.subtitle}</p>
      </div>

      <div className="ovr-block">
        <div className="ovr-stat">
          <div className="ovr-num">
            {data.overall === null ? '??' : `${data.overallFuzzy ? '~' : ''}${data.overall}`}
          </div>
          <div className="ovr-label">Overall</div>
        </div>
        <div className="ovr-stat">
          <div className="ovr-num">{data.potential === null ? '??' : data.potential}</div>
          <div className="ovr-label">Potential</div>
        </div>
      </div>

      <div>
        {data.ratings.map((r) => (
          <div key={r.label} className="rating-row">
            <span>{r.label}</span>
            <div className="rating-bar-wrap">
              <div className="rating-bar-fill" style={{ width: r.value === null ? '0%' : `${r.value}%` }} />
            </div>
            <span className="rating-val">{r.value === null ? '—' : r.value}</span>
          </div>
        ))}
      </div>

      {data.traits.length > 0 && (
        <div className="trait-list">
          {data.traits.map((trait) => (
            <span key={trait} className="trait-chip">{trait}</span>
          ))}
        </div>
      )}

      {footer}
    </>
  );
}

/** Slide-out panel wrapper around a PlayerCard. */
export function PlayerCardPanel({
  data,
  footer,
  onClose,
}: {
  data: PlayerCardData;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="player-panel-backdrop" onClick={onClose}>
      <aside className="player-panel card" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close player panel">×</button>
        <PlayerCard data={data} footer={footer} />
      </aside>
    </div>
  );
}
