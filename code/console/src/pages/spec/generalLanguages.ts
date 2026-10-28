import { languages } from "../../i18n";

export const languageName = (code: string): string => {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch {
    return code;
  }
};

export const languageChoices = (codes: string[]) => codes.map((code) => ({ value: code, label: languageName(code) }));

export const defaultLanguageChoices = (hubCodes: string[]) =>
  languageChoices([...languages, ...hubCodes.filter((code) => !(languages as readonly string[]).includes(code))]);
