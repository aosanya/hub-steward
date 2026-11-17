import type { Item } from "./financeData";

export const missingPeriodWords = "Choose both a start date and an end date.";

export const reversedPeriodWords = "The end date must not come before the start date.";

export const noReportWords = "No report could be read for that period.";

export const periodRefusal = (start: string, end: string) => {
  if (!start || !end) return missingPeriodWords;
  return end < start ? reversedPeriodWords : "";
};

export const figureOf = (report: Item | null, key: string) => (report?.figures as Item | undefined)?.[key];
