import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { revealStamp, type GameReveal } from '../game-reveal';
import { motionAllowed, setRevealsEnabled } from '../ui/motion';

const TICK_MS = 380;

/** The result card after the user's game: the board ticks through each quarter, then the stamp lands. */
export function GameRevealModal({
  reveal,
  userName,
  opponentName,
  onBoxScore,
  onClose,
}: {
  reveal: GameReveal;
  userName: string;
  opponentName: string;
  onBoxScore?: (() => void) | undefined;
  onClose: () => void;
}) {
  const last = reveal.periods.length - 1;
  const [step, setStep] = useState(() => (motionAllowed() ? 0 : last));
  const [skipNext, setSkipNext] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const done = step >= last;

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), TICK_MS);
    return () => window.clearTimeout(t);
  }, [step, done]);

  useEffect(() => {
    if (done) closeRef.current?.focus();
  }, [done]);

  const close = () => {
    if (skipNext) setRevealsEnabled(false);
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        if (!done) setStep(last);
        else if (e.key === 'Escape') close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const board = reveal.periods[Math.min(step, last)]!;
  const stamp = revealStamp(reveal);
  const rank = (r: number | null) => (r !== null ? <span className="reveal-rank">#{r}</span> : null);

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Game result" onClick={() => (done ? undefined : setStep(last))}>
      <div className={`modal-panel card reveal-panel ${done ? (reveal.won ? 'reveal-win' : 'reveal-loss') : ''}`} onClick={(e) => { e.stopPropagation(); if (!done) setStep(last); }}>
        <p className="eyebrow">
          Week {reveal.week} · {reveal.userIsHome ? 'Home' : 'Away'}
          {reveal.trophy ? ` · ${reveal.trophy}` : ''}
        </p>
        <div className="reveal-board" aria-live="polite">
          <div className="reveal-team">
            <span className="reveal-name">{rank(reveal.userRank)}{userName}</span>
            <span className={`reveal-score ${done && reveal.won ? 'lead' : ''}`}>{board.user}</span>
          </div>
          <div className="reveal-team">
            <span className="reveal-name">{rank(reveal.opponentRank)}{opponentName}</span>
            <span className={`reveal-score ${done && !reveal.won ? 'lead' : ''}`}>{board.opponent}</span>
          </div>
          <div className="reveal-periods" aria-hidden="true">
            {reveal.periods.map((p, i) => (
              <span key={p.label} className={i === Math.min(step, last) ? 'current' : i < step ? 'past' : ''}>
                {p.label}
              </span>
            ))}
          </div>
        </div>
        {done ? (
          <>
            <p className={`reveal-stamp stamp-${reveal.won ? (reveal.upset || reveal.trophy ? 'big' : 'win') : 'loss'}`}>
              {stamp}
              {reveal.overtime && <span className="reveal-ot"> in OT</span>}
            </p>
            <div className="modal-actions reveal-actions">
              <button type="button" ref={closeRef} className="primary-action" onClick={close}>
                Continue
              </button>
              {onBoxScore && (
                <button type="button" className="ghost-btn" onClick={() => { close(); onBoxScore(); }}>
                  Box score
                </button>
              )}
              <label className="reveal-skip">
                <input type="checkbox" checked={skipNext} onChange={(e) => setSkipNext(e.target.checked)} /> Skip result reveals from now on
              </label>
            </div>
          </>
        ) : (
          <p className="dim reveal-hint">Click to skip</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
