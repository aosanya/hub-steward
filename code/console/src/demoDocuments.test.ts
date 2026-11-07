import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const labDir = resolve(__dirname, "..", "..", "..", "demo", "siaya-lab");
const templateFile = resolve(__dirname, "..", "public", "templates", "siaya-lab.json");
const documentNames = ["booking-rules.md", "house-rules.md", "opening-hours.md", "wifi-guide.md"];
const languages = ["en", "sw", "de", "hu"];

const read = (language: string, name: string) => readFileSync(join(labDir, language, name), "utf8");

describe("the lab's documents", () => {
  it.each(languages)("has the same four documents in %s", (language) => {
    expect(readdirSync(join(labDir, language)).sort()).toEqual(documentNames);
  });

  it.each(documentNames)("keeps the same sections in %s for Hungarian as for English", (name) => {
    const headings = (text: string) => text.split("\n").filter((line) => line.startsWith("#")).length;
    expect(headings(read("hu", name))).toBe(headings(read("en", name)));
  });

  it("writes the Hungarian documents in Hungarian", () => {
    expect(read("hu", "house-rules.md")).toMatch(/^# Házirend/);
    expect(read("hu", "booking-rules.md")).toMatch(/^# Foglalási szabályok/);
    expect(read("hu", "opening-hours.md")).toMatch(/^# Nyitvatartás/);
    expect(read("hu", "wifi-guide.md")).toMatch(/^# Wifi-útmutató/);
  });

  it("links every Hungarian document from the lab's README", () => {
    const readme = readFileSync(join(labDir, "README.md"), "utf8");
    for (const name of documentNames) expect(readme).toContain(`(hu/${name})`);
    expect(existsSync(join(labDir, "hu"))).toBe(true);
  });

  it("names Hungarian as an answer language of the agent in both copies of the template", () => {
    for (const file of [join(labDir, "agency.json"), templateFile]) {
      expect(readFileSync(file, "utf8")).toContain("English, Swahili, German or Hungarian");
    }
  });
});
