import type { Usage } from "../../data/usageBreakdown";

export const dayLabel = (iso: string, lang: string): string =>
  new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso.slice(0, 10) + "T00:00:00Z"));

export const rangeLabel = (usage: Usage, lang: string): string => {
  const first = usage.from ? dayLabel(usage.from, lang) : "";
  const last = usage.to ? dayLabel(usage.to, lang) : "";
  return first === last ? first : `${first} – ${last}`;
};

export const countIn = (value: number, lang: string): string => value.toLocaleString(lang);
