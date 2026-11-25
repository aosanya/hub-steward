import { describe, expect, it } from "vitest";
import { translations } from "./language";
import { languages, words } from "./words";

type Table = Record<string, string>;

const asTable = (source: object): Table => Object.fromEntries(Object.entries(source)) as Table;

const english = asTable(words);
const englishKeys = Object.keys(english).sort();

const keyProblems = (table: Table) => ({
  missing: englishKeys.filter((key) => !(key in table)),
  extra: Object.keys(table).filter((key) => !(key in english)),
});

const staysInEnglish = (key: string) => wordsOf(english[key]).length <= 1;

const wordsOf = (sentence: string) =>
  sentence.replace(/\{\w+\}/g, "").split(/\s+/).filter((word) => /\p{L}/u.test(word));

const placeholdersOf = (sentence: string) => (sentence.match(/\{\w+\}/g) ?? []).sort();

const placeholderProblems = (table: Table) =>
  englishKeys.filter((key) => JSON.stringify(placeholdersOf(table[key] ?? "")) !== JSON.stringify(placeholdersOf(english[key])));

const blankProblems = (table: Table) =>
  Object.keys(table).filter((key) => table[key].trim() === "" || table[key] !== table[key].trim());

const notYetTranslated: Record<string, string[]> = { sw: ["backAllIssues"], hu: ["backAllIssues"] };

const copiedProblems = (table: Table, pending: string[] = []) =>
  englishKeys.filter((key) => table[key] === english[key] && !staysInEnglish(key) && !pending.includes(key));

const unregisteredCodes = (registered: Record<string, unknown>) =>
  Object.keys(registered).filter((code) => !languages.some((language) => language.code === code));

const wrongTable = (change: Table): Table => ({ ...english, ...change });

const firstKey = englishKeys[0];
const aPlaceholderKey = englishKeys.find((key) => placeholdersOf(english[key]).length > 0) as string;

describe("the sync checks catch a deliberately wrong table", () => {
  it("a missing key", () => {
    const { [firstKey]: dropped, ...rest } = english;
    expect(keyProblems(rest).missing).toEqual([firstKey]);
  });

  it("an extra key", () => {
    expect(keyProblems({ ...english, stray: "x" }).extra).toEqual(["stray"]);
  });

  it("a changed placeholder", () => {
    const changed = english[aPlaceholderKey].replace(/\{(\w+)\}/, "{$1_x}");
    expect(placeholderProblems(wrongTable({ [aPlaceholderKey]: changed }))).toEqual([aPlaceholderKey]);
  });

  it("a placeholder token with a digit or underscore", () => {
    expect(placeholdersOf("a {n2} b {first_name}")).toEqual(["{first_name}", "{n2}"]);
  });

  it("a blank value", () => {
    expect(blankProblems(wrongTable({ [firstKey]: "" }))).toEqual([firstKey]);
  });

  it("a whitespace-only value", () => {
    expect(blankProblems(wrongTable({ [firstKey]: "   " }))).toEqual([firstKey]);
  });

  it("a value padded with spaces", () => {
    expect(blankProblems(wrongTable({ [firstKey]: ` ${english[firstKey]}` }))).toEqual([firstKey]);
  });

  it("a value copied unchanged from English", () => {
    const copiedKey = englishKeys.find((key) => english[key].split(/\s+/).length > 3) as string;
    expect(copiedProblems(wrongTable({}))).toContain(copiedKey);
  });

  it("a table registered under a code the language list lacks", () => {
    expect(unregisteredCodes({ ...translations, xx: words })).toEqual(["xx"]);
  });
});

const registered = Object.entries(translations).filter(([, table]) => table !== words);

describe("every registered translation is a listed language and holds exactly the English keys", () => {
  it("registers English as the words table and at least Kiswahili and Magyar", () => {
    expect(translations.en).toBe(words);
    expect(registered.map(([code]) => code)).toEqual(expect.arrayContaining(["sw", "hu"]));
  });

  it("registers no table under a code the language list lacks", () => {
    expect(unregisteredCodes(translations)).toEqual([]);
  });

  registered.forEach(([code, source]) => {
    const table = asTable(source);

    it(`${code} lacks no English key`, () => {
      expect(keyProblems(table).missing.map((key) => `${code}: ${key}`)).toEqual([]);
    });

    it(`${code} has no key English does not have`, () => {
      expect(keyProblems(table).extra.map((key) => `${code}: ${key}`)).toEqual([]);
    });

    it(`${code} uses exactly the placeholders of the English sentence for every word`, () => {
      expect(placeholderProblems(table).map((key) => `${code}: ${key}`)).toEqual([]);
    });

    it(`${code} has no blank word and no word padded with spaces`, () => {
      expect(blankProblems(table).map((key) => `${code}: ${key}`)).toEqual([]);
    });

    it(`${code} has no sentence left in English`, () => {
      expect(copiedProblems(table, notYetTranslated[code]).map((key) => `${code}: ${key}`)).toEqual([]);
    });

    it(`${code} lists as not yet translated only words that are still English`, () => {
      const translatedSince = (notYetTranslated[code] ?? []).filter((key) => table[key] !== english[key]);
      expect(translatedSince.map((key) => `${code}: ${key}`)).toEqual([]);
    });
  });
});
