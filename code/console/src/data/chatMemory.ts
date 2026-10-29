import type { Turn } from "./modelChat";

const keptTurns = 60;

const keyOf = (hubId: string) => `chat.turns.${hubId}`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isToolsAnswer = (value: unknown): boolean => isObject(value) && value.kind === "tools" && typeof value.prompt === "string" && Array.isArray(value.rows);

const isFormAnswer = (value: unknown): boolean =>
  isObject(value) && value.kind === "form" && typeof value.prompt === "string" && (value.form === "workflow" || value.form === "scenario" || value.form === "profile") && isObject(value.fill);

const isActionAnswer = (value: unknown): boolean =>
  isObject(value) && value.kind === "action" && typeof value.prompt === "string" && typeof value.view === "string" && typeof value.title === "string" && isObject(value.params);

const isSuggestionsAnswer = (value: unknown): boolean =>
  isObject(value) && value.kind === "suggestions" && typeof value.prompt === "string" && isObject(value.fill) && Array.isArray(value.fill.items);

const isTurn = (value: unknown): value is Turn =>
  isObject(value) &&
  (value.role === "user" || value.role === "assistant") &&
  typeof value.content === "string" &&
  (value.calls === undefined || Array.isArray(value.calls)) &&
  (value.answer === undefined || isToolsAnswer(value.answer) || isFormAnswer(value.answer) || isActionAnswer(value.answer) || isSuggestionsAnswer(value.answer));

export function loadTurns(hubId: string): Turn[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(keyOf(hubId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isTurn) : [];
  } catch {
    return [];
  }
}

export function saveTurns(hubId: string, turns: Turn[]): void {
  try {
    if (turns.length === 0) window.localStorage.removeItem(keyOf(hubId));
    else window.localStorage.setItem(keyOf(hubId), JSON.stringify(turns.slice(-keptTurns)));
  } catch {
    return;
  }
}
