import { backlogsHomePath, queryParam } from "../shared/paths";
import type { RuleKind } from "./types";

export const rulebookRoutePath = ":backlogId/rulebook";

export const ruleRoutePath = "rule/:ruleCode";

export const rulebookPath = (backlogId: string, kind: RuleKind, statuses: string[] = [], query = "") => {
  const params = new URLSearchParams({ kind });
  statuses.forEach((status) => params.append("status", status));
  if (query.trim() !== "") params.set(queryParam, query);
  return `${backlogsHomePath()}/${encodeURIComponent(backlogId)}/rulebook?${params.toString()}`;
};

export const rulePath = (code: string) => `${backlogsHomePath()}/rule/${encodeURIComponent(code)}`;
