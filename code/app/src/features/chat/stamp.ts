import { dayLabel, timeOf } from "./rooms/time";

export const stampOf = (iso: string | undefined, now: Date = new Date()): string => {
  if (!iso) return "";
  const day = dayLabel(iso, now);
  return day === "Today" ? timeOf(iso) : day;
};
