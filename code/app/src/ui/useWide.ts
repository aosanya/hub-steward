import { useSyncExternalStore } from "react";

export const wideQuery = "(min-width: 48rem)";

const available = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribe = (notify: () => void) => {
  if (!available()) return () => undefined;
  const media = window.matchMedia(wideQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

const matches = () => available() && window.matchMedia(wideQuery).matches;

export const useWide = () => useSyncExternalStore(subscribe, matches, () => false);
