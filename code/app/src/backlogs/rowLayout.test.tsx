import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "backlogs.css"), "utf8");

describe("the wide row layout of an issue", () => {
  it("applies to rows in a list only, so a board card keeps its own column and does not grow to the row's 24rem basis", () => {
    const rules = css.split("\n").filter((line) => line.includes("flex: 1 1 24rem") || line.includes("flex-wrap: wrap; align-items: baseline"));
    expect(rules.length).toBe(2);
    rules.forEach((rule) => expect(rule.trimStart().startsWith(".rows .issue-row")).toBe(true));
  });
});
