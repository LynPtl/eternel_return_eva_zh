import { describe, expect, it } from "vitest";
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
    expect(messages[1].content).toContain("SEASON_21");
  });

  it("returns empty review when API key is missing", async () => {
    const review = await requestDeepSeekReview(fetch, {}, payload);
    expect(review).toEqual({ aiReview: "", warning: "未配置 DeepSeek API Key，已仅返回规则指标。" });
  });
});
