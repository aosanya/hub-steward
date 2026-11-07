import { useCallback, useSyncExternalStore } from "react";
import { magyar } from "./magyar";
import { swahili } from "./swahili";
import { languages, words, type Words } from "./words";

const storageKey = "hub.language";
const fallback = "en";
const listeners = new Set<() => void>();
let remembered = fallback;

const known = (code: string | null): code is string => languages.some((l) => l.code === code);

const read = (): string => {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return known(stored) ? stored : fallback;
  } catch {
    return remembered;
  }
};

const write = (code: string) => {
  remembered = code;
  try {
    window.localStorage.setItem(storageKey, code);
  } catch {
    return;
  } finally {
    listeners.forEach((notify) => notify());
  }
};

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

const translations: Record<string, Words> = { en: words, sw: swahili, hu: magyar };

export const wordsFor = (code: string): Words => translations[code] ?? words;

export function useLanguage() {
  const code = useSyncExternalStore(subscribe, read, () => fallback);
  const setLanguage = useCallback((next: string) => write(next), []);
  return { code, setLanguage, words: wordsFor(code) };
}
