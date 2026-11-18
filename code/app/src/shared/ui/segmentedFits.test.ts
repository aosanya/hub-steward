import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "segmented.css"), "utf8");

const ruleOf = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};

describe("Segmented fits a narrow list pane", () => {
  it("wraps its buttons onto a second line instead of running off the pane edge", () => {
    expect(ruleOf(".seg")).toContain("flex-wrap: wrap");
  });

  it("lets each button size to its word and shrink below it, so none is clipped", () => {
    const button = ruleOf(".seg > button");
    expect(button).toContain("flex: 1 1 auto");
    expect(button).toContain("min-width: 0");
  });
});

describe("the section tab strip fits too", () => {
  const section = readFileSync(join(__dirname, "section.css"), "utf8");
  const sectionRule = (selector: string) => {
    const start = section.indexOf(`${selector} {`);
    return start < 0 ? "" : section.slice(start, section.indexOf("}", start));
  };

  it("wraps and never scrolls sideways, so the last tab is always seen", () => {
    expect(sectionRule(".sec-tabs")).toContain("flex-wrap: wrap");
    expect(sectionRule(".sec-tabs")).not.toContain("overflow-x");
  });

  it("lets each tab size to its word and shrink below it", () => {
    const tab = sectionRule(".sec-tabs > button");
    expect(tab).toContain("flex: 1 1 auto");
    expect(tab).toContain("min-width: 0");
  });
});
