import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = readdirSync(__dirname).filter((name) => /\.tsx?$/.test(name) && name !== "bookClean.test.ts");

const textOf = (name: string) => readFileSync(join(__dirname, name), "utf8");

const importsOf = (text: string) => [
  ...[...text.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]),
  ...[...text.matchAll(/\bimport\s*["']([^"']+)["']/g)].map((match) => match[1]),
  ...[...text.matchAll(/\bimport\s*\(\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]),
  ...[...text.matchAll(/\brequire\s*\(\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]),
];

const toolPrefix = /["'`](taskmanager|agency|forms|comm|actor|custody|insights|accounting|assetmanager|digitaltwin|git|auth)_[a-z$]/;

const builtToolName = /\b(callTool|callToolText|tool)\s*\(\s*(`[^`]*\$\{|[^"'`)\s,][^),]*\+\s*["'`]|["'`][^"'`]*["'`]\s*\+)/;

const namesTool = (text: string) => toolPrefix.test(text) || builtToolName.test(text);

const reachesNotes = (text: string) => importsOf(text).some((target) => /(^|\/)notes(\/|$)/.test(target)) || /\bexport\s+(\*|\{[^}]*\})\s*(as\s+\w+\s*)?from\s*["'][^"']*notes/.test(text);

describe("the Book folder", () => {
  it("holds source files to look at", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("imports nothing from the notes of the rulebook", () => {
    const found = files.filter((name) => reachesNotes(textOf(name)));
    expect(found).toEqual([]);
  });

  it("reaches the rulebook only through its public exports", () => {
    const found = files.flatMap((name) => importsOf(textOf(name)).filter((target) => /rulebook\/./.test(target)).map((target) => `${name} -> ${target}`));
    expect(found).toEqual([]);
  });

  it("holds no tool name of its own", () => {
    expect(files.filter((name) => namesTool(textOf(name)))).toEqual([]);
  });

  it("mentions no note, marker or chip of the rulebook", () => {
    const found = files.filter((name) => /\b(notes?Client|OpenContradiction|RuleMarks|StatusChips)\b/.test(textOf(name)));
    expect(found).toEqual([]);
  });

  it("does not let the rulebook index hand out its notes", () => {
    const index = readFileSync(join(__dirname, "..", "rulebook", "index.ts"), "utf8");
    expect(reachesNotes(index)).toBe(false);
  });
});

describe("the guards of the Book folder", () => {
  it.each([
    ['import { notes } from "../rulebook/notes";'],
    ['import "../rulebook/notes";'],
    ['const lazy = await import("../rulebook/notes");'],
    ['const lazy = await import(`../rulebook/notes`);'],
    ['const lazy = require("../rulebook/notes");'],
    ['export * from "../rulebook/notes";'],
    ['export { notesOf } from "../rulebook/notes";'],
    ['export * as notes from "./notes";'],
  ])("sees the notes reached by %s", (text) => {
    expect(reachesNotes(text)).toBe(true);
  });

  it("lets the public rulebook import through", () => {
    expect(reachesNotes('import type { Rule } from "../rulebook";')).toBe(false);
  });

  it.each([
    ['callTool("taskmanager_rule_list")'],
    ["callTool('comm_send')"],
    ["const name = `agency_${verb}`;"],
    ['callTool(prefix + "_list")'],
    ['callTool("rule_" + verb)'],
    ["callTool(`${module}_list`)"],
    ['const name = "forms_form_get";'],
  ])("sees a tool name in %s", (text) => {
    expect(namesTool(text)).toBe(true);
  });

  it("lets plain words that only look like tool names through", () => {
    expect(namesTool('const label = "Came from";')).toBe(false);
    expect(namesTool("const git = 1; const author = authorOf(rule);")).toBe(false);
  });
});
