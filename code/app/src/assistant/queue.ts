import type { Turn } from "./api";

export type Item = Turn & { id: number; queued?: boolean; views?: string[] };

export const nextQueued = (items: Item[]) => items.find((item) => item.queued);

export const markSent = (items: Item[], id: number) => items.map((item) => (item.id === id ? { ...item, queued: false } : item));

export const historyUpTo = (items: Item[], id: number): Turn[] => items.slice(0, items.findIndex((item) => item.id === id) + 1).map(({ role, content }) => ({ role, content }));

export const answerAfter = (items: Item[], id: number, answer: Item): Item[] => {
  const at = items.findIndex((item) => item.id === id);
  return [...items.slice(0, at + 1), answer, ...items.slice(at + 1)];
};

export const withoutItem = (items: Item[], id: number) => items.filter((item) => item.id !== id);
