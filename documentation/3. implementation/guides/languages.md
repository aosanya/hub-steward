# Languages

**Console.** `code/console/public/i18n.json` holds seven languages (en, de, sw, es, fr, zh, hu), each with the same keys. To fix a string, edit it there. To add a language, add its code to `languages` in `src/i18n.tsx` and to the test, its name to `languageNames` in `src/shell/Strip.tsx` (the entry screen reads the same list), and translate every key. Hungarian says "ügynökség" for an agency and "ügynök" for an agent.

**Phone app.** Sign-in, agency lists and the inbox are translated in `code/app/src/entry/words.ts` (English) and `swahili.ts`. The language picker lists nine languages, but only English and Swahili have words; the rest show English. To add one, copy `swahili.ts` and register it in `translations` in `language.ts`.

**Demo documents.** Of the eight demo agencies, only the Siaya lab has documents: `demo/siaya-lab/{en,sw,de}/` hold the same four in three languages.

**The agent.** An AI role answers in the language the member writes in; the model decides, and no code limits it to a list. The Siaya lab's Hub Steward role says English, Swahili or German in `demo/siaya-lab/agency.json` because those are its documents' languages. The other seven demo agencies have no documents, so they have nothing for an agent to cite.

Check:

```sh
cd code/console && npx vitest run src/i18nFiles.test.ts
cd code/app && npx vitest run src/entry
```
