import type { Suggestion, SuggestionStep, SuggestionsFill } from "./chatAnswer";

export type KeptReview = { hubId: string; page: string; id: number; fill: SuggestionsFill };

export type KeptProgress = { done: number[]; dismissed: number[] };

const reviewKey = (hubId: string) => `chat.review.${hubId}`;

const progressKey = (hubId: string, id: number) => `chat.review.${hubId}.${id}`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const stepOf = (value: unknown): SuggestionStep | null => (isObject(value) && text(value.tool) !== "" ? { tool: text(value.tool), arguments: isObject(value.arguments) ? value.arguments : {} } : null);

const suggestionOf = (value: unknown): Suggestion | null =>
  isObject(value) && text(value.title) !== ""
    ? {
        title: text(value.title),
        detail: text(value.detail),
        tool: text(value.tool),
        arguments: isObject(value.arguments) ? value.arguments : {},
        then: (Array.isArray(value.then) ? value.then : []).map(stepOf).filter((step): step is SuggestionStep => step !== null),
      }
    : null;

const numbersOf = (value: unknown): number[] => (Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === "number") : []);

export function loadReview(hubId: string): KeptReview | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(reviewKey(hubId)) ?? "null");
    if (!isObject(parsed) || typeof parsed.id !== "number" || !isObject(parsed.fill)) return null;
    const items = (Array.isArray(parsed.fill.items) ? parsed.fill.items : []).map(suggestionOf).filter((item): item is Suggestion => item !== null);
    return { hubId, page: text(parsed.page), id: parsed.id, fill: { page: text(parsed.fill.page), summary: text(parsed.fill.summary), items } };
  } catch {
    return null;
  }
}

export function saveReview(hubId: string, review: KeptReview | null): void {
  try {
    if (review) window.localStorage.setItem(reviewKey(hubId), JSON.stringify(review));
    else window.localStorage.removeItem(reviewKey(hubId));
  } catch {
    return;
  }
}

export function loadProgress(hubId: string, id: number): KeptProgress {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(progressKey(hubId, id)) ?? "null");
    return isObject(parsed) ? { done: numbersOf(parsed.done), dismissed: numbersOf(parsed.dismissed) } : { done: [], dismissed: [] };
  } catch {
    return { done: [], dismissed: [] };
  }
}

export function saveProgress(hubId: string, id: number, progress: KeptProgress): void {
  try {
    window.localStorage.setItem(progressKey(hubId, id), JSON.stringify(progress));
  } catch {
    return;
  }
}

export function clearProgress(hubId: string, id: number): void {
  try {
    window.localStorage.removeItem(progressKey(hubId, id));
  } catch {
    return;
  }
}
