import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "book.css"), "utf8");

const printBlock = css.slice(css.indexOf("@media print"));

describe("the Book styles", () => {
  it("sets no font size in pixels and no base size of its own", () => {
    expect(css).not.toMatch(/font-size:\s*[\d.]+px/);
    expect(css).not.toMatch(/font:\s*[^;]*\d+px/);
    expect(css).not.toMatch(/:root|html\s*\{/);
    for (const size of css.match(/font-size:\s*[^;]+/g) ?? []) expect(size).toMatch(/rem/);
  });

  it("holds the paper to one reading column of 40rem with room between lines", () => {
    expect(css).toMatch(/\.book\s*\{[^}]*max-width:\s*40rem/);
    expect(css).toMatch(/\.book\s*\{[^}]*line-height:\s*1\.6/);
  });

  it("hides the bar, the tab bar and the back link when printed", () => {
    expect(css).toContain("@media print");
    expect(printBlock).toMatch(/\.bar/);
    expect(printBlock).toMatch(/\.tabs/);
    expect(printBlock).toMatch(/\.back/);
    expect(printBlock).toMatch(/display:\s*none/);
  });

  it("gives the printed page a white background", () => {
    expect(printBlock).toMatch(/background:\s*#fff/);
  });
});
