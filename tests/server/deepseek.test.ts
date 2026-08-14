import { describe, expect, it, vi } from "vitest";
import { buildDeepSeekMessages, requestDeepSeekReview } from "../../src/lib/server/deepseek";

const payload = {
  season: { key: "SEASON_21", name: "赛季 S12" },
  players: [{ nickname: "A", sampleCount: 20 }],
  shared: { matchCount: 2, confidence: "high" },
  comparison: { roleNotes: ["A 主要输出"] }
};

describe("DeepSeek client", () => {
  it("builds Chinese coaching messages with sample constraints", () => {
    const messages = buildDeepSeekMessages(payload);
    expect(messages[0].content).toContain("中文");
    expect(messages[0].content).toContain("不要评价钴协议");
    expect(messages[0].content).toContain("坦克");
    expect(messages[0].content).toContain("输出位死亡");
    expect(messages[0].content).toContain("单人分析");
    expect(messages[0].content).toContain("可以刻薄");
    expect(messages[0].content).toContain("站桩平A");
    expect(messages[0].content).toContain("不要做人身辱骂");
    expect(messages[1].content).toContain("SEASON_21");
  });

  it("projects analysis payloads before serializing prompt messages", () => {
    const messages = buildDeepSeekMessages({
      ...payload,
      routeIdOfStart: 99,
      equipment: ["raw equipment"],
      skillOrderInfo: { first: "raw skill" },
      matches: [{ gameId: 1, routeIdOfStart: 77 }],
      rawMatches: [{ equipment: ["raw"] }],
      players: [
        {
          nickname: "A",
          sampleCount: 20,
          matchups: {
            mostKilled: [{ characterNum: 50, name: "埃琳娜", count: 3 }],
            mostKilledBy: [{ characterNum: 28, name: "秀雅", count: 2 }]
          },
          characters: [
            {
              characterNum: 31,
              name: "莉央",
              games: 5,
              charArcheTypes: ["Marksman", "None"],
              masteries: ["Bow"]
            }
          ],
          equipment: ["raw equipment"],
          skillOrderInfo: { first: "raw skill" },
          matches: [{ routeIdOfStart: 77 }]
        }
      ],
      playerErrors: [
        {
          nickname: "Missing",
          message: "无法获取该玩家近期对局，请检查昵称或稍后重试。",
          stack: "raw stack",
          cause: { status: 404 }
        }
      ],
      shared: {
        matchCount: 2,
        confidence: "high",
        reliableMatchCount: 1,
        matches: [
          {
            gameId: 1,
            startDtm: "2026-08-14T00:00:00.000+0900",
            rank: 1,
            equipment: ["raw"],
            participants: [{ nickname: "A", damageToPlayer: 1000, equipment: ["raw"] }]
          }
        ]
      }
    });
    const userContent = messages[1].content;

    expect(userContent).toContain("SEASON_21");
    expect(userContent).toContain("sampleCount");
    expect(userContent).toContain("playerErrors");
    expect(userContent).toContain("reliableMatchCount");
    expect(userContent).toContain("mostKilled");
    expect(userContent).toContain("mostKilledBy");
    expect(userContent).toContain("埃琳娜");
    expect(userContent).toContain("秀雅");
    expect(userContent).toContain("Marksman");
    expect(userContent).toContain("Bow");
    expect(userContent).toContain("matches");
    expect(userContent).toContain("damageToPlayer");
    expect(userContent).not.toContain("routeIdOfStart");
    expect(userContent).not.toContain("equipment");
    expect(userContent).not.toContain("skillOrderInfo");
    expect(userContent).not.toContain("rawMatches");
    expect(userContent).not.toContain("raw stack");
    expect(userContent).not.toContain("cause");
  });

  it("returns empty review when API key is missing", async () => {
    const fetcher = vi.fn<typeof fetch>();

    const review = await requestDeepSeekReview(fetcher, {}, payload);

    expect(review).toEqual({ aiReview: "", warning: "未配置 DeepSeek API Key，已仅返回规则指标。" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("constructs authorized DeepSeek requests and returns trimmed content", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "  复盘内容  " } }] }), { status: 200 })
    );

    const review = await requestDeepSeekReview(fetcher, { DEEPSEEK_API_KEY: "secret", DEEPSEEK_BASE_URL: "https://ds" }, payload);

    expect(review).toEqual({ aiReview: "复盘内容" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://ds/chat/completions");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer secret"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "deepseek-chat",
      temperature: 0.4,
      messages: expect.any(Array)
    });
  });

  it("returns a warning and empty review for non-OK responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("busy", { status: 503 }));

    const review = await requestDeepSeekReview(fetcher, { DEEPSEEK_API_KEY: "secret" }, payload);

    expect(review).toEqual({ aiReview: "", warning: "DeepSeek 暂不可用，已仅返回规则指标。状态码：503" });
  });

  it("returns a warning and empty review when the response shape is malformed", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 123 } }] }), { status: 200 })
    );

    const review = await requestDeepSeekReview(fetcher, { DEEPSEEK_API_KEY: "secret" }, payload);

    expect(review).toEqual({ aiReview: "", warning: "DeepSeek 返回内容为空或格式异常，已仅返回规则指标。" });
  });

  it("returns a warning and empty review when fetch rejects", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));

    const review = await requestDeepSeekReview(fetcher, { DEEPSEEK_API_KEY: "secret" }, payload);

    expect(review).toEqual({ aiReview: "", warning: "DeepSeek 请求失败，已仅返回规则指标。" });
  });

  it("returns a warning and empty review when response JSON parsing fails", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("not json", { status: 200 }));

    const review = await requestDeepSeekReview(fetcher, { DEEPSEEK_API_KEY: "secret" }, payload);

    expect(review).toEqual({ aiReview: "", warning: "DeepSeek 返回内容解析失败，已仅返回规则指标。" });
  });
});
