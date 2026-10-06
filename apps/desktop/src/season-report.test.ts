import { describe, expect, it } from "vitest";
import { seasonReport } from "./season-report";
import type { ChallengeResult } from "./challenges";

const challenge = (
  year: number,
  completed: boolean,
  xp = 20,
): ChallengeResult => ({
  year,
  week: 1,
  opponentId: "x",
  text: "Win the game",
  xp,
  completed,
});

describe("season report", () => {
  it("counts only the finished season, biggest achievements first", () => {
    const report = seasonReport(
      2029,
      {
        "first-win": { year: 2028, at: "a" },
        "nail-biter": { year: 2029, at: "b" },
        "national-title": { year: 2029, at: "c" },
        "ten-wins": { year: 2029, at: "d" },
      },
      [
        challenge(2028, true),
        challenge(2029, true, 35),
        challenge(2029, false),
        challenge(2029, true, 15),
      ],
    );
    expect(report.achievements.map((a) => a.id)).toEqual([
      "national-title",
      "ten-wins",
      "nail-biter",
    ]);
    expect(report.points).toBe(50 + 25 + 10);
    expect(report).toMatchObject({
      challengesMet: 2,
      challengesFaced: 3,
      challengeXp: 50,
    });
  });

  it("ignores unlock ids that no longer exist and empty seasons", () => {
    const report = seasonReport(
      2030,
      { "retired-achievement": { year: 2030, at: "x" } },
      [],
    );
    expect(report).toMatchObject({
      achievements: [],
      points: 0,
      challengesMet: 0,
      challengesFaced: 0,
      challengeXp: 0,
    });
  });
});
