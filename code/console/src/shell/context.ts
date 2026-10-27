import { createContext, useContext, useEffect } from "react";
import type { Hub } from "../types";

export type ConsoleContext = {
  hub: Hub;
  page: string;
  setBadges: (badges: Record<string, number>) => void;
  refreshMenu: () => void;
};

export const ConsoleCtx = createContext<ConsoleContext | null>(null);

export function useConsole(): ConsoleContext {
  const c = useContext(ConsoleCtx);
  if (!c) throw new Error("useConsole needs the console frame");
  return c;
}

export function useMenuCount(count: number | undefined): void {
  const { page, setBadges } = useConsole();
  useEffect(() => {
    setBadges(count === undefined ? {} : { [page]: count });
    return () => setBadges({});
  }, [page, count, setBadges]);
}
