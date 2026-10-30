import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sheet = (name: string) => readFileSync(resolve(__dirname, name), "utf8");

const orderOf = (css: string, selector: string): number => {
  const rule = css.split("\n").find((line) => line.startsWith(selector + "{"));
  return Number(rule?.match(/order:(-?\d+)/)?.[1] ?? 0);
};

describe("the order down the content area", () => {
  it("puts the tab strip before the page header, and the header before the publish bar", () => {
    const design = sheet("../design.css");
    const draft = sheet("../ui/draftBar.css");

    const tabs = orderOf(design, ".review-tabs");
    const header = orderOf(draft, ".app.console .main>.top");
    const publish = orderOf(draft, ".content.draft-slot");

    expect(tabs).toBeLessThan(header);
    expect(header).toBeLessThan(publish);
  });
});
