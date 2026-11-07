import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const languages = ["en", "de", "sw", "es", "fr", "zh", "hu"] as const;
export type Language = (typeof languages)[number];

type Table = Record<string, Record<string, string>>;

type I18n = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

const remembered = (): Language => {
  try {
    const v = localStorage.getItem("lang");
    return (languages as readonly string[]).includes(v ?? "") ? (v as Language) : "en";
  } catch {
    return "en";
  }
};

const I18nContext = createContext<I18n>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Table }) {
  const [table, setTable] = useState<Table>(initial ?? {});
  const [lang, setLangState] = useState<Language>(remembered);

  useEffect(() => {
    if (initial) return;
    fetch("/i18n.json")
      .then((r) => r.json())
      .then(setTable)
      .catch(() => {});
  }, [initial]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18n>(() => {
    const t = (key: string) => table[lang]?.[key] ?? table.en?.[key] ?? key;
    const setLang = (next: Language) => {
      try {
        localStorage.setItem("lang", next);
      } catch {}
      setLangState(next);
    };
    return { lang, setLang, t };
  }, [table, lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
