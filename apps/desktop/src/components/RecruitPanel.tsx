import type { LacrosseRecruit } from '@sports-management-sim/sport-lacrosse';
import { topRecruitMotivations, type RecruitMotivation } from '@sports-management-sim/engine-core';
import type { ScoutingState } from '../scouting';
import { getDisplayOvr, getScoutTier } from '../scouting';
import { cardFromRecruit } from '../player-card-model';
import { PlayerCardPanel } from './PlayerCard';
import { formatTeamShort } from '../ui/format';

/** 4★+ recruits are nationally ranked — their star tier is public knowledge. */
const PUBLIC_STAR_FLOOR = 4;

const MOTIVATION_LABELS: Record<RecruitMotivation, string> = {
  proximity: 'Close to Home',
  prestige: 'Big Stage',
  scholarship: 'Scholarship $',
  playingTime: 'Playing Time',
  academics: 'Academics',
};

export function RecruitPanel({
  recruit,
  scouting,
  userTeamId,
  teamMap,
  onScout,
  onClose,
}: {
  recruit: LacrosseRecruit;
  scouting: ScoutingState;
  userTeamId: string;
  teamMap: Map<string, string>;
  onScout: (recruitId: string, trueOvr: number) => void;
  onClose: () => void;
}) {
  const tier = getScoutTier(recruit.id, scouting);
  const displayOvr = getDisplayOvr(recruit.id, recruit.ratings.overall, scouting);
  const starsPublic = recruit.starRating >= PUBLIC_STAR_FLOOR;
  const data = cardFromRecruit(recruit, { tier, displayOvr, starsPublic });

  const userInterest = recruit.interestByTeamId[userTeamId] ?? 0;
  const userOffer = recruit.scholarshipOffers.find((o) => o.teamId === userTeamId);
  const motivations = tier === 'none' ? [] : topRecruitMotivations(recruit.preferences, tier === 'full' ? 2 : 1);
  const committedElsewhere =
    recruit.status !== 'open' &&
    recruit.committedTeamId !== userTeamId &&
    recruit.signedTeamId !== userTeamId;
  const destination = recruit.committedTeamId ?? recruit.signedTeamId;

  const competitors = recruit.scholarshipOffers
    .filter((o) => o.teamId !== userTeamId)
    .map((o) => ({ teamId: o.teamId, name: formatTeamShort(teamMap.get(o.teamId) ?? o.teamId), interest: recruit.interestByTeamId[o.teamId] ?? 0 }))
    .sort((a, b) => b.interest - a.interest)
    .slice(0, 3);

  const footer = (
    <div className="player-stats-section recruit-panel-footer">
      <p className="section-label">Recruiting</p>

      {committedElsewhere && destination ? (
        <p className="dim">Committed to {formatTeamShort(teamMap.get(destination) ?? destination)}.</p>
      ) : (
        <>
          <div className="interest-bar-wrap">
            <div className="interest-bar" style={{ width: `${userInterest}%` }} />
          </div>
          <div className="recruit-interest-row">
            <span className="interest-label">Your interest {userInterest}/100</span>
            {userOffer && <span className="badge badge-offered">Offered {userOffer.scholarshipPercent}%</span>}
          </div>
        </>
      )}

      {motivations.length > 0 && (
        <div className="motive-row">
          {motivations.map((m) => (
            <span key={m} className="motive-chip">{MOTIVATION_LABELS[m]}</span>
          ))}
        </div>
      )}
      {tier !== 'full' && (
        <p className="dim recruit-panel-hint">
          {tier === 'none' ? 'Ratings hidden — scout to reveal.' : 'Estimated rating — full scout to confirm.'}
        </p>
      )}

      {competitors.length > 0 && !committedElsewhere && (
        <div className="competitor-row">
          {competitors.map((c) => (
            <span key={c.teamId} className="competitor-chip" title={`${c.name} — ${c.interest} interest`}>{c.name}</span>
          ))}
        </div>
      )}

      {tier !== 'full' && !committedElsewhere && (
        <button
          className="scout-btn"
          onClick={() => onScout(recruit.id, recruit.ratings.overall)}
          disabled={scouting.pointsAvailable <= 0}
        >
          {tier === 'partial' ? 'Full Scout (1 pt)' : 'Scout (1 pt)'}
        </button>
      )}
    </div>
  );

  return <PlayerCardPanel data={data} footer={footer} onClose={onClose} />;
}
