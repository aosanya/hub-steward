import type { ActionAnswer } from "./chatAnswer";
import type { ToolSpec } from "./chatTools";
import { text } from "./modelLimits";
import { kinds, loadNames, loadUsage, personName, spans, tokensOf, type Names, type UsageKind, type UsageRow, type UsageSpan, type Words } from "./usageBreakdown";

export const showUsageAnswerTool = "show_usage_answer";

export const usageAnswerView = "usageAnswer";

export const busiestDaysShown = 3;

export type UsageAsk = { kind: UsageKind | ""; span: UsageSpan; roleId: string; model: string };

export type RoleSpend = { name: string; tokensIn: number; tokensOut: number; requests: number };

export type BusyDay = { day: string; tokens: number; runs: number; person: string };

export type UsageAnswer = {
  kind: UsageKind | "";
  tokens: number;
  share: number;
  runs: number;
  busiest: BusyDay | null;
  byRole: RoleSpend[];
  busyDays: BusyDay[];
};

type Args = Record<string, unknown>;

export const usageAnswerSpec: ToolSpec = {
  name: showUsageAnswerTool,
  description:
    "Shows the manager, in the content area next to this chat, the usage figures behind a question about tokens: the tokens of one kind of work, its share, its runs, its busiest day, the agents that spent it and the busiest days with who ran them. Call it after reading ai_usage_breakdown, and answer in one sentence.",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...kinds], description: "The kind of work the question is about. Leave out for all kinds." },
      window: { type: "string", enum: [...spans], description: "The span the question is about. This month when the manager gave none." },
      role_id: { type: "string", description: "The id of the AI role, as listed by ai_list_roles, when the question is about one agent." },
      model: { type: "string", description: "The model name when the question is about one model." },
    },
    required: [],
  },
};

const oneOf = <T extends string>(options: readonly T[], value: unknown): T | undefined => options.find((option) => option === value);

export const usageAskOf = (params: Args): UsageAsk => ({
  kind: oneOf(kinds, params.kind) ?? "",
  span: oneOf(spans, params.window) ?? "month",
  roleId: text(params.role_id),
  model: text(params.model),
});

export const usageAnswerAnswer = (prompt: string, args: Args): ActionAnswer => ({
  kind: "action",
  prompt,
  view: usageAnswerView,
  title: "",
  params: { ...args },
});

export const usageAnswerAction = { spec: usageAnswerSpec, answer: usageAnswerAnswer };

const sum = (rows: UsageRow[], pick: (row: UsageRow) => number): number => rows.reduce((total, row) => total + pick(row), 0);

const grouped = (rows: UsageRow[], key: (row: UsageRow) => string): [string, UsageRow[]][] => {
  const found = new Map<string, UsageRow[]>();
  rows.forEach((row) => found.set(key(row), [...(found.get(key(row)) ?? []), row]));
  return [...found];
};

const topPersonOf = (rows: UsageRow[]): string =>
  grouped(rows, (row) => row.person).sort((a, b) => tokensOf(b[1]) - tokensOf(a[1]))[0]?.[0] ?? "";

export function usageAnswerOf(rows: UsageRow[], kind: UsageKind | ""): UsageAnswer {
  const mine = kind === "" ? rows : rows.filter((row) => row.kind === kind);
  const tokens = tokensOf(mine);
  const total = tokensOf(rows);
  const days = grouped(mine, (row) => row.day)
    .map(([day, dayRows]) => ({ day, tokens: tokensOf(dayRows), runs: sum(dayRows, (row) => row.requests), person: topPersonOf(dayRows) }))
    .sort((a, b) => b.tokens - a.tokens);
  const byRole = grouped(mine, (row) => row.roleId)
    .map(([, roleRows]) => ({
      name: roleRows[0].role,
      tokensIn: sum(roleRows, (row) => row.tokensIn),
      tokensOut: sum(roleRows, (row) => row.tokensOut),
      requests: sum(roleRows, (row) => row.requests),
    }))
    .sort((a, b) => b.tokensIn + b.tokensOut - (a.tokensIn + a.tokensOut));
  return {
    kind,
    tokens,
    share: total === 0 ? 0 : Math.round((tokens * 100) / total),
    runs: sum(mine, (row) => row.requests),
    busiest: days[0] ?? null,
    byRole,
    busyDays: days.slice(0, busiestDaysShown),
  };
}

export type UsageLoaded = { answer: UsageAnswer; names: Names };

export async function loadUsageAnswer(hubId: string, ask: UsageAsk): Promise<UsageLoaded> {
  const [usage, names] = await Promise.all([loadUsage(hubId, ask.span, "person"), loadNames(hubId)]);
  const rows = usage.rows.filter((row) => (ask.roleId === "" || row.roleId === ask.roleId) && (ask.model === "" || row.model === ask.model));
  return { answer: usageAnswerOf(rows, ask.kind), names };
}

export const busyPersonName = (day: BusyDay, names: Names, words: Words): string => personName(day.person, names, words);
