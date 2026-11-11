import type { Words } from "../entry/words";

export type Age = { unit: "min" | "hour" | "day"; count: number };

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

export const ageOf = (created: string | undefined, until: number): Age | null => {
  const from = created ? Date.parse(created) : Number.NaN;
  if (Number.isNaN(from) || Number.isNaN(until)) return null;
  const elapsed = Math.max(until - from, 0);
  if (elapsed >= day) return { unit: "day", count: Math.floor(elapsed / day) };
  if (elapsed >= hour) return { unit: "hour", count: Math.floor(elapsed / hour) };
  return { unit: "min", count: Math.max(Math.floor(elapsed / minute), 1) };
};

export const ageWords = (age: Age, words: Words) => {
  const template = age.unit === "min" ? words.ageMinutes : age.unit === "hour" ? words.ageHours : age.count === 1 ? words.ageDaysOne : words.ageDaysMany;
  return template.replace("{count}", String(age.count));
};
