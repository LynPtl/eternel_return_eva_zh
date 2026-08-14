import { describe, expect, it } from "vitest";
import type { DakggMatch } from "../../src/lib/er/types";
import { selectRecentNonCobaltMatches } from "../../src/lib/er/samples";

function match(gameId: number, mode: number): DakggMatch {
  return {
    gameId,
    nickname: "A",
    startDtm: `2026-08-14T00:${String(gameId).padStart(2, "0")}:00.000+0900`,
    matchingMode: mode,
    matchingTeamMode: mode === 6 ? 4 : 3,
    teamNumber: 1,
    gameRank: 1,
    characterNum: 12
  };
}

describe("selectRecentNonCobaltMatches", () => {
  it("excludes Cobalt and keeps the latest non-Cobalt matches up to limit", () => {
    const pages = [[match(1, 2), match(2, 6), match(3, 3), match(4, 2)]];
    const sample = selectRecentNonCobaltMatches("A", pages, 2);

    expect(sample.matches.map((item) => item.gameId)).toEqual([1, 3]);
    expect(sample.sampleCount).toBe(2);
    expect(sample.excludedCobaltCount).toBe(1);
  });

  it("returns fewer than limit when not enough non-Cobalt matches exist", () => {
    const pages = [[match(1, 6), match(2, 3)]];
    const sample = selectRecentNonCobaltMatches("A", pages, 20);

    expect(sample.matches.map((item) => item.gameId)).toEqual([2]);
    expect(sample.sampleCount).toBe(1);
    expect(sample.excludedCobaltCount).toBe(1);
  });
});
