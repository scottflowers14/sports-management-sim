import { RUSH_SETBACK_CHANCE, canRushInjury, rushedWeeksOut } from '@sports-management-sim/sport-lacrosse';
import type { InjuredPlayer } from '../dynasty-helpers';

/** Halve the time out, with a chance of a setback when the player tries to return. */
export function RushBackButton({
  injury,
  onRush,
}: {
  injury: InjuredPlayer;
  onRush: (playerId: string) => void;
}) {
  if (!canRushInjury(injury.weeksRemaining, injury.rushed === true)) return null;
  const weeks = rushedWeeksOut(injury.weeksRemaining);
  return (
    <button
      className="rush-back-btn"
      onClick={() => onRush(injury.playerId)}
      title={`Back in ${weeks} week${weeks > 1 ? 's' : ''} instead of ${injury.weeksRemaining}, with a ${Math.round(
        RUSH_SETBACK_CHANCE * 100,
      )}% chance of a setback that costs more time.`}
    >
      Rush back ({weeks} wk)
    </button>
  );
}
