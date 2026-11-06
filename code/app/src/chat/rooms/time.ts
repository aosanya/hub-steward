import { shortDayWords } from "../../ui/days";

const pad = (n: number) => String(n).padStart(2, "0");

const dateOf = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const timeOf = (iso: string) => {
  const date = dateOf(iso);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
};

export const dayKey = (iso: string) => {
  const date = dateOf(iso);
  return date ? keyOf(date) : "";
};

export const dayLabel = (iso: string, now: Date = new Date()) => {
  const date = dateOf(iso);
  if (!date) return "";
  if (keyOf(date) === keyOf(now)) return "Today";
  return shortDayWords(iso) ?? "";
};
