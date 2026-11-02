import { kes } from "./money";

export const unitWordsOf = (unit: string, quantity: number) => {
  const word = unit.trim();
  return quantity === 1 || word === "" ? word : `${word}s`;
};

export const quantityWords = (quantity: number, unit: string) =>
  [String(quantity), unitWordsOf(unit, quantity)].filter((part) => part !== "").join(" ");

export const quantityLabel = (unit: string) => {
  const word = unitWordsOf(unit, 2);
  return word === "" ? "Quantity" : `${word[0].toUpperCase()}${word.slice(1)}`;
};

export const priceWords = (price: number | string, unit: string) => {
  const word = unit.trim();
  return `${kes(price)}${word === "" ? "" : ` a ${word}`}`;
};
