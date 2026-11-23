import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname);
const studioCss = resolve(srcDir, "..", "..", "..", "documentation", "2. design", "mockups", "console", "studio.css");

const read = (file: string) => readFileSync(file, "utf8");

const ruleFor = (css: string, selector: string) => {
  const line = css.split("\n").find((text) => text.startsWith(selector + "{"));
  return line ?? "";
};

const token = (css: string, name: string) => new RegExp(`:root\\{[^}]*${name}:([^;}]+)`).exec(css)?.[1];

describe.each([
  ["the console stylesheet", join(srcDir, "design.css")],
  ["the mockups stylesheet", studioCss],
])("the page header and the chat head in %s", (_name, file) => {
  const css = read(file);

  it("take one height from --head-h so the line under each is one straight line", () => {
    expect(ruleFor(css, ".top")).toMatch(/height:var\(--head-h\)/);
    expect(ruleFor(css, ".chat-head")).toMatch(/height:var\(--head-h\)/);
  });

  it("do not pad themselves to a height of their own", () => {
    expect(ruleFor(css, ".top")).not.toMatch(/padding:\d+px/);
    expect(ruleFor(css, ".chat-head")).not.toMatch(/padding:\d+px/);
  });

  it("share the title size and weight of the page title and the chat title", () => {
    expect(ruleFor(css, ".top h1,.chat-label")).toMatch(/font-size:var\(--head-title-size\)[^}]*font-weight:700|font-weight:700[^}]*font-size:var\(--head-title-size\)/);
  });

  it("share the height, padding, radius and font of the Actions button and the chat context tag", () => {
    expect(ruleFor(css, ".chat-ctx,.top .actions>.btn")).toMatch(/min-height:var\(--head-chip-h\).*padding:0 12px.*border-radius:999px.*font-size:\.8125rem/);
  });
});

describe("the head tokens", () => {
  it("are the same in the console and in the mockups", () => {
    const consoleCss = read(join(srcDir, "design.css"));
    const mockupCss = read(studioCss);
    for (const name of ["--head-h", "--head-title-size", "--head-chip-h"]) {
      expect(token(consoleCss, name), name).toBeDefined();
      expect(token(consoleCss, name), name).toBe(token(mockupCss, name));
    }
  });
});

describe("the chat head", () => {
  it("names its title with the class that shares the page title's size", () => {
    expect(read(join(srcDir, "shell", "ChatColumn.tsx"))).toContain('className="chat-label"');
  });
});
