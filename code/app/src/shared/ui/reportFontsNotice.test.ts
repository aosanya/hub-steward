import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const folder = join(__dirname, "reportFonts");

const notice = existsSync(join(folder, "OFL.txt")) ? readFileSync(join(folder, "OFL.txt"), "utf8") : "";

describe("The embedded report fonts carry their licence", () => {
  it("keeps the OFL notice next to the font files", () => {
    expect(existsSync(join(folder, "OFL.txt"))).toBe(true);
  });

  it("opens with the copyright line the fonts carry in their name table", () => {
    expect(notice.startsWith("Copyright 2015-2021 Google LLC. All Rights Reserved.")).toBe(true);
  });

  it("holds the licence text", () => {
    expect(notice).toContain("SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007");
    expect(notice).toContain("PERMISSION & CONDITIONS");
  });

  it("says the embedded files are subsets and names both of them", () => {
    expect(notice).toContain("notoSansRegular.ts");
    expect(notice).toContain("notoSansBold.ts");
    expect(notice).toContain("subset");
  });
});
