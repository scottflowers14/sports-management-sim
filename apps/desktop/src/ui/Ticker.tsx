import { useCountUp, useRecentChange } from './motion';

/** A number that counts to its new value instead of snapping. */
export function TickerNumber({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

/** Flashes ▲ or ▼ for a few seconds after a poll rank moves (a lower number is better). */
export function RankMove({ rank }: { rank: number | null }) {
  const change = useRecentChange(rank);
  if (change === null || change === 0) return null;
  const up = change < 0;
  return (
    <span className={`rank-move ${up ? 'up' : 'down'}`} aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(change)} in the poll`}>
      {up ? '▲' : '▼'}
      {Math.abs(change)}
    </span>
  );
}
