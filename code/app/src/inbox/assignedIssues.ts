import { fetchAll, settled } from "../backlogs/api";
import { callTool } from "../wakala/mcp";

export type AssignedIssue = { id: string; code: string; title: string; step: string };

export type AssignedClient = { assigned: () => Promise<AssignedIssue[]> };

const finished = new Set([...settled, "failed"]);

const text = (value: unknown) => (typeof value === "string" ? value : "");

const heldBy = (raw: any, actorId: string) => actorId !== "" && text(raw?.assigned_to) === actorId && text(raw?.assignee_kind) === "actor";

export const assignedIssuesOf = (rows: unknown[], actorId: string): AssignedIssue[] =>
  rows
    .filter((raw: any) => text(raw?.id) !== "" && heldBy(raw, actorId) && !finished.has(text(raw?.status)))
    .map((raw: any) => ({ id: text(raw.id), code: text(raw.code), title: text(raw.title) || text(raw.task_name), step: text(raw.step) }));

export const assignedIssueTitle = (issue: AssignedIssue) => [issue.code, issue.title].filter(Boolean).join(" ");

export const mcpAssignedClient: AssignedClient = {
  async assigned() {
    const me = await callTool("", "actor_get_my_actor");
    return assignedIssuesOf(await fetchAll({}), text(me?.id));
  },
};
