import { issueOf, type BacklogsClient } from "../backlogs/api";
import { optionLimit, type ResultDraft } from "./results";
import { fieldSpec, operatorLabel } from "../smartBacklog/fields";
import { FIELD_IDS, type FieldId } from "../smartBacklog/types";
import { rulesProblem } from "./ruleCodes";

export const moveTool = "taskmanager_task_move_to_step";

export const createTool = "taskmanager_backlog_create";

export const rulesTool = "taskmanager_backlog_rules_set";

export const writeNames = [moveTool, createTool, rulesTool];

export type Write = { tool: string; arguments: Record<string, unknown> };

export type Names = { issue?: string; backlog?: string; step?: string };

export type Held = { issues: { id: string; key?: string; title: string }[] }[];

export type Confirm = (write: Write, seen?: ResultDraft[]) => Promise<boolean>;

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
  if (tool === moveTool) return [`Move ${names.issue ? `"${names.issue}"` : `issue ${text(args.taskID)}`} to step ${names.step ?? text(args.step)} of ${names.backlog ?? `backlog ${text(args.backlog)}`}`];
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
  const known = held.flatMap((list) => list.issues).find((issue) => issue.id === id || issue.key === id);
  if (known) return known.title;
  return (await attempt(() => client.issue(id)))?.title;
};

const spelled = (words: string) => words.trim().toLowerCase().replace(/[-_\s]+/g, " ");

const stepNameOf = (steps: string[] | undefined, asked: string): string | undefined => (asked === "" ? undefined : steps?.find((name) => spelled(name) === spelled(asked)));

export const writeProblem = ({ tool, arguments: args }: Write): string => (tool === createTool || tool === rulesTool ? rulesProblem(args.rules) : "");

export const nameWrite = async (write: Write, held: Held, client: Pick<BacklogsClient, "backlogs" | "issue">): Promise<Names> => {
  const issueId = write.tool === moveTool ? text(write.arguments.taskID) : "";
  const backlogId = backlogIdOf(write);
  const [issue, backlogs] = await Promise.all([issueId === "" ? undefined : issueTitle(issueId, held, client), backlogId === "" ? undefined : attempt(() => client.backlogs())]);
  const found = backlogs?.find((one) => one.id === backlogId) ?? backlogs?.find((one) => backlogId !== "" && spelled(one.name) === spelled(backlogId));
  const step = write.tool === moveTool ? stepNameOf(found?.steps, text(write.arguments.step)) : undefined;
  return { ...(issue ? { issue } : {}), ...(found?.name ? { backlog: found.name } : {}), ...(step ? { step } : {}) };
};

const keyShaped = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

export type FoundIssue = { id: string; title: string };

export type FindIssues = (words: string) => Promise<FoundIssue[]>;

export type ReadIssue = (id: string) => Promise<FoundIssue | undefined>;

export type Resolved = { write: Write; seen: ResultDraft[]; problem: string };

const swapped = (write: Write, id: string): Write => ({ ...write, arguments: { ...write.arguments, taskID: id } });

const withIssue = (seen: ResultDraft[], found: FoundIssue): ResultDraft[] => [...seen, { title: found.title, total: 1, issues: [issueOf({ id: found.id, title: found.title })] }];

const namedBy = (said: string, issue: { key?: string; title: string }) => {
  const words = said.toLowerCase();
  return words.includes(issue.title.toLowerCase()) || (issue.key !== undefined && words.includes(issue.key.toLowerCase()));
};

const tooManyFit = (asked: string, seen: ResultDraft[], said: string): string => {
  const list = seen.find((one) => one.total > optionLimit && (one.filter?.query ?? "") !== "" && one.issues.some((issue) => issue.id === asked || issue.key?.toLowerCase() === asked.toLowerCase()));
  const issue = list?.issues.find((one) => one.id === asked || one.key?.toLowerCase() === asked.toLowerCase());
  if (!list || !issue || namedBy(said, issue)) return "";
  return `${list.total} issues fit "${list.filter?.query}", so no issue was chosen. Ask the person in one plain sentence for a narrower word from the title, like a number, and offer no choices.`;
};

export const resolveMove = async (write: Write, seen: ResultDraft[], find: FindIssues, read: ReadIssue, said = ""): Promise<Resolved> => {
  const asked = write.tool === moveTool ? text(write.arguments.taskID) : "";
  const unchanged = { write, seen, problem: "" };
  if (asked === "") return unchanged;
  const crowded = tooManyFit(asked, seen, said);
  if (crowded !== "") return { ...unchanged, problem: crowded };
  const known = seen.flatMap((list) => list.issues);
  if (!keyShaped.test(asked)) {
    if (known.some((issue) => issue.id === asked)) return unchanged;
    const found = await attempt(() => read(asked));
    return found ? { ...unchanged, seen: withIssue(seen, found) } : unchanged;
  }
  const held = known.find((issue) => issue.key?.toLowerCase() === asked.toLowerCase());
  if (held) return { ...unchanged, write: swapped(write, held.id) };
  const matches = await attempt(() => find(asked));
  if (matches === undefined) return unchanged;
  const hit = matches.find((issue) => issue.title.toLowerCase().split(/\s+/).includes(asked.toLowerCase()));
  return hit ? { write: swapped(write, hit.id), seen: withIssue(seen, hit), problem: "" } : { ...unchanged, problem: `I could not find ${asked}.` };
};
