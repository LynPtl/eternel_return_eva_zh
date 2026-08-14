import { describe, expect, it } from "vitest";
import { comparePlayers, summarizePlayer, summarizeShared } from "../../src/lib/er/metrics";
import type { SharedMatchResult } from "../../src/lib/er/shared";
import type { CharacterMap, DakggMatch, PlayerMatchSample } from "../../src/lib/er/types";

const characters: CharacterMap = {
  12: { id: 12, key: "Hyejin", name: "慧珍" },
  50: { id: 50, key: "Elena", name: "埃琳娜" }
};

function match(overrides: Partial<DakggMatch>): DakggMatch {
  return {
    gameId: 1,
    nickname: "A",
    startDtm: "2026-08-14T00:00:00.000+0900",
    matchingMode: 3,
    teamNumber: 1,
    gameRank: 1,
    characterNum: 12,
    playerKill: 1,
    playerAssistant: 2,
    playerDeaths: 1,
    teamKill: 8,
    damageToPlayer: 10000,
    damageFromPlayer: 5000,
    damageToMonster: 40000,
    monsterKill: 30,
    addTelephotoCamera: 10,
    useSecurityConsole: 2,
    totalGainVFCredit: 700,
    totalUseVFCredit: 500,
    viewContribution: 20,
    ccTimeToPlayer: 30,
    ...overrides
  };
}

function sample(nickname: string, matches: DakggMatch[]): PlayerMatchSample {
  return { nickname, matches, sampleCount: matches.length, excludedCobaltCount: 0, exhaustedPages: true };
}

describe("metrics aggregation", () => {
  it("summarizes individual player metrics and character pool", () => {
    const summary = summarizePlayer(
      sample("A", [match({ gameRank: 1 }), match({ gameId: 2, gameRank: 3, characterNum: 50 })]),
      characters
    );

    expect(summary.nickname).toBe("A");
    expect(summary.summary.avgRank).toBe(2);
    expect(summary.summary.wins).toBe(1);
    expect(summary.characters.map((item) => item.name)).toEqual(["慧珍", "埃琳娜"]);
  });

  it("summarizes shared matches and compares role tendencies", () => {
    const shared: SharedMatchResult = {
      confidence: "high",
      matches: [
        {
          gameId: 10,
          startDtm: "2026-08-14T00:00:00.000+0900",
          teamNumber: 1,
          participants: [
            match({ nickname: "A", damageToPlayer: 20000, damageFromPlayer: 4000, viewContribution: 10 }),
            match({ nickname: "B", damageToPlayer: 8000, damageFromPlayer: 13000, viewContribution: 35 })
          ]
        }
      ]
    };

    const sharedSummary = summarizeShared(shared, characters);
    const comparison = comparePlayers(sharedSummary);

    expect(sharedSummary.matchCount).toBe(1);
    expect(sharedSummary.teamMetricsReliable).toBe(true);
    expect(sharedSummary.avgRank).toBe(1);
    expect(sharedSummary.wins).toBe(1);
    expect(sharedSummary.avgTeamKill).toBe(8);
    expect(sharedSummary.matches[0].teamMetricsReliable).toBe(true);
    expect(sharedSummary.matches[0].rank).toBe(1);
    expect(comparison.damageLeader).toBe("A");
    expect(comparison.pressureBearer).toBe("B");
    expect(comparison.visionLeader).toBe("B");
  });

  it("does not expose team metrics for low-confidence fallback shared matches", () => {
    const shared: SharedMatchResult = {
      confidence: "low",
      matches: [
        {
          gameId: 11,
          startDtm: "2026-08-14T00:00:00.000+0900",
          participants: [
            match({ nickname: "A", teamNumber: undefined, gameRank: 1, teamKill: 12, damageToPlayer: 18000 }),
            match({ nickname: "B", teamNumber: 4, gameRank: 8, teamKill: 2, damageToPlayer: 9000 })
          ]
        }
      ]
    };

    const sharedSummary = summarizeShared(shared, characters);
    const comparison = comparePlayers(sharedSummary);

    expect(sharedSummary.teamMetricsReliable).toBe(false);
    expect(sharedSummary.avgRank).toBeNull();
    expect(sharedSummary.wins).toBeNull();
    expect(sharedSummary.avgTeamKill).toBeNull();
    expect(sharedSummary.matches[0].teamMetricsReliable).toBe(false);
    expect(sharedSummary.matches[0].mode).toBeNull();
    expect(sharedSummary.matches[0].rank).toBeNull();
    expect(sharedSummary.matches[0].participants.map((participant) => participant.nickname)).toEqual(["A", "B"]);
    expect(comparison.damageLeader).toBe("A");
  });

  it("handles empty shared participant lists without crashing", () => {
    const shared: SharedMatchResult = {
      confidence: "high",
      matches: [
        {
          gameId: 12,
          startDtm: "2026-08-14T00:00:00.000+0900",
          teamNumber: 1,
          participants: []
        }
      ]
    };

    const sharedSummary = summarizeShared(shared, characters);
    const comparison = comparePlayers(sharedSummary);

    expect(sharedSummary.matchCount).toBe(1);
    expect(sharedSummary.teamMetricsReliable).toBe(false);
    expect(sharedSummary.avgRank).toBeNull();
    expect(sharedSummary.wins).toBeNull();
    expect(sharedSummary.avgTeamKill).toBeNull();
    expect(sharedSummary.matches[0]).toMatchObject({
      gameId: 12,
      mode: null,
      rank: null,
      teamMetricsReliable: false,
      participants: []
    });
    expect(comparison.damageLeader).toBeNull();
  });

  it("marks partial team data as unreliable even when confidence is high", () => {
    const shared: SharedMatchResult = {
      confidence: "high",
      matches: [
        {
          gameId: 13,
          startDtm: "2026-08-14T00:00:00.000+0900",
          teamNumber: 2,
          participants: [
            match({ nickname: "A", teamNumber: 2, gameRank: 1, teamKill: 10 }),
            match({ nickname: "B", teamNumber: undefined, gameRank: 1, teamKill: 10 })
          ]
        }
      ]
    };

    const sharedSummary = summarizeShared(shared, characters);

    expect(sharedSummary.teamMetricsReliable).toBe(false);
    expect(sharedSummary.avgRank).toBeNull();
    expect(sharedSummary.wins).toBeNull();
    expect(sharedSummary.avgTeamKill).toBeNull();
    expect(sharedSummary.matches[0].teamMetricsReliable).toBe(false);
    expect(sharedSummary.matches[0].rank).toBeNull();
  });
});
