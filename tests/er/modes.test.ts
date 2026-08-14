import { describe, expect, it } from "vitest";
import { isCobaltMode, modeLabel } from "../../src/lib/er/modes";

describe("mode utilities", () => {
  it("labels known modes", () => {
    expect(modeLabel(2)).toBe("普通");
    expect(modeLabel(3)).toBe("排位");
    expect(modeLabel(6)).toBe("钴协议");
    expect(modeLabel(99)).toBe("其他模式");
  });

  it("detects Cobalt Protocol", () => {
    expect(isCobaltMode(6)).toBe(true);
    expect(isCobaltMode(2)).toBe(false);
    expect(isCobaltMode(3)).toBe(false);
  });
});
