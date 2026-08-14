import { describe, expect, it } from "vitest";
import { validateAnalyzeRequest } from "../../src/lib/server/analyze";

describe("analyze request validation", () => {
  it("accepts 1 to 3 non-empty nicknames and trims them", () => {
    expect(validateAnalyzeRequest({ players: [" A ", "B"] })).toEqual(["A", "B"]);
  });

  it("rejects empty or too many players", () => {
    expect(() => validateAnalyzeRequest({ players: [] })).toThrow("请输入 1-3 个昵称");
    expect(() => validateAnalyzeRequest({ players: ["A", "B", "C", "D"] })).toThrow("请输入 1-3 个昵称");
  });
});
