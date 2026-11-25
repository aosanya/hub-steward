import { describe, expect, it } from "vitest";
import { wordsFor } from "./language";
import { languages, words } from "./words";

const englishKeys = Object.keys(words).sort();

const registered = languages.filter((language) => wordsFor(language.code) !== words);

describe("every registered translation holds exactly the English keys", () => {
  it("registers at least Kiswahili and Magyar", () => {
    expect(registered.map((language) => language.code)).toEqual(expect.arrayContaining(["sw", "hu"]));
  });

  registered.forEach((language) => {
    const keys = Object.keys(wordsFor(language.code));

    it(`${language.name} lacks no English key`, () => {
      const missing = englishKeys.filter((key) => !keys.includes(key)).map((key) => `${language.code}: ${key}`);
      expect(missing).toEqual([]);
    });

    it(`${language.name} has no key English does not have`, () => {
      const extra = keys.filter((key) => !englishKeys.includes(key)).map((key) => `${language.code}: ${key}`);
      expect(extra).toEqual([]);
    });
  });
});
