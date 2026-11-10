import { issueOf, itemsOf, taskTools, type Issue } from "../backlogs/api";
import { splitOptions } from "./optionLines";

export type ResultDraft = { title: string; total: number; issues: Issue[]; view?: string };

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

const pagingKeys = ["limit", "offset", "page", "cursor"];

export const allView = "all";

export const backlogsView = "backlogs";

export const optionLimit = 6;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const wordsOf = (args: Record<string, unknown>) => filterKeys.flatMap((key) => [args[key]].flat().filter((word): word is string => typeof word === "string" && word.trim() !== "").map((word) => word.trim()));

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

export const titleOf = (tool: string, args: Record<string, unknown>) => {
  const words = wordsOf(args).join(" ");
  if (tool === pendingTool) return words === "" ? "Pending issues" : `Pending ${words} issues`;
  return words === "" ? "Issues" : capital(`${words} issues`);
};

const isFiltered = (args: Record<string, unknown>) => Object.entries(args).some(([key, value]) => !pagingKeys.includes(key) && value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0));

export const labelOf = (list: ResultDraft) => `${list.title} · ${list.total}`;

export const draftOf = (tool: string, args: Record<string, unknown>, reply: unknown): ResultDraft | null => {
  if (tool === listTool || tool === pendingTool) {
    const issues = itemsOf(reply).map((raw) => issueOf(raw));
    const reported = isObject(reply) && typeof reply.total === "number" ? reply.total : issues.length;
    const unfiltered = !isFiltered(args);
    return { title: titleOf(tool, args), total: Math.max(reported, issues.length), issues, ...(unfiltered ? { view: allView } : {}) };
  }
  if (tool === taskTools.backlogs) return { title: "Backlogs", total: itemsOf(reply).length, issues: [], view: backlogsView };
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

export const viewsOf = (drafts: ResultDraft[]): string[] => [...new Set(drafts.flatMap((draft) => (draft.view ? [draft.view] : [])))];

export const questionOptions = (text: string, lists: ResultDraft[]): string[] => {
  const { text: words, options } = splitOptions(text);
  const found = lists[lists.length - 1];
  if (options.length > 0 || !words.endsWith("?") || !found) return [];
  const titles = [...new Set(found.issues.map((issue) => issue.title))];
  return titles.length >= 2 && titles.length <= optionLimit ? titles : [];
};
