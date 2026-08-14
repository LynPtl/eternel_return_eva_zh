import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../src/lib/ui/markdown";

describe("markdown renderer model", () => {
  it("parses headings, bullets, paragraphs, and tables", () => {
    const blocks = parseMarkdown(`# 总结

普通段落

| 玩家 | 问题 |
|------|------|
| UncleJoke | 莉央死亡过高 |

- 输出位死亡需要重罚
- 坦克不按输出苛责`);

    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "总结" },
      { type: "paragraph", text: "普通段落" },
      {
        type: "table",
        headers: ["玩家", "问题"],
        rows: [["UncleJoke", "莉央死亡过高"]]
      },
      {
        type: "list",
        items: ["输出位死亡需要重罚", "坦克不按输出苛责"]
      }
    ]);
  });

  it("keeps html-like text as plain paragraph content", () => {
    const blocks = parseMarkdown("<script>alert('xss')</script>");

    expect(blocks).toEqual([{ type: "paragraph", text: "<script>alert('xss')</script>" }]);
  });
});
