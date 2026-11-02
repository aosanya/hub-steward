import { callTool } from "../wakala/mcp";
import { itemsOf, text } from "./modelLimits";
import { usersPage } from "./pages/users";

export const spans = ["today", "7d", "month", "last_month"] as const;

export type UsageSpan = (typeof spans)[number];

export type UsageGroup = "person" | "agent";

export const kinds = ["chat", "workflow_run", "agency_review", "test_run", "background_job", "other"] as const;

export type UsageKind = (typeof kinds)[number];

export type UsageRow = {
  day: string;
  model: string;
  roleId: string;
  role: string;
  kind: UsageKind;
  person: string;
  tokensIn: number;
  tokensOut: number;
  requests: number;
};

export type Usage = { from: string; to: string; rows: UsageRow[] };

export type Names = Map<string, string>;

export const defaultSpan: UsageSpan = "month";

export const defaultGroup: UsageGroup = "agent";

export const kindColors: Record<UsageKind, string> = {
  chat: "var(--k1)",
  workflow_run: "var(--k2)",
  agency_review: "var(--k3)",
  test_run: "var(--k4)",
  background_job: "var(--text4)",
  other: "var(--text3)",
};

const modelColors = ["var(--m1)", "var(--m2)", "var(--m3)"];

const numberOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const kindOf = (value: string): UsageKind => kinds.find((kind) => kind === value) ?? "other";

const rowOf = (raw: Record<string, unknown>): UsageRow => ({
  day: text(raw.day),
  model: text(raw.model),
  roleId: text(raw.role_id),
  role: text(raw.role),
  kind: kindOf(text(raw.kind)),
  person: text(raw.person),
  tokensIn: numberOf(raw.tokens_in),
  tokensOut: numberOf(raw.tokens_out),
  requests: numberOf(raw.requests),
});

export async function loadUsage(hubId: string, span: UsageSpan, group: UsageGroup): Promise<Usage> {
  const answer = await callTool<Record<string, unknown>>(hubId, "ai_usage_breakdown", { window: span, group_by: group });
  const rows = answer.rows === null || answer.rows === undefined ? [] : itemsOf(answer.rows).map(rowOf);
  return { from: text(answer.from), to: text(answer.to), rows };
}

export async function loadNames(hubId: string): Promise<Names> {
  try {
    const people = await usersPage.rows(hubId, {});
    return new Map(people.map((person): [string, string] => [text(person.id), text(person.user)]));
  } catch {
    return new Map();
  }
}

export const tokensOf = (rows: UsageRow[]): number => rows.reduce((sum, row) => sum + row.tokensIn + row.tokensOut, 0);

const sumBy = (rows: UsageRow[], pick: (row: UsageRow) => number): number => rows.reduce((sum, row) => sum + pick(row), 0);

const percent = (part: number, whole: number): number => (whole > 0 ? Math.round((part * 100) / whole) : 0);

const grouped = (rows: UsageRow[], keyOf: (row: UsageRow) => string): Map<string, UsageRow[]> => {
  const found = new Map<string, UsageRow[]>();
  for (const row of rows) found.set(keyOf(row), [...(found.get(keyOf(row)) ?? []), row]);
  return found;
};

const heaviestFirst = (found: Map<string, UsageRow[]>): [string, UsageRow[]][] =>
  [...found.entries()].sort((a, b) => tokensOf(b[1]) - tokensOf(a[1]));

export type Figures = { tokens: number; requests: number; inputShare: number; topModel: string; topShare: number };

export function figuresOf(rows: UsageRow[]): Figures {
  const tokens = tokensOf(rows);
  const [top] = heaviestFirst(grouped(rows, (row) => row.model));
  return {
    tokens,
    requests: sumBy(rows, (row) => row.requests),
    inputShare: percent(sumBy(rows, (row) => row.tokensIn), tokens),
    topModel: top ? top[0] : "",
    topShare: top ? percent(tokensOf(top[1]), tokens) : 0,
  };
}

export const rolesOf = (rows: UsageRow[]): Map<string, string> => new Map(rows.map((row) => [row.roleId, row.role]));

export const forRole = (rows: UsageRow[], roleId: string): UsageRow[] => (roleId ? rows.filter((row) => row.roleId === roleId) : rows);

const isoOf = (date: Date): string => date.toISOString().slice(0, 10);

export function daysOf(usage: Usage): string[] {
  const seen = [...new Set(usage.rows.map((row) => row.day))].sort();
  const first = usage.from ? usage.from.slice(0, 10) : seen[0];
  const last = usage.to ? usage.to.slice(0, 10) : seen[seen.length - 1];
  if (!first || !last) return seen;
  const days: string[] = [];
  for (let at = new Date(first + "T00:00:00Z"); isoOf(at) <= last && days.length < 62; at = new Date(at.getTime() + 86400000)) days.push(isoOf(at));
  return days;
}

export type SeriesOf = { name: string; color: string; values: number[] };

export function perDaySeries(rows: UsageRow[], days: string[]): SeriesOf[] {
  return heaviestFirst(grouped(rows, (row) => row.model)).map(([model, mine], index) => ({
    name: model,
    color: modelColors[index % modelColors.length],
    values: days.map((day) => tokensOf(mine.filter((row) => row.day === day))),
  }));
}

export type Slice = { kind: UsageKind; value: number };

export const kindSlices = (rows: UsageRow[]): Slice[] =>
  kinds.map((kind) => ({ kind, value: tokensOf(rows.filter((row) => row.kind === kind)) })).filter((slice) => slice.value > 0);

export type Heat = { models: string[]; kinds: UsageKind[]; matrix: number[][] };

export function heatOf(rows: UsageRow[]): Heat {
  const present = kindSlices(rows).map((slice) => slice.kind);
  const models = heaviestFirst(grouped(rows, (row) => row.model)).map(([model]) => model);
  return {
    models,
    kinds: present,
    matrix: models.map((model) => present.map((kind) => tokensOf(rows.filter((row) => row.model === model && row.kind === kind)))),
  };
}

export type Ranked = { key: string; name: string; tokensIn: number; tokensOut: number; requests: number };

export type Words = { byItself: string; unknownPerson: string };

export const personName = (id: string, names: Names, words: Words): string => (id === "" ? words.byItself : (names.get(id) ?? words.unknownPerson));

export function rankedOf(rows: UsageRow[], by: "role" | "person", names: Names, words: Words): Ranked[] {
  return heaviestFirst(grouped(rows, (row) => (by === "role" ? row.roleId : row.person))).map(([key, mine]) => ({
    key,
    name: by === "role" ? mine[0].role : personName(key, names, words),
    tokensIn: sumBy(mine, (row) => row.tokensIn),
    tokensOut: sumBy(mine, (row) => row.tokensOut),
    requests: sumBy(mine, (row) => row.requests),
  }));
}

export type BreakdownLine = { key: string; who: string; kind: UsageKind; model: string; tokensIn: number; tokensOut: number; requests: number };

export function breakdownOf(rows: UsageRow[], by: "role" | "person", names: Names, words: Words): BreakdownLine[] {
  const keyed = grouped(rows, (row) => [by === "role" ? row.roleId : row.person, row.kind, row.model].join("\u0000"));
  return heaviestFirst(keyed).map(([key, mine]) => ({
    key,
    who: by === "role" ? mine[0].role : personName(mine[0].person, names, words),
    kind: mine[0].kind,
    model: mine[0].model,
    tokensIn: sumBy(mine, (row) => row.tokensIn),
    tokensOut: sumBy(mine, (row) => row.tokensOut),
    requests: sumBy(mine, (row) => row.requests),
  }));
}
