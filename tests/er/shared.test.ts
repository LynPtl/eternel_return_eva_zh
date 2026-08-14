import { describe, expect, it } from "vitest";
import { findSharedMatches } from "../../src/lib/er/shared";
import type { DakggMatch, PlayerMatchSample } from "../../src/lib/er/types";

function match(nickname: string, gameId: number, teamNumber?: number): DakggMatch {
  return {
    gameId,
    nickname,
    startDtm: "2026-08-14T00:00:00.000+0900",
    matchingMode: 3,
    matchingTeamMode: 3,
    teamNumber,
    gameRank: 1,
    characterNum: 12,
    playerKill: 1,
    playerAssistant: 2,
    playerDeaths: 0
  };
}

function sample(nickname: string, matches: DakggMatch[]): PlayerMatchSample {
  return {
    nickname,
    matches,
    sampleCount: matches.length,
    excludedCobaltCount: 0,
    exhaustedPages: true
  };
}

describe("findSharedMatches", () => {
  it("requires same gameId and teamNumber when team data exists", () => {
    const result = findSharedMatches([
      sample("A", [match("A", 1, 7), match("A", 2, 4)]),
      sample("B", [match("B", 1, 7), match("B", 2, 5)])
    ]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].gameId).toBe(1);
    expect(result.confidence).toBe("high");
  });

  it("falls back to gameId when teamNumber is missing", () => {
    const result = findSharedMatches([
      sample("A", [match("A", 3)]),
      sample("B", [match("B", 3, 1)])
    ]);

    expect(result.matches).toHaveLength(1);
    expect(result.confidence).toBe("low");
  });
});
