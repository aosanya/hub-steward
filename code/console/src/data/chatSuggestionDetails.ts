import { callTool } from "../wakala/mcp";
import type { Suggestion } from "./chatAnswer";
import { draftScope } from "./draft";
import { itemsOf, textOf, type Item } from "./pages/groups";

export type DetailCard = { kind: "goal" | "objective" | "role"; code: string; title: string; description: string; goal: string; permissions: string[] };

const codePattern = /\b[A-Z]{1,3}-\d+\b/g;

const idsIn = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(idsIn);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(idsIn);
  return [];
};

export const referencesOf = (suggestion: Suggestion): string[] => [
  ...(`${suggestion.title} ${suggestion.detail}`.match(codePattern) ?? []),
  ...idsIn(suggestion.arguments),
];

const cardOf = (kind: DetailCard["kind"], item: Item, goals: Map<string, Item>): DetailCard => {
  const goal = goals.get(textOf(item, "goal_id"));
  return {
    kind,
    code: textOf(item, "code"),
    title: textOf(item, "title"),
    description: textOf(item, "description"),
    goal: goal ? [textOf(goal, "code"), textOf(goal, "title")].filter(Boolean).join(" · ") : "",
    permissions: [],
  };
};

const roleCardOf = (item: Item): DetailCard => ({
  kind: "role",
  code: textOf(item, "code"),
  title: textOf(item, "name"),
  description: textOf(item, "description"),
  goal: "",
  permissions: Array.isArray(item.permissions) ? item.permissions.filter((p): p is string => typeof p === "string") : [],
});

export async function loadDetails(hubId: string, suggestion: Suggestion): Promise<DetailCard[]> {
  const scope = await draftScope(hubId);
  const [goalList, objectiveList, roleList] = await Promise.all([
    callTool<unknown>(hubId, "agency_list_goals", scope),
    callTool<unknown>(hubId, "agency_list_objectives", scope),
    callTool<unknown>(hubId, "agency_list_roles", scope),
  ]);
  const goals = itemsOf(goalList);
  const goalById = new Map(goals.map((goal) => [textOf(goal, "id"), goal]));
  const known = [
    ...itemsOf(objectiveList).map((item) => ({ item, card: cardOf("objective", item, goalById) })),
    ...goals.map((item) => ({ item, card: cardOf("goal", item, goalById) })),
    ...itemsOf(roleList).map((item) => ({ item, card: roleCardOf(item) })),
  ];
  const found = new Set<DetailCard>();
  for (const reference of referencesOf(suggestion)) {
    for (const { item, card } of known) if (card.code === reference || textOf(item, "id") === reference) found.add(card);
  }
  const cards = [...found];
  if (cards.some((card) => card.permissions.length > 0)) {
    const names = await permissionNames(hubId);
    for (const card of cards) card.permissions = card.permissions.map((code) => names.get(code) ?? code);
  }
  return cards;
}

async function permissionNames(hubId: string): Promise<Map<string, string>> {
  try {
    const list = await callTool<unknown>(hubId, "agency_list_permissions");
    return new Map(itemsOf(list).map((item) => [textOf(item, "code"), textOf(item, "name")]));
  } catch {
    return new Map();
  }
}
