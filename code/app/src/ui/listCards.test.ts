import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rules = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8").split("\n");
const ruleFor = (selector: string) => rules.find((line) => line.startsWith(`${selector} {`)) ?? "";

describe("lists drawn as separate cards", () => {
  it("keeps the rows of a list on the page apart with a gap and no frame of their own", () => {
    const rule = ruleFor(".body > .rows");
    expect(rule).toContain("gap: .75rem");
    expect(rule).toContain("overflow: visible");
    expect(rule).toContain("background: transparent");
    expect(rule).toContain("border: 0");
  });

  it("gives each row and each selectable row of a page list a card of its own", () => {
    const rule = ruleFor(".body > .rows > .row, .body > .rows > .selrow");
    expect(rule).toContain("border: 1px solid var(--line)");
    expect(rule).toContain("border-radius: var(--r-md)");
    expect(rule).toContain("background: var(--surface)");
  });

  it("keeps the inner row of a selectable row free of a second card", () => {
    const rule = ruleFor(".body > .rows > .selrow > .row");
    expect(rule).toContain("border: 0");
    expect(rule).toContain("box-shadow: none");
  });

  it("leaves rows inside a card of their own grouped under one frame", () => {
    const rule = ruleFor(".rows");
    expect(rule).toContain("border: 1px solid var(--line)");
    expect(rule).not.toContain("gap:");
  });
});
