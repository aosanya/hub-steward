import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = readdirSync(__dirname).filter((name) => /\.tsx?$/.test(name) && name !== "bookClean.test.ts");

const importsOf = (text: string) => [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

describe("the Book folder", () => {
  it("holds source files to look at", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("imports nothing from the notes of the rulebook", () => {
    const found = files.flatMap((name) => importsOf(readFileSync(join(__dirname, name), "utf8")).filter((target) => /rulebook\/notes/.test(target)).map((target) => `${name} -> ${target}`));
    expect(found).toEqual([]);
  });

  it("reaches the rulebook only through its public exports", () => {
    const found = files.flatMap((name) => importsOf(readFileSync(join(__dirname, name), "utf8")).filter((target) => /rulebook\/./.test(target)).map((target) => `${name} -> ${target}`));
    expect(found).toEqual([]);
  });

  it("holds no tool name of its own", () => {
    const found = files.filter((name) => /["'`]taskmanager_|["'`]agency_|["'`]forms_/.test(readFileSync(join(__dirname, name), "utf8")));
    expect(found).toEqual([]);
  });

  it("mentions no note, marker or chip of the rulebook", () => {
    const found = files.filter((name) => /\b(notes?Client|OpenContradiction|RuleMarks|StatusChips)\b/.test(readFileSync(join(__dirname, name), "utf8")));
    expect(found).toEqual([]);
  });
});
