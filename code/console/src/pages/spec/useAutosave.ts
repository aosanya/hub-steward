import { useEffect, useRef, useState } from "react";

const storageKey = "autosave";

const stored = () => {
  try {
    return localStorage.getItem(storageKey) === "on";
  } catch {
    return false;
  }
};

export const autosaveDelayMs = 1200;

export function useAutosave(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(stored);
  const choose = (next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(storageKey, next ? "on" : "off");
    } catch {
      return;
    }
  };
  return [on, choose];
}

export function useSaveWhenIdle(due: boolean, save: () => void, edit: string) {
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => latest.current(), autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [due, edit]);
}
