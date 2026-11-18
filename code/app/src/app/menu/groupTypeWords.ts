import type { Words } from "../../shared/language/words";

const keys: Record<string, keyof Words> = {
  household: "groupTypeHousehold",
  háztartás: "groupTypeHousehold",
  city: "groupTypeCity",
  város: "groupTypeCity",
};

export const groupTypeWord = (type: string, words: Words): string => {
  const key = keys[type.trim().toLowerCase()];
  if (key) return words[key];
  const typed = type.trim();
  return `${typed.charAt(0).toUpperCase()}${typed.slice(1)}`;
};
