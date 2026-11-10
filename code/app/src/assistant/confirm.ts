import type { BacklogsClient } from "../backlogs/api";
import { fieldSpec, operatorLabel } from "../smartBacklog/fields";
import { FIELD_IDS, type FieldId } from "../smartBacklog/types";

export const moveTool = "taskmanager_task_move_to_step";

export const createTool = "taskmanager_backlog_create";

export const rulesTool = "taskmanager_backlog_rules_set";

export const writeNames = [moveTool, createTool, rulesTool];

export type Write = { tool: string; arguments: Record<string, unknown> };

export type Names = { issue?: string; backlog?: string };

export type Held = { issues: { id: string; title: string }[] }[];

export type Confirm = (write: Write) => Promise<boolean>;

export const cancelWords = "Cancel";

export const confirmWords: Record<string, string> = {
  [moveTool]: "Move",
  [createTool]: "Create",
  [rulesTool]: "Change the rules",
};

export const cancelledResult = "The person cancelled. Nothing was done.";

export const unconfirmedResult = "This needs the person's confirmation, which is not available here. Nothing was done.";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

const ruleLine = (raw: unknown): string => {
  if (!isObject(raw)) return "";
  const field = text(raw.field);
  const value = text(raw.value);
  if (!FIELD_IDS.includes(field as FieldId)) return [field, text(raw.operator), value].filter(Boolean).join(" ");
  const rule = { field: field as FieldId, operator: text(raw.operator) as never, value };
  return [fieldSpec(rule.field).label, operatorLabel(rule), value].filter(Boolean).join(" ");
};

const ruleLines = (raw: unknown): string[] => {
  const set = isObject(raw) ? raw : {};
  const list = Array.isArray(raw) ? raw : Array.isArray(set.rules) ? set.rules : [];
  const lines = list.map(ruleLine).filter(Boolean);
  const match = text(set.match);
  return match !== "" && lines.length > 1 ? [`Match ${match} of:`, ...lines] : lines;
};

export const writeLines = ({ tool, arguments: args }: Write, names: Names = {}): string[] => {
  if (tool === moveTool) return [`Move ${names.issue ? `"${names.issue}"` : `issue ${text(args.taskID)}`} to step ${text(args.step)} of ${names.backlog ?? `backlog ${text(args.backlog)}`}`];
  if (tool === createTool) {
    const steps = Array.isArray(args.steps) ? args.steps.map((step) => text(isObject(step) ? step.name : step)).filter(Boolean) : [];
    return [`Create the backlog "${text(args.name)}"`, ...(steps.length > 0 ? [`Steps: ${steps.join(", ")}`] : []), ...ruleLines(args.rules)];
  }
  if (tool === rulesTool) return [`Change the rules of ${names.backlog ?? `backlog ${text(args.backlogID)}`} to:`, ...ruleLines(args.rules)];
  return [tool];
};

const attempt = async <T>(read: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await read();
  } catch {
    return undefined;
  }
};

const backlogIdOf = ({ tool, arguments: args }: Write) => text(tool === moveTool ? args.backlog : tool === rulesTool ? args.backlogID : "");

const issueTitle = async (id: string, held: Held, client: Pick<BacklogsClient, "issue">): Promise<string | undefined> => {
  const known = held.flatMap((list) => list.issues).find((issue) => issue.id === id);
  if (known) return known.title;
  return (await attempt(() => client.issue(id)))?.title;
};

export const nameWrite = async (write: Write, held: Held, client: Pick<BacklogsClient, "backlogs" | "issue">): Promise<Names> => {
  const issueId = write.tool === moveTool ? text(write.arguments.taskID) : "";
  const backlogId = backlogIdOf(write);
  const [issue, backlogs] = await Promise.all([issueId === "" ? undefined : issueTitle(issueId, held, client), backlogId === "" ? undefined : attempt(() => client.backlogs())]);
  const backlog = backlogs?.find((one) => one.id === backlogId)?.name;
  return { ...(issue ? { issue } : {}), ...(backlog ? { backlog } : {}) };
};
