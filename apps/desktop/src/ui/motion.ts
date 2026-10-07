import { useEffect, useRef, useState } from 'react';

const SKIP_REVEALS_KEY = 'sms.skipReveals';

/** Animations play only in a real browser with motion allowed (jsdom has no matchMedia). */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The player turned result reveals off, or this isn't a browser that can show them. */
export function revealsEnabled(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.localStorage.getItem(SKIP_REVEALS_KEY) !== '1';
  } catch {
    return true;
  }
}

export function setRevealsEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(SKIP_REVEALS_KEY);
    else window.localStorage.setItem(SKIP_REVEALS_KEY, '1');
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/**
 * Counts from the last shown value to a new one instead of snapping. The
 * first render shows the value as is; without motion every change snaps.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (start === target || !motionAllowed()) {
      setShown(target);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - k) ** 3;
      setShown(Math.round(start + (target - start) * eased));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return shown;
}

/**
 * The change since the value last moved, held for a few seconds so a rank
 * jump can flash (positive = the number went up).
 */
export function useRecentChange(value: number | null, holdMs = 4000): number | null {
  const prev = useRef(value);
  const [change, setChange] = useState<number | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === null || value === null || before === value) return;
    setChange(value - before);
    const timer = window.setTimeout(() => setChange(null), holdMs);
    return () => window.clearTimeout(timer);
  }, [value, holdMs]);
  return change;
}
