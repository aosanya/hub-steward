import { issueOf, itemsOf, taskTools, type Backlog, type Issue } from "../backlogs/api";
import { issuesPath } from "../backlogs/paths";
import { smartBacklogPath } from "../smartBacklog/paths";
import { splitOptions } from "./optionLines";

export type ListFilter = { tags: string[]; query: string; backlog: string; other: boolean; openOnly?: boolean };

export type ResultDraft = { title: string; total: number; issues: Issue[]; view?: string; filter?: ListFilter };

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

export const openAllWholeWords = "Open all issues";

export const openAllWholeNote = "Opens every issue, not only these.";

export const openAllWords = (total: number) => `Open all ${total} issues`;

export const openAllOpenOnlyWords = "Open these in the List";

export const openAllOpenOnlyNote = "The List also shows closed issues.";

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

const wordsOfKeys = (args: Record<string, unknown>, keys: string[]) => keys.flatMap((key) => [args[key]].flat().filter((word): word is string => typeof word === "string" && word.trim() !== "").map((word) => word.trim()));

const isSet = (value: unknown) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

const filterOf = (tool: string, args: Record<string, unknown>): ListFilter => ({
  tags: wordsOfKeys(args, ["tag", "repo"]),
  query: wordsOfKeys(args, ["q"]).join(" "),
  backlog: wordsOfKeys(args, ["backlog"])[0] ?? "",
  other: Object.entries(args).some(([key, value]) => ![...filterKeys, ...pagingKeys].includes(key) && isSet(value)) || isSet(args.step) || isSet(args.priority),
  openOnly: tool === pendingTool,
});

const isFiltered = (args: Record<string, unknown>) => Object.entries(args).some(([key, value]) => !pagingKeys.includes(key) && value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0));

export const labelOf = (list: ResultDraft) => `${list.title} · ${list.total}`;

export const draftOf = (tool: string, args: Record<string, unknown>, reply: unknown): ResultDraft | null => {
  if (tool === listTool || tool === pendingTool) {
    const issues = itemsOf(reply).map((raw) => issueOf(raw));
    const reported = isObject(reply) && typeof reply.total === "number" ? reply.total : issues.length;
    const unfiltered = !isFiltered(args);
    return { title: titleOf(tool, args), total: Math.max(reported, issues.length), issues, ...(unfiltered ? { view: allView } : {}), filter: filterOf(tool, args) };
  }
  if (tool === taskTools.backlogs) return { title: "Backlogs", total: itemsOf(reply).length, issues: [], view: backlogsView };
  if (tool === readTool && isObject(reply) && typeof reply.id === "string") {
    const issue = issueOf(reply);
    return { title: issue.title, total: 1, issues: [issue] };
  }
  return null;
};

export type OpenAll = { label: string; to: string; whole: boolean; note: string };

const sameWords = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

export const openAllTarget = (list: ResultDraft, backlogs: Backlog[]): OpenAll => {
  const whole: OpenAll = { label: openAllWholeWords, to: issuesPath(), whole: true, note: openAllWholeNote };
  const filter = list.filter;
  if (!filter || filter.other) return whole;
  const narrows = filter.tags.length > 0 || filter.query !== "" || filter.backlog !== "";
  if (filter.openOnly && !narrows) return whole;
  const label = filter.openOnly ? openAllOpenOnlyWords : openAllWords(list.total);
  const note = filter.openOnly ? openAllOpenOnlyNote : "";
  const found = (to: string): OpenAll => ({ label, to, whole: false, note });
  if (filter.backlog === "") return found(issuesPath("all", filter.tags, filter.query));
  const backlog = backlogs.find((one) => one.id === filter.backlog) ?? backlogs.find((one) => sameWords(one.name, filter.backlog));
  if (!backlog) return whole;
  if (backlog.kind === "smart") return !filter.openOnly && filter.tags.length === 0 && filter.query === "" ? found(smartBacklogPath(backlog.id)) : whole;
  return found(issuesPath(backlog.id, filter.tags, filter.query));
};

export const resultsOf = (items: { lists?: ResultList[] }[]): ResultList[] => [...items].reverse().flatMap((item) => item.lists ?? []);

const holds = (wide: ResultDraft, narrow: ResultDraft) => {
  const held = new Set(wide.issues.map((issue) => issue.id));
  return narrow.issues.length > 0 && narrow.issues.every((issue) => held.has(issue.id));
};

const replacedBy = (draft: ResultDraft, later: ResultDraft) =>
  (holds(draft, later) && (later.total < draft.total || (later.total === draft.total && later.issues.length >= draft.issues.length))) || (later.total === draft.total && holds(later, draft));

const shorterPageOf = (draft: ResultDraft, earlier: ResultDraft) => holds(earlier, draft) && earlier.total === draft.total && draft.issues.length < earlier.issues.length;

export const worthKeeping = (drafts: ResultDraft[]): ResultDraft[] =>
  drafts.filter((draft, at) => draft.issues.length > 0 && !drafts.slice(at + 1).some((later) => replacedBy(draft, later)) && !drafts.slice(0, at).some((earlier) => shorterPageOf(draft, earlier)));

export const withIds = (drafts: ResultDraft[], answerId: number): ResultList[] => worthKeeping(drafts).map((draft, index) => ({ ...draft, id: `${answerId}:${index}` }));

const countsAsked = (message: string): number[] => (message.match(/\b\d+\b/g) ?? []).map(Number);

export const askedCountFirst = (drafts: ResultDraft[], message: string): ResultDraft[] => {
  const counts = countsAsked(message);
  const asked = drafts.filter((draft) => draft.issues.length > 0 && counts.includes(draft.total));
  return asked.length === 0 ? drafts : [...asked, ...drafts.filter((draft) => !asked.includes(draft))];
};

export const viewsOf = (drafts: ResultDraft[]): string[] => [...new Set(drafts.flatMap((draft) => (draft.view ? [draft.view] : [])))];

export const questionOptions = (text: string, lists: ResultDraft[]): string[] => {
  const { text: words, options } = splitOptions(text);
  const found = lists[lists.length - 1];
  if (options.length > 0 || !words.endsWith("?") || !found) return [];
  const titles = [...new Set(found.issues.map((issue) => issue.title))];
  return titles.length >= 2 && titles.length <= optionLimit ? titles : [];
};
