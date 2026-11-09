import { issueOf, itemsOf, type Issue } from "../backlogs/api";

export type ResultDraft = { title: string; total: number; issues: Issue[] };

export type ResultList = ResultDraft & { id: string };

export const pendingTool = "taskmanager_task_pending";

export const listTool = "taskmanager_task_list";

export const readTool = "taskmanager_task_read";

export const chatTabWords = "Chat";

export const assistantBackWords = "Hub Steward";

export const resultsTabWords = "Results";

export const newResultsWords = "New results";

export const emptyResultsWords = "Results appear here";

export const showMoreWords = "Show more";

export const pageSize = 50;

const filterKeys = ["tag", "repo", "backlog", "step", "priority", "q"];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const wordsOf = (args: Record<string, unknown>) => filterKeys.flatMap((key) => [args[key]].flat().filter((word): word is string => typeof word === "string" && word.trim() !== "").map((word) => word.trim()));

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

export const titleOf = (tool: string, args: Record<string, unknown>) => {
  const words = wordsOf(args).join(" ");
  if (tool === pendingTool) return words === "" ? "Pending issues" : `Pending ${words} issues`;
  return words === "" ? "Issues" : capital(`${words} issues`);
};

export const labelOf = (list: ResultDraft) => `${list.title} · ${list.total}`;

export const draftOf = (tool: string, args: Record<string, unknown>, reply: unknown): ResultDraft | null => {
  if (tool === listTool || tool === pendingTool) {
    const issues = itemsOf(reply).map((raw) => issueOf(raw));
    const reported = isObject(reply) && typeof reply.total === "number" ? reply.total : issues.length;
    return { title: titleOf(tool, args), total: Math.max(reported, issues.length), issues };
  }
  if (tool === readTool && isObject(reply) && typeof reply.id === "string") {
    const issue = issueOf(reply);
    return { title: issue.title, total: 1, issues: [issue] };
  }
  return null;
};

export const resultsOf = (items: { lists?: ResultList[] }[]): ResultList[] => [...items].reverse().flatMap((item) => item.lists ?? []);

const sameItems = (draft: ResultDraft) => `${draft.title}|${draft.total}|${draft.issues.map((issue) => issue.id).join(",")}`;

export const worthKeeping = (drafts: ResultDraft[]): ResultDraft[] => {
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    const key = sameItems(draft);
    if (draft.issues.length === 0 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const withIds = (drafts: ResultDraft[], answerId: number): ResultList[] => worthKeeping(drafts).map((draft, index) => ({ ...draft, id: `${answerId}:${index}` }));
