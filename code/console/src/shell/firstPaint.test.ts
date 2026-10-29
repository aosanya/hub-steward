import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { themes } from "./theme";

const page = readFileSync(resolve(__dirname, "../../index.html"), "utf8");

const script = /<script>([\s\S]*?)<\/script>/.exec(page)?.[1] ?? "";

const paint = () => {
  document.documentElement.removeAttribute("data-theme");
  new Function(script)();
  return document.documentElement.dataset.theme;
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the theme before the first paint", () => {
  it("runs in the page head ahead of the app script", () => {
    expect(script).not.toBe("");
    expect(page.indexOf("<script>")).toBeLessThan(page.indexOf('src="/src/main.tsx"'));
  });

  it.each(themes.map((theme) => theme.key))("puts the stored %s theme on the root", (key) => {
    localStorage.setItem("theme", key);

    expect(paint()).toBe(key);
  });

  it("is dark when nothing is stored", () => {
    expect(paint()).toBe("dark");
  });

  it("is dark when the stored value is not one of the five", () => {
    localStorage.setItem("theme", "neon");

    expect(paint()).toBe("dark");
  });

  it("is dark when the browser refuses to read the storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(paint()).toBe("dark");
  });
});
