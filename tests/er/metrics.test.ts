import { describe, expect, it } from "vitest";
import { comparePlayers, summarizePlayer, summarizeShared } from "../../src/lib/er/metrics";
import type { SharedMatchResult } from "../../src/lib/er/shared";
import type { CharacterMap, DakggMatch, PlayerMatchSample } from "../../src/lib/er/types";

const characters: CharacterMap = {
  12: { id: 12, key: "Hyejin", name: "慧珍", charArcheTypes: ["Mage", "None"], masteries: ["Bow"] },
  28: { id: 28, key: "Sua", name: "秀雅", charArcheTypes: ["Support", "Mage"], masteries: ["Hammer"] },
  50: { id: 50, key: "Elena", name: "埃琳娜", charArcheTypes: ["Tanker", "Warrior"], masteries: ["Rapier"] }
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
    killDetails: {},
    deathDetails: {},
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
    expect(summary.characters[0]).toMatchObject({ charArcheTypes: ["Mage", "None"], masteries: ["Bow"] });
  });

  it("summarizes most killed and most killed-by characters", () => {
    const summary = summarizePlayer(
      sample("A", [
        match({ killDetails: { 50: 2, 12: 1 }, deathDetails: { 28: 1 } }),
        match({ gameId: 2, killDetails: { 50: 1 }, deathDetails: { 28: 2, 12: 1 } })
      ]),
      characters
    );

    expect(summary.matchups.mostKilled).toEqual([
      { characterNum: 50, name: "埃琳娜", count: 3 },
      { characterNum: 12, name: "慧珍", count: 1 }
    ]);
    expect(summary.matchups.mostKilledBy).toEqual([
      { characterNum: 28, name: "秀雅", count: 3 },
      { characterNum: 12, name: "慧珍", count: 1 }
    ]);
  });

  it("marks fragile marksman samples as low-value carry play", () => {
    const summary = summarizePlayer(
      sample("UncleJoke", [
        match({
          characterNum: 31,
          playerKill: 3,
          playerAssistant: 4,
          playerDeaths: 3,
          damageToPlayer: 14500,
          damageFromPlayer: 9000,
          viewContribution: 8,
          ccTimeToPlayer: 8,
          deathDetails: { 53: 1 }
        }),
        match({
          gameId: 2,
          characterNum: 31,
          playerKill: 4,
          playerAssistant: 3,
          playerDeaths: 3,
          damageToPlayer: 15000,
          damageFromPlayer: 10000,
          viewContribution: 10,
          ccTimeToPlayer: 10,
          deathDetails: { 53: 1 }
        })
      ]),
      {
        ...characters,
        31: { id: 31, key: "Rio", name: "莉央", charArcheTypes: ["Marksman", "None"], masteries: ["Bow"] },
        53: { id: 53, key: "Markus", name: "马库斯", charArcheTypes: ["Tanker", "Warrior"], masteries: ["Axe"] }
      }
    );

    expect(summary.roleProfile.primaryRole).toBe("carry");
    expect(summary.evaluation.tier).toBe("low");
    expect(summary.evaluation.riskFlags).toEqual(
      expect.arrayContaining(["输出位死亡过高", "输出位控制/视野贡献偏低", "疑似站桩平A型输出"])
    );
    expect(summary.evaluation.coachingFocus.some((item) => item.includes("低价值输出位"))).toBe(true);
  });

  it("summarizes shared matches and compares role tendencies", () => {
    const shared: SharedMatchResult = {
      confidence: "high",
      matches: [
        {
          gameId: 10,
          startDtm: "2026-08-14T00:00:00.000+0900",
          teamNumber: 1,
          usedFallback: false,
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
          usedFallback: true,
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

  it("keeps team metrics from reliable same-team matches when another shared match used fallback", () => {
    const shared: SharedMatchResult = {
      confidence: "low",
      matches: [
        {
          gameId: 21,
          startDtm: "2026-08-14T00:00:00.000+0900",
          teamNumber: 2,
          usedFallback: false,
          participants: [
            match({ nickname: "A", gameId: 21, teamNumber: 2, gameRank: 1, teamKill: 11 }),
            match({ nickname: "B", gameId: 21, teamNumber: 2, gameRank: 1, teamKill: 11 })
          ]
        },
        {
          gameId: 22,
          startDtm: "2026-08-14T00:01:00.000+0900",
          teamNumber: 2,
          usedFallback: false,
          participants: [
            match({ nickname: "A", gameId: 22, teamNumber: 2, gameRank: 3, teamKill: 5 }),
            match({ nickname: "B", gameId: 22, teamNumber: 2, gameRank: 3, teamKill: 5 })
          ]
        },
        {
          gameId: 23,
          startDtm: "2026-08-14T00:02:00.000+0900",
          usedFallback: true,
          participants: [
            match({ nickname: "A", gameId: 23, teamNumber: undefined, gameRank: 1, teamKill: 18 }),
            match({ nickname: "B", gameId: 23, teamNumber: 8, gameRank: 7, teamKill: 3 })
          ]
        }
      ]
    };

    const sharedSummary = summarizeShared(shared, characters);

    expect(sharedSummary.matchCount).toBe(3);
    expect(sharedSummary.reliableMatchCount).toBe(2);
    expect(sharedSummary.confidence).toBe("low");
    expect(sharedSummary.teamMetricsReliable).toBe(true);
    expect(sharedSummary.avgRank).toBe(2);
    expect(sharedSummary.wins).toBe(1);
    expect(sharedSummary.avgTeamKill).toBe(8);
    expect(sharedSummary.matches.map((item) => item.teamMetricsReliable)).toEqual([true, true, false]);
    expect(sharedSummary.matches[2].rank).toBeNull();
  });

  it("handles empty shared participant lists without crashing", () => {
    const shared: SharedMatchResult = {
      confidence: "high",
      matches: [
        {
          gameId: 12,
          startDtm: "2026-08-14T00:00:00.000+0900",
          teamNumber: 1,
          usedFallback: false,
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
          usedFallback: false,
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
