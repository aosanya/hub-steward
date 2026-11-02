import { useLocation } from "react-router-dom";

const localPath = /^\/(?![/\\])/;

export const backState = (from: string) => ({ state: { backTo: from } });

export const backToOf = (state: unknown, fallback: string): string => {
  const asked = (state as { backTo?: unknown } | null | undefined)?.backTo;
  return typeof asked === "string" && localPath.test(asked) ? asked : fallback;
};

export const useBackTo = (fallback: string) => backToOf(useLocation().state, fallback);
