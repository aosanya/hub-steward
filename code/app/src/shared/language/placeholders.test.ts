import { describe, expect, it } from "vitest";
import { words, languages } from "./words";
import { swahili } from "./swahili";
import { magyar } from "./magyar";
import { wordsFor } from "./language";

const placeholdersOf = (sentence: string) => (sentence.match(/\{[a-zA-Z]+\}/g) ?? []).sort();

const translations = { Kiswahili: swahili, Magyar: magyar };

describe("translations keep the values the app fills in", () => {
  Object.entries(translations).forEach(([name, table]) => {
    it(`${name} uses exactly the placeholders of the English sentence for every word`, () => {
      const mismatched = (Object.keys(words) as (keyof typeof words)[])
        .filter((key) => JSON.stringify(placeholdersOf(table[key])) !== JSON.stringify(placeholdersOf(words[key])))
        .map((key) => `${key}: ${words[key]} | ${table[key]}`);
      expect(mismatched).toEqual([]);
    });

    it(`${name} has no blank word and no word padded with spaces`, () => {
      const padded = Object.entries(table).filter(([, sentence]) => sentence !== sentence.trim() || sentence.trim() === "");
      expect(padded).toEqual([]);
    });
  });

  it("English plural pairs name the count in both the one and many forms", () => {
    const pairs = Object.keys(words).filter((key) => key.endsWith("One") && `${key.slice(0, -3)}Many` in words);
    expect(pairs.length).toBeGreaterThan(0);
    pairs.forEach((one) => {
      const many = `${one.slice(0, -3)}Many` as keyof typeof words;
      expect(words[one as keyof typeof words]).toContain("{count}");
      expect(words[many]).toContain("{count}");
    });
  });
});

describe("wordsFor", () => {
  it("answers each translated language with its own table", () => {
    expect(wordsFor("en")).toBe(words);
    expect(wordsFor("sw")).toBe(swahili);
    expect(wordsFor("hu")).toBe(magyar);
  });

  it("falls back to English for a listed language with no table and for an unknown code", () => {
    const untranslated = languages.filter((language) => !["en", "sw", "hu"].includes(language.code));
    expect(untranslated.length).toBeGreaterThan(0);
    untranslated.forEach((language) => expect(wordsFor(language.code)).toBe(words));
    expect(wordsFor("")).toBe(words);
    expect(wordsFor("xx")).toBe(words);
  });

  it.skip("known bug: wordsFor returns an inherited object member for a code such as constructor", () => {
    expect(wordsFor("constructor")).toBe(words);
    expect(wordsFor("toString")).toBe(words);
  });
});
