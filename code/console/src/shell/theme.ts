import { useCallback, useEffect, useSyncExternalStore } from "react";
import { themeChoices } from "../ui/themes";

export const themes = themeChoices;

export const themeStorageKey = "theme";

export const defaultTheme = "dark";

export const isTheme = (value: unknown): value is string => themes.some((theme) => theme.key === value);

const listeners = new Set<() => void>();

let unsaved: string | null = null;

const stored = (): string => {
  if (unsaved) return unsaved;
  try {
    const value = localStorage.getItem(themeStorageKey);
    return isTheme(value) ? value : defaultTheme;
  } catch {
    return defaultTheme;
  }
};

const changed = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

export const saveTheme = (next: string) => {
  if (!isTheme(next)) return;
  try {
    localStorage.setItem(themeStorageKey, next);
    unsaved = null;
  } catch {
    unsaved = next;
  }
  changed();
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, stored, () => defaultTheme);
  const setTheme = useCallback((next: string) => saveTheme(next), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return { theme, setTheme, themes };
}
