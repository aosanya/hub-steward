import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tables: Record<string, Record<string, string>> = JSON.parse(readFileSync(join(resolve(__dirname, ".."), "..", "public", "i18n.json"), "utf8"));

const wording: Record<string, string> = {
  en: "You are in no group yet, so you reach no rows. Ask the administrator of this hub to add you to a group.",
  de: "Du bist noch in keiner Gruppe und erreichst daher keine Zeilen. Bitte den Administrator dieses Hubs, dich einer Gruppe hinzuzufügen.",
  sw: "Bado hujawa katika kikundi chochote, kwa hiyo huwezi kufikia safu zozote. Mwombe msimamizi wa kitovu hiki akuongeze kwenye kikundi.",
  es: "Aún no estás en ningún grupo, así que no accedes a ninguna fila. Pide al administrador de este hub que te añada a un grupo.",
  fr: "Vous n'êtes encore dans aucun groupe, vous n'accédez donc à aucune ligne. Demandez à l'administrateur de ce hub de vous ajouter à un groupe.",
  zh: "你还不在任何小组中,因此无法访问任何行。请让这个中心的管理员把你加入一个小组。",
  hu: "Még nem tartozol egyetlen csoportba sem, ezért egy sort sem érsz el. Kérd meg e hub adminisztrátorát, hogy vegyen fel egy csoportba.",
};

const administratorWords = /administrator|administrador|administrateur|adminisztrátor|msimamizi|管理员/i;
const oldWords = /whoever runs|Person, die diesen|anayeendesha|quien gestiona|personne qui gère|负责运营|aki ezt a hubot működteti/i;

describe("the no-group message in every console language", () => {
  for (const [language, text] of Object.entries(wording)) {
    it(`reads as agreed in ${language}`, () => {
      expect(tables[language].groupNone).toBe(text);
    });

    it(`names the administrator in ${language}`, () => {
      expect(tables[language].groupNone).toMatch(administratorWords);
      expect(tables[language].groupNone).not.toMatch(oldWords);
    });
  }
});
