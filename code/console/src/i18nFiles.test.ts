import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const consoleDir = resolve(__dirname, "..");
const publicFile = join(consoleDir, "public", "i18n.json");

const languages = ["en", "de", "sw", "es", "fr", "zh"];

const unitsThatStay = ["title", "models.testMs", "models.metaProvider", "models.metaBrand"];
const cognateLanguages = ["de", "es", "fr"];

const wordsOf = (text: string) => text.replace(/\{[^}]*\}/g, "").split(/\s+/).filter((word) => /\p{L}/u.test(word));

const tables: Record<string, Record<string, string>> = JSON.parse(readFileSync(publicFile, "utf8"));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [path] : [];
  });

const literalKeys = (source: string) =>
  [...source.matchAll(/\bt\(\s*(?:"([^"\\]*)"|'([^'\\]*)'|`([^`$\\]*)`)\s*[,)]/g)].map((m) => m[1] ?? m[2] ?? m[3]);

describe("the translation table the bundle serves", () => {
  it("comes in the six languages", () => {
    expect(Object.keys(tables)).toEqual(languages);
  });

  it("has every English key in every language, written out", () => {
    for (const lang of languages)
      for (const key of Object.keys(tables.en)) expect((tables[lang][key] ?? "").trim(), `${lang} ${key}`).not.toBe("");
  });

  it("has no value left in English, except names and one-word cognates in German, Spanish and French", () => {
    for (const lang of languages.filter((l) => l !== "en"))
      for (const key of Object.keys(tables.en)) {
        if (unitsThatStay.includes(key) || tables[lang][key] !== tables.en[key]) continue;
        const oneWordCognate = cognateLanguages.includes(lang) && wordsOf(tables.en[key]).length <= 1;
        expect(oneWordCognate, `${lang} ${key} still reads: ${tables.en[key]}`).toBe(true);
      }
  });

  it("has no key in another language that English lacks", () => {
    for (const lang of languages) for (const key of Object.keys(tables[lang])) expect(tables.en, `${lang} ${key}`).toHaveProperty(key);
  });

  it("has every key the console source asks for with a literal", () => {
    const asked = sourceFiles(join(consoleDir, "src")).flatMap((file) => literalKeys(readFileSync(file, "utf8")).map((key) => ({ file, key })));
    expect(asked.length).toBeGreaterThan(0);
    for (const { file, key } of asked) for (const lang of languages) expect(tables[lang], `${file} asks for ${key} in ${lang}`).toHaveProperty(key);
  });

  it("has the words create-hub shows by key", () => {
    for (const key of ["hubNameRequired", "createNoService", "createNoTemplate", "createNoRole", "createNotLinked", "createNoRooms"])
      for (const lang of languages) expect(tables[lang][key], `${lang} ${key}`).toBeTruthy();
  });

  it("is translated, not copied from English, for the sentences create-hub shows", () => {
    for (const lang of ["de", "sw", "es", "fr", "zh"])
      for (const key of ["hubNameRequired", "createNoService", "createNoRole", "createNotLinked", "createNoRooms"])
        expect(tables[lang][key], `${lang} ${key}`).not.toBe(tables.en[key]);
  });
});
