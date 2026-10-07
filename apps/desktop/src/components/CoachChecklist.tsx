import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GuideStep } from '../coach-guide';

/** The first-season checklist at the top of the Week Hub. */
export function CoachChecklistCard({
  steps,
  onNavigate,
  onDismiss,
}: {
  steps: GuideStep[];
  onNavigate: (view: string) => void;
  onDismiss: () => void;
}) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <article className="card coach-checklist" aria-label="Coach's checklist">
      <div className="coach-checklist-head">
        <div>
          <p className="eyebrow">First season</p>
          <h3 className="hub-card-title">Coach&apos;s Checklist</h3>
        </div>
        <span className="coach-checklist-count">{done}/{steps.length} done</span>
        <button type="button" className="ghost-btn" onClick={onDismiss}>
          {next ? 'Hide checklist' : 'Close checklist'}
        </button>
      </div>
      <div className="coach-checklist-track" aria-hidden="true">
        <div className="coach-checklist-fill" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      {next ? (
        <ol className="coach-checklist-steps">
          {steps.map((step) => (
            <li key={step.id} className={step.done ? 'step-done' : step === next ? 'step-next' : ''}>
              <span className="step-mark" aria-hidden="true">{step.done ? '✓' : ''}</span>
              <span className="step-text">
                <strong>{step.label}</strong>
                {!step.done && <span className="dim" style={{ display: 'block' }}>{step.detail}</span>}
              </span>
              {!step.done && step.nav !== 'week-hub' && (
                <button type="button" className="hub-action-nav" onClick={() => onNavigate(step.nav)}>
                  Go →
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="dim" style={{ marginBottom: 0 }}>
          You&apos;re set up. From here the loop is simple: check Recommended Actions, then press Advance. Win games, sign a class and meet your season goals to keep the AD happy.
        </p>
      )}
    </article>
  );
}

/** A one-time hello for a brand-new coach. */
export function WelcomeModal({
  coachName,
  teamName,
  onClose,
}: {
  coachName: string;
  teamName: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={onClose}>
      <div className="modal-panel card welcome-panel" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Welcome, Coach {coachName}</p>
        <h2 id="welcome-title">You run {teamName} now</h2>
        <ul className="welcome-points">
          <li><strong>The job:</strong> win games, sign a recruiting class every year and meet the season goals your athletic director sets.</li>
          <li><strong>Moving time:</strong> the blue Advance button at the top right always does the next thing, whether that&apos;s a week, the postseason or the offseason.</li>
          <li><strong>Where to start:</strong> the Coach&apos;s Checklist on the Week Hub walks you through your first week.</li>
        </ul>
        <div className="modal-actions">
          <button type="button" ref={closeRef} className="primary-action" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
