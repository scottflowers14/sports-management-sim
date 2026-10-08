import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LacrosseGamePlan } from '@sports-management-sim/sport-lacrosse';
import { GamePlanPanel, type OpponentScout } from './GamePlanPanel';
import { HelpTip } from './HelpTip';

/**
 * The first step of Coach the Game: read the scout, set the plan, then play
 * the first half. Halftime comes next with the second-half adjustments.
 */
export function PregameModal({
  label,
  scout,
  gamePlan,
  onGamePlanChange,
  autoGamePlan,
  onUseStaffPlan,
  onPlayFirstHalf,
  onCancel,
}: {
  label: string;
  scout: OpponentScout | null;
  gamePlan: LacrosseGamePlan;
  onGamePlanChange: (plan: LacrosseGamePlan) => void;
  autoGamePlan?: boolean | undefined;
  onUseStaffPlan?: (() => void) | undefined;
  onPlayFirstHalf: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pregame-title" onClick={onCancel}>
      <div className="modal-panel card pregame-panel" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{label} · Pregame</p>
        <h2 id="pregame-title">
          {scout ? `Game plan ${scout.isHome ? 'vs' : 'at'} ${scout.name}` : 'Game plan'}
        </h2>
        <p className="dim pregame-intro">
          Set your plan, then play the first half. You can adjust again at halftime. <HelpTip term="game-plan" />
        </p>
        <div className="gameplan-card pregame-plan">
          <GamePlanPanel
            scout={scout}
            gamePlan={gamePlan}
            onGamePlanChange={onGamePlanChange}
            autoGamePlan={autoGamePlan}
            onUseStaffPlan={onUseStaffPlan}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-action" onClick={onPlayFirstHalf}>
            Play First Half →
          </button>
          <button type="button" onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
