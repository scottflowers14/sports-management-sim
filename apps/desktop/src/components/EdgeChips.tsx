import type { ScheduleMatchupPreview } from '../schedule-preview';
import { HelpTip } from './HelpTip';

const EDGES = [
  { key: 'ratingEdge', label: 'OVR', title: 'Team rating vs theirs' },
  { key: 'offenseEdge', label: 'OFF', title: 'Your offense vs their defense' },
  { key: 'defenseEdge', label: 'DEF', title: 'Your defense vs their offense' },
  { key: 'goalieEdge', label: 'GK', title: 'Your goalie vs theirs' },
  { key: 'faceoffEdge', label: 'FO', title: 'Your faceoff unit vs theirs' },
] as const;

/**
 * Matchup edges, always from your side: positive means you have the better
 * unit. The hub and the Season screen show the same five, labelled the same.
 */
export function EdgeChips({ preview }: { preview: Pick<ScheduleMatchupPreview, (typeof EDGES)[number]['key']> }) {
  return (
    <div className="edge-chips" aria-label="Your edge">
      <span className="edge-chips-label">
        Your edge <HelpTip term="edge" />
      </span>
      <div className="hub-edges">
        {EDGES.map(({ key, label, title }) => {
          const val = preview[key];
          return (
            <div
              key={key}
              className={`hub-edge ${val > 0 ? 'edge-pos positive' : val < 0 ? 'edge-neg negative' : 'even'}`}
              title={`${title}: ${val > 0 ? '+' : ''}${val}`}
            >
              <span className="hub-edge-label">{label}</span>
              <span className="hub-edge-val">{val > 0 ? '+' : ''}{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
