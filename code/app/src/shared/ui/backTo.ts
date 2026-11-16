import { useLocation } from "react-router-dom";

const localPath = /^\/(?![/\\])/;

export const backState = (from: string, label?: string) => ({ state: label ? { backTo: from, backLabel: label } : { backTo: from } });

export const backToOf = (state: unknown, fallback: string): string => {
  const asked = (state as { backTo?: unknown } | null | undefined)?.backTo;
  return typeof asked === "string" && localPath.test(asked) ? asked : fallback;
};

export const useBackTo = (fallback: string) => backToOf(useLocation().state, fallback);

export const backLabelOf = (state: unknown, fallback: string): string => {
  const asked = (state as { backLabel?: unknown } | null | undefined)?.backLabel;
  return typeof asked === "string" && asked.trim() !== "" ? asked : fallback;
};

export const useBackLabel = (fallback: string) => backLabelOf(useLocation().state, fallback);
