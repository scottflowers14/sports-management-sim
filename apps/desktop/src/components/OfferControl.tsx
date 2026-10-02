import { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

export const OFFER_PERCENT_OPTIONS = [25, 50, 75, 100] as const;

/** Scholarship percent picker plus Offer button, bounded by what's left to spend. */
export function OfferControl({
  recruitId,
  recruitName,
  budgetRemaining,
  onOffer,
  label = 'Offer',
}: {
  recruitId: string;
  recruitName: string;
  budgetRemaining: number;
  onOffer: (recruitId: string, scholarshipPercent: number) => void;
  label?: string;
}) {
  const affordable = OFFER_PERCENT_OPTIONS.filter((pct) => pct / 100 <= budgetRemaining + 1e-9);
  const maxAffordable = affordable[affordable.length - 1];
  const [percent, setPercent] = useState<number>(maxAffordable ?? 100);
  const [showConfirm, setShowConfirm] = useState(false);
  const canAfford = percent / 100 <= budgetRemaining + 1e-9;

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          title="Full Scholarship Offer"
          message={`Offer ${recruitName} a full scholarship (100%)? This uses a full equivalency from your budget.`}
          confirmLabel="Yes, Offer 100%"
          danger
          onConfirm={() => { setShowConfirm(false); onOffer(recruitId, percent); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      <div className="offer-control">
        <select
          aria-label={`Scholarship offer amount for ${recruitName}`}
          className="offer-pct-select"
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
        >
          {OFFER_PERCENT_OPTIONS.map((pct) => (
            <option key={pct} value={pct} disabled={pct / 100 > budgetRemaining + 1e-9}>
              {pct}%
            </option>
          ))}
        </select>
        <button
          className="offer-btn offer-btn-sm offer-btn-row"
          disabled={!canAfford}
          title={canAfford ? `Offer a ${percent}% scholarship` : 'Not enough scholarship budget'}
          onClick={() => {
            if (percent === 100) {
              setShowConfirm(true);
            } else {
              onOffer(recruitId, percent);
            }
          }}
        >
          {label}
        </button>
      </div>
    </>
  );
}
