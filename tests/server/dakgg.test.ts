import { describe, expect, it } from "vitest";
import { fetchCharacters, fetchCurrentSeason, fetchPlayerSample, normalizeMatch } from "../../src/lib/server/dakgg";

describe("DAKGG client helpers", () => {
  it("selects current season and falls back when missing", async () => {
    const fetcher = async () =>
      Response.json({
        seasons: [
          { key: "SEASON_20", name: "赛季 S11" },
          { key: "SEASON_21", name: "赛季 S12", isCurrent: true }
        ]
      });

    await expect(fetchCurrentSeason(fetcher, { DEFAULT_SEASON: "SEASON_20" })).resolves.toEqual({
      key: "SEASON_21",
      name: "赛季 S12"
    });
  });

  it("normalizes character payload", async () => {
    const fetcher = async () =>
      Response.json({
        characters: [
          { id: 12, key: "Hyejin", name: "慧珍" },
          { id: 50, key: "Elena", name: "埃琳娜" }
        ]
      });

    const characters = await fetchCharacters(fetcher);
    expect(characters[12].name).toBe("慧珍");
    expect(characters[50].key).toBe("Elena");
  });

  it("normalizes match nickname from request context", () => {
    const normalized = normalizeMatch("Ptlantern", {
      gameId: 1,
      startDtm: "2026-08-14T00:00:00.000+0900",
      matchingMode: 3,
      teamNumber: 2,
      gameRank: 1,
      characterNum: 12,
      playerKill: 2,
      killDetails: "{\"50\":2,\"12\":1}",
      deathDetails: "{\"28\":1}"
    });

    expect(normalized.nickname).toBe("Ptlantern");
    expect(normalized.playerKill).toBe(2);
    expect(normalized.killDetails).toEqual({ 12: 1, 50: 2 });
    expect(normalized.deathDetails).toEqual({ 28: 1 });
  });

  it("fetches a non-Cobalt player sample across pages", async () => {
    const requestedUrls: string[] = [];
    const fetcher = async (url: string | URL | Request) => {
      requestedUrls.push(String(url));
      if (requestedUrls.length === 1) {
        return Response.json({
          matches: [
            {
              gameId: 1,
              startDtm: "2026-08-14T00:00:00.000+0900",
              matchingMode: 6,
              matchingTeamMode: 4,
              teamNumber: 2,
              gameRank: 1,
              characterNum: 12
            },
            {
              gameId: 2,
              startDtm: "2026-08-14T00:10:00.000+0900",
              matchingMode: 3,
              matchingTeamMode: 3,
              teamNumber: 2,
              gameRank: 2,
              characterNum: 50
            }
          ]
        });
      }
      return Response.json({ matches: [] });
    };

    const sample = await fetchPlayerSample(fetcher, "Pt lantern", "SEASON_21");

    expect(requestedUrls[0]).toContain("/players/Pt%20lantern/matches?");
    expect(requestedUrls[0]).toContain("season=SEASON_21");
    expect(sample.nickname).toBe("Pt lantern");
    expect(sample.matches.map((match) => match.gameId)).toEqual([2]);
    expect(sample.excludedCobaltCount).toBe(1);
    expect(sample.exhaustedPages).toBe(true);
  });
});
