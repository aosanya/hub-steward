import type { Turn } from "./api";
import type { ResultList } from "./results";

export type Item = Turn & { id: number; queued?: boolean; views?: string[] };

export const nextQueued = (items: Item[]) => items.find((item) => item.queued);

export const markSent = (items: Item[], id: number) => items.map((item) => (item.id === id ? { ...item, queued: false } : item));

const openRow = /^\s*open\s+(?:no\.?\s*|number\s*|#)?(\d+)\s*[.!]?\s*$/i;

const shownList = (before: Item[]): ResultList | undefined => [...before].reverse().find((item) => item.role === "assistant" && (item.lists?.length ?? 0) > 0)?.lists?.[0];

const withRowNamed = (content: string, before: Item[]) => {
  const row = openRow.exec(content);
  const list = row ? shownList(before) : undefined;
  const issue = row && list ? list.issues[Number(row[1]) - 1] : undefined;
  return issue ? `${content} (row ${row?.[1]} of the list "${list?.title}" shown in the Results tab is issue ${issue.id}, "${issue.title}")` : content;
};

export const historyUpTo = (items: Item[], id: number): Turn[] => {
  const upTo = items.slice(0, items.findIndex((item) => item.id === id) + 1);
  return upTo.map(({ role, content }, at) => ({ role, content: role === "user" ? withRowNamed(content, upTo.slice(0, at)) : content }));
};

export const answerAfter = (items: Item[], id: number, answer: Item): Item[] => {
  const at = items.findIndex((item) => item.id === id);
  return [...items.slice(0, at + 1), answer, ...items.slice(at + 1)];
};

export const withoutItem = (items: Item[], id: number) => items.filter((item) => item.id !== id);

export const requeueUnanswered = (items: Item[]): Item[] => items.map((item, at) => (item.role === "user" && !item.queued && items[at + 1]?.role !== "assistant" ? { ...item, queued: true } : item));
