import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tables: Record<string, Record<string, string>> = JSON.parse(readFileSync(join(resolve(__dirname, ".."), "..", "public", "i18n.json"), "utf8"));

const wording: Record<string, string> = {
  en: "You are in no group yet, so you reach no rows. Ask whoever runs this hub to add you to a group.",
  de: "Du bist noch in keiner Gruppe und erreichst daher keine Zeilen. Bitte die Person, die diesen Hub betreibt, dich einer Gruppe hinzuzufügen.",
  sw: "Bado hujawa katika kikundi chochote, kwa hiyo huwezi kufikia safu zozote. Mwombe anayeendesha kitovu hiki akuongeze kwenye kikundi.",
  es: "Aún no estás en ningún grupo, así que no accedes a ninguna fila. Pide a quien gestiona este hub que te añada a un grupo.",
  fr: "Vous n'êtes encore dans aucun groupe, vous n'accédez donc à aucune ligne. Demandez à la personne qui gère ce hub de vous ajouter à un groupe.",
  zh: "你还不在任何小组中,因此无法访问任何行。请让负责运营这个中心的人把你加入一个小组。",
  hu: "Még nem tartozol egyetlen csoportba sem, ezért egy sort sem érsz el. Kérd meg azt, aki ezt a hubot működteti, hogy vegyen fel egy csoportba.",
};

const administratorWords = /administrator|administrador|administrateur|adminisztrátor|msimamizi|管理员/i;

describe("the no-group message in every console language", () => {
  for (const [language, text] of Object.entries(wording)) {
    it(`reads as agreed in ${language}`, () => {
      expect(tables[language].groupNone).toBe(text);
    });

    it(`names no administrator in ${language}`, () => {
      expect(tables[language].groupNone).not.toMatch(administratorWords);
    });
  }
});
