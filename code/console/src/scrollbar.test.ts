import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname);
const designCss = join(srcDir, "design.css");
const studioCss = resolve(srcDir, "..", "..", "..", "documentation", "2. design", "mockups", "console", "studio.css");

const read = (file: string) => readFileSync(file, "utf8");

const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });

const scrollbarRules = (css: string) => css.split("\n").filter((line) => line.includes("scrollbar"));

describe.each([
  ["the console stylesheet", designCss],
  ["the mockups stylesheet", studioCss],
])("%s", (_name, file) => {
  const css = read(file);

  it("sets a thin Firefox scrollbar coloured from two tokens with a transparent track", () => {
    expect(css).toMatch(/scrollbar-width:thin/);
    expect(css).toMatch(/scrollbar-color:var\(--line\) transparent/);
    expect(css).toMatch(/:hover\{scrollbar-color:var\(--line2\) transparent\}/);
  });

  it("sets a 0.5rem webkit scrollbar with a transparent track and a rounded thumb", () => {
    expect(css).toMatch(/::-webkit-scrollbar\{[^}]*width:\.5rem[^}]*height:\.5rem/);
    expect(css).toMatch(/::-webkit-scrollbar-track[^{]*\{[^}]*background:transparent/);
    expect(css).toMatch(/::-webkit-scrollbar-thumb\{[^}]*border-radius:\.25rem[^}]*background:var\(--line\)/);
  });

  it("shows the thumb only as the container is hovered and darkens it under the pointer", () => {
    expect(css).toMatch(/:hover::-webkit-scrollbar-thumb\{[^}]*background:var\(--line2\)/);
    expect(css).toMatch(/::-webkit-scrollbar-thumb:hover\{[^}]*background:var\(--text4\)/);
  });

  it("uses no pixel sizes and no colour outside the theme tokens in its scrollbar rules", () => {
    const rules = scrollbarRules(css).join("\n");
    expect(rules).not.toMatch(/\d+px/);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});

describe("the two stylesheets", () => {
  it("carry the same scrollbar rules", () => {
    expect(scrollbarRules(read(studioCss))).toEqual(scrollbarRules(read(designCss)));
  });
});

describe("the console's other stylesheets", () => {
  it("keep no scrollbar rule of their own", () => {
    const others = cssFiles(srcDir).filter((file) => file !== designCss);
    const offenders = others.filter((file) => read(file).includes("scrollbar"));
    expect(offenders).toEqual([]);
  });
});
