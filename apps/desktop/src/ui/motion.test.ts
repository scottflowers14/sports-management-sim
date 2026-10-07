import { afterEach, describe, expect, it } from 'vitest';
import { motionAllowed, revealsEnabled, setRevealsEnabled } from './motion';

const stubMedia = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })) as unknown as typeof window.matchMedia;
};

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
  localStorage.clear();
});

describe('motion settings', () => {
  it('stays still without a browser media query, or when the player asks for less motion', () => {
    expect(motionAllowed()).toBe(false);
    expect(revealsEnabled()).toBe(false);
    stubMedia(true);
    expect(motionAllowed()).toBe(false);
    stubMedia(false);
    expect(motionAllowed()).toBe(true);
  });

  it('remembers when result reveals are turned off', () => {
    stubMedia(false);
    expect(revealsEnabled()).toBe(true);
    setRevealsEnabled(false);
    expect(revealsEnabled()).toBe(false);
    setRevealsEnabled(true);
    expect(revealsEnabled()).toBe(true);
  });
});
