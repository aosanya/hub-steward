import { describe, expect, it } from "vitest";
import { magyar } from "./magyar";
import { swahili } from "./swahili";
import { words } from "./words";

const wording = {
  English: [words, "You are not in a group yet, so there is nothing to show you. Ask the administrator of this hub to add you to one."],
  Kiswahili: [swahili, "Bado hauko katika kikundi, kwa hiyo hakuna cha kukuonyesha. Mwombe msimamizi wa kitovu hiki akuongeze kwenye kimoja."],
  Magyar: [magyar, "Még nem tagja egyetlen csoportnak sem, ezért nincs mit mutatni. Kérje meg e hub adminisztrátorát, hogy vegye fel egy csoportba."],
} as const;

const administratorWords = /administrator|msimamizi|adminisztrátor/i;
const oldWords = /whoever runs|anayeendesha|aki ezt a hubot működteti/i;

describe("the no-group message in every app language", () => {
  for (const [language, [table, text]] of Object.entries(wording)) {
    it(`reads as agreed in ${language}`, () => {
      expect(table.groupNoneBody).toBe(text);
    });

    it(`names the administrator in ${language}`, () => {
      expect(table.groupNoneBody).toMatch(administratorWords);
      expect(table.groupNoneBody).not.toMatch(oldWords);
    });
  }
});
