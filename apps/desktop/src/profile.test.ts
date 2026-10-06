import { describe, expect, it } from "vitest";
import type { DynastySeasonRecord } from "./history";
import {
  PROFILE_KEY,
  careerBests,
  careerFromHistory,
  emptyProfile,
  loadProfile,
  profileBests,
  profileTotals,
  saveProfile,
} from "./profile";

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

const season = (
  year: number,
  wins: number,
  losses: number,
  extra: Partial<DynastySeasonRecord> = {},
): DynastySeasonRecord => ({
  year,
  wins,
  losses,
  confStanding: 2,
  natRankAtEnd: 8,
  confChampion: false,
  nationalChampion: false,
  signingClassSize: 6,
  teamName: "Capital City",
  ...extra,
});

describe("player profile", () => {
  it("round-trips through storage and survives junk", () => {
    const storage = memoryStorage();
    expect(loadProfile(storage)).toEqual(emptyProfile());
    const profile = {
      ...emptyProfile(),
      achievements: { "first-win": { year: 2028, at: "x" } },
    };
    expect(saveProfile(profile, storage)).toBe(true);
    expect(loadProfile(storage)).toEqual(profile);
    storage.setItem(PROFILE_KEY, "{not json");
    expect(loadProfile(storage)).toEqual(emptyProfile());
  });

  it("reports a failed write instead of throwing", () => {
    const full = {
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    expect(saveProfile(emptyProfile(), full)).toBe(false);
  });

  it("sums a dynasty into a career and careers into lifetime totals", () => {
    const career = careerFromHistory(
      [
        season(2030, 9, 2, { nationalChampion: true, confChampion: true }),
        season(2029, 6, 4),
      ],
      "Pat Reyes",
    )!;
    expect(career).toMatchObject({
      coachName: "Pat Reyes",
      teamName: "Capital City",
      firstYear: 2029,
      lastYear: 2030,
      seasons: 2,
      wins: 15,
      losses: 6,
      confTitles: 1,
      nationalTitles: 1,
    });
    expect(careerFromHistory([], "x")).toBeNull();
    const totals = profileTotals({
      ...emptyProfile(),
      careers: {
        a: career,
        b: { ...career, wins: 5, losses: 5, nationalTitles: 0 },
      },
    });
    expect(totals).toEqual({
      dynasties: 2,
      seasons: 4,
      wins: 20,
      losses: 11,
      confTitles: 2,
      nationalTitles: 1,
    });
  });

  it("finds a career's best season, finish, games and win streak", () => {
    const g = (goalsFor: number, goalsAgainst: number) => ({
      opponentId: "x",
      goalsFor,
      goalsAgainst,
    });
    // Newest first, as history is stored.
    const history = [
      season(2029, 12, 3, {
        natRankAtEnd: 3,
        games: [g(10, 8), g(9, 12), g(11, 10)],
      }),
      season(2028, 9, 6, {
        natRankAtEnd: 12,
        games: [g(8, 4), g(9, 5), g(18, 6), g(7, 6), g(5, 9)],
      }),
    ];
    const bests = careerBests(history);
    expect(bests.bestSeason).toEqual({ year: 2029, wins: 12, losses: 3 });
    expect(bests.bestFinish).toEqual({ year: 2029, rank: 3 });
    expect(bests.biggestWin).toEqual({
      year: 2028,
      goalsFor: 18,
      goalsAgainst: 6,
    });
    expect(bests.mostGoals).toEqual({
      year: 2028,
      goalsFor: 18,
      goalsAgainst: 6,
    });
    // Four straight in 2028, broken by the loss; 2029 adds a win then loses.
    expect(bests.longestWinStreak).toBe(4);
    expect(careerBests([])).toEqual({
      bestSeason: null,
      bestFinish: null,
      biggestWin: null,
      mostGoals: null,
      longestWinStreak: 0,
    });
  });

  it("picks the best mark across careers and skips careers without bests", () => {
    const g = (goalsFor: number, goalsAgainst: number) => ({
      opponentId: "x",
      goalsFor,
      goalsAgainst,
    });
    const a = careerFromHistory(
      [
        season(2030, 14, 1, {
          natRankAtEnd: 1,
          nationalChampion: true,
          games: [g(12, 4)],
        }),
      ],
      "Pat Lee",
    )!;
    const b = careerFromHistory(
      [
        season(2031, 10, 5, {
          natRankAtEnd: 6,
          games: [g(20, 5), g(9, 8), g(9, 7)],
          teamName: "Harbor",
        }),
      ],
      "Sam Ortiz",
    )!;
    const { bests: _dropped, ...old } = careerFromHistory(
      [season(2027, 15, 0)],
      "Old Save",
    )!;
    const bests = profileBests({ ...emptyProfile(), careers: { a, b, old } });
    expect(bests.bestSeason).toMatchObject({
      value: { year: 2030, wins: 14 },
      coachName: "Pat Lee",
    });
    expect(bests.bestFinish?.value.rank).toBe(1);
    expect(bests.biggestWin).toMatchObject({
      value: { goalsFor: 20, goalsAgainst: 5 },
      coachName: "Sam Ortiz",
      teamName: "Harbor",
    });
    expect(bests.longestWinStreak).toMatchObject({
      value: 3,
      coachName: "Sam Ortiz",
    });
    expect(bests.mostTitles).toMatchObject({ value: 1, coachName: "Pat Lee" });
    expect(profileBests(emptyProfile()).bestSeason).toBeNull();
  });
});
