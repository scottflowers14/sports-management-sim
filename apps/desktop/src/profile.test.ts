import { describe, expect, it } from 'vitest';
import type { DynastySeasonRecord } from './history';
import { PROFILE_KEY, careerFromHistory, emptyProfile, loadProfile, profileTotals, saveProfile } from './profile';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const season = (year: number, wins: number, losses: number, extra: Partial<DynastySeasonRecord> = {}): DynastySeasonRecord => ({
  year,
  wins,
  losses,
  confStanding: 2,
  natRankAtEnd: 8,
  confChampion: false,
  nationalChampion: false,
  signingClassSize: 6,
  teamName: 'Capital City',
  ...extra,
});

describe('player profile', () => {
  it('round-trips through storage and survives junk', () => {
    const storage = memoryStorage();
    expect(loadProfile(storage)).toEqual(emptyProfile());
    const profile = { ...emptyProfile(), achievements: { 'first-win': { year: 2028, at: 'x' } } };
    expect(saveProfile(profile, storage)).toBe(true);
    expect(loadProfile(storage)).toEqual(profile);
    storage.setItem(PROFILE_KEY, '{not json');
    expect(loadProfile(storage)).toEqual(emptyProfile());
  });

  it('reports a failed write instead of throwing', () => {
    const full = { ...memoryStorage(), setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(saveProfile(emptyProfile(), full)).toBe(false);
  });

  it('sums a dynasty into a career and careers into lifetime totals', () => {
    const career = careerFromHistory(
      [season(2030, 9, 2, { nationalChampion: true, confChampion: true }), season(2029, 6, 4)],
      'Pat Reyes',
    )!;
    expect(career).toMatchObject({ coachName: 'Pat Reyes', teamName: 'Capital City', firstYear: 2029, lastYear: 2030, seasons: 2, wins: 15, losses: 6, confTitles: 1, nationalTitles: 1 });
    expect(careerFromHistory([], 'x')).toBeNull();
    const totals = profileTotals({ ...emptyProfile(), careers: { a: career, b: { ...career, wins: 5, losses: 5, nationalTitles: 0 } } });
    expect(totals).toEqual({ dynasties: 2, seasons: 4, wins: 20, losses: 11, confTitles: 2, nationalTitles: 1 });
  });
});
