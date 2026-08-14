import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzePlayers, validateAnalyzeRequest } from "../../src/lib/server/analyze";
import type { DakggMatch, PlayerMatchSample } from "../../src/lib/er/types";
import { fetchCharacters, fetchCurrentSeason, fetchPlayerSample } from "../../src/lib/server/dakgg";
import { requestDeepSeekReview } from "../../src/lib/server/deepseek";
import { onRequestPost } from "../../functions/api/analyze";

vi.mock("../../src/lib/server/dakgg", () => ({
  fetchCharacters: vi.fn(),
  fetchCurrentSeason: vi.fn(),
  fetchPlayerSample: vi.fn()
}));

vi.mock("../../src/lib/server/deepseek", () => ({
  requestDeepSeekReview: vi.fn()
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("analyze request validation", () => {
  it("accepts 1 to 3 non-empty nicknames and trims them", () => {
    expect(validateAnalyzeRequest({ players: [" A ", "B"] })).toEqual(["A", "B"]);
  });

  it("rejects empty or too many players", () => {
    expect(() => validateAnalyzeRequest({ players: [] })).toThrow("请输入 1-3 个昵称");
    expect(() => validateAnalyzeRequest({ players: ["A", "B", "C", "D"] })).toThrow("请输入 1-3 个昵称");
  });

  it("rejects non-string player entries instead of coercing them", () => {
    expect(() => validateAnalyzeRequest({ players: ["A", 123] })).toThrow("请输入 1-3 个昵称");
    expect(() => validateAnalyzeRequest({ players: [null] })).toThrow("请输入 1-3 个昵称");
    expect(() => validateAnalyzeRequest({ players: [{ nickname: "A" }] })).toThrow("请输入 1-3 个昵称");
  });
});

describe("analyze Pages function", () => {
  it("returns a controlled 400 for invalid JSON bodies", async () => {
    const response = await onRequestPost({
      request: new Request("https://example.test/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: ""
      }),
      env: {}
    } as EventContext<Record<string, unknown>, string, Record<string, unknown>>);

    await expect(response.json()).resolves.toEqual({ error: "请求体必须是有效 JSON。" });
    expect(response.status).toBe(400);
  });
});

describe("analyze orchestration", () => {
  it("returns successful players and per-player errors when one DAKGG lookup fails", async () => {
    vi.mocked(fetchCurrentSeason).mockResolvedValue({ key: "SEASON_21", name: "赛季 S12" });
    vi.mocked(fetchCharacters).mockResolvedValue({
      1: { id: 1, key: "Aya", name: "阿雅" }
    });
    vi.mocked(fetchPlayerSample).mockImplementation(async (_fetcher, nickname) => {
      if (nickname === "Missing") throw new Error("matches Missing status 404 raw upstream detail");
      return buildSample(nickname);
    });
    vi.mocked(requestDeepSeekReview).mockResolvedValue({ aiReview: "复盘" });

    const result = await analyzePlayers(fetch, { DEEPSEEK_API_KEY: "secret" }, { players: ["A", "Missing"] });

    expect(result.players.map((player) => player.nickname)).toEqual(["A"]);
    expect(result.playerErrors).toEqual([{ nickname: "Missing", message: "无法获取该玩家近期对局，请检查昵称或稍后重试。" }]);
    expect(result.shared).toMatchObject({ matchCount: 0, confidence: "high", reliableMatchCount: 0 });
    expect(result.comparison.damageLeader).toBeNull();

    const payload = vi.mocked(requestDeepSeekReview).mock.calls[0][2] as {
      playerErrors?: Array<{ nickname?: string; message?: string }>;
    };
    expect(payload.playerErrors).toEqual(result.playerErrors);
    expect(JSON.stringify(payload)).not.toContain("raw upstream detail");
  });

  it("sends at most 12 compact shared matches with participant context to DeepSeek", async () => {
    vi.mocked(fetchCurrentSeason).mockResolvedValue({ key: "SEASON_21", name: "赛季 S12" });
    vi.mocked(fetchCharacters).mockResolvedValue({
      1: { id: 1, key: "Aya", name: "阿雅" },
      2: { id: 2, key: "Jackie", name: "杰琪" }
    });
    vi.mocked(fetchPlayerSample).mockImplementation(async (_fetcher, nickname) => buildSample(nickname));
    vi.mocked(requestDeepSeekReview).mockResolvedValue({ aiReview: "复盘" });

    await analyzePlayers(fetch, { DEEPSEEK_API_KEY: "secret" }, { players: ["A", "B"] });

    const payload = vi.mocked(requestDeepSeekReview).mock.calls[0][2] as {
      shared?: {
        matches?: Array<Record<string, unknown>>;
      };
    };
    expect(payload.shared?.matches).toHaveLength(12);
    expect(payload.shared?.matches?.[0]).toEqual({
      gameId: 1,
      startDtm: "2026-08-14T00:01:00.000+0900",
      mode: "排位",
      rank: 1,
      teamNumber: 7,
      teamMetricsReliable: true,
      participants: [
        {
          nickname: "A",
          characterNum: 1,
          characterName: "阿雅",
          kills: 2,
          assists: 3,
          deaths: 1,
          damageToPlayer: 1000,
          damageFromPlayer: 400,
          viewContribution: 10,
          monsterKill: 5,
          ccTimeToPlayer: 2
        },
        {
          nickname: "B",
          characterNum: 2,
          characterName: "杰琪",
          kills: 2,
          assists: 3,
          deaths: 1,
          damageToPlayer: 1000,
          damageFromPlayer: 400,
          viewContribution: 10,
          monsterKill: 5,
          ccTimeToPlayer: 2
        }
      ]
    });
    expect(JSON.stringify(payload)).not.toContain("routeIdOfStart");
    expect(JSON.stringify(payload)).not.toContain("equipment");
    expect(JSON.stringify(payload)).not.toContain("skillOrderInfo");
  });
});

function buildSample(nickname: string): PlayerMatchSample {
  const characterNum = nickname === "A" ? 1 : 2;
  const matches = Array.from({ length: 15 }, (_, index): DakggMatch & Record<string, unknown> => ({
    gameId: index + 1,
    nickname,
    startDtm: `2026-08-14T00:${String(index + 1).padStart(2, "0")}:00.000+0900`,
    matchingMode: 3,
    teamNumber: 7,
    gameRank: index + 1,
    characterNum,
    playerKill: 2,
    playerAssistant: 3,
    playerDeaths: 1,
    teamKill: 6,
    damageToPlayer: 1000,
    damageFromPlayer: 400,
    damageToMonster: 700,
    monsterKill: 5,
    viewContribution: 10,
    ccTimeToPlayer: 2,
    routeIdOfStart: 99,
    equipment: ["raw equipment"],
    skillOrderInfo: { first: "raw skill" }
  }));

  return {
    nickname,
    matches,
    sampleCount: matches.length,
    excludedCobaltCount: 0,
    exhaustedPages: false
  };
}
