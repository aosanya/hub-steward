import { callTool } from "../wakala/mcp";
import { itemsOf, taskTools } from "../backlogs/api";
import { draftOf, type ResultDraft } from "./results";

const leading = new Set(["show", "open", "display", "view", "see", "me", "my", "the", "a", "go", "to", "list", "smart", "backlog", "please"]);

const spelled = (words: string) => words.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const withoutLeading = (words: string[]) => {
  let from = 0;
  while (from < words.length && leading.has(words[from])) from += 1;
  return words.slice(from);
};

const trailing = new Set(["backlog", "please"]);

const withoutTrailing = (words: string[]) => {
  let to = words.length;
  while (to > 0 && trailing.has(words[to - 1])) to -= 1;
  return words.slice(0, to);
};

export const askedBacklog = (message: string, names: string[]): string | undefined => {
  const rest = withoutTrailing(withoutLeading(spelled(message).split(" "))).join(" ");
  if (rest === "") return undefined;
  const hits = names.filter((name) => spelled(name) === rest);
  return hits.length === 1 ? hits[0] : undefined;
};

export type Shown = { text: string; lists: ResultDraft[] };

type Named = { id: string; name: string };

const namedOf = (reply: unknown): Named[] =>
  itemsOf(reply)
    .map((item) => ({ id: typeof item?.id === "string" ? item.id : "", name: typeof item?.name === "string" ? item.name : "" }))
    .filter((item) => item.id !== "" && item.name !== "");

const viewOfBacklog = (backlog: Named): ResultDraft => ({ title: backlog.name, total: 0, issues: [], view: `backlog:${backlog.id}` });

const mentioned = (message: string, backlogs: Named[]): Named[] => {
  const words = ` ${spelled(message)} `;
  const found = backlogs
    .map((backlog) => ({ backlog, at: words.indexOf(` ${spelled(backlog.name)} `) }))
    .filter((hit) => hit.at >= 0 && spelled(hit.backlog.name) !== "");
  const outermost = found.filter((hit) => !found.some((other) => other !== hit && spelled(other.backlog.name).length > spelled(hit.backlog.name).length && spelled(other.backlog.name).includes(spelled(hit.backlog.name))));
  return outermost.sort((left, right) => left.at - right.at).map((hit) => hit.backlog);
};

export const backlogDraftsFor = (message: string, reply: unknown): ResultDraft[] => {
  const named = mentioned(message, namedOf(reply));
  if (named.length > 0) return named.map(viewOfBacklog);
  const asksForList = ` ${spelled(message)} `.includes(" backlogs ");
  const draft = asksForList ? draftOf(taskTools.backlogs, {}, reply) : null;
  return draft === null ? [] : [draft];
};

export const showNamedBacklog = async (message: string): Promise<Shown | undefined> => {
  try {
    const reply = await callTool("", taskTools.backlogs, {});
    const backlogs = namedOf(reply);
    const name = askedBacklog(message, backlogs.map((backlog) => backlog.name));
    const backlog = backlogs.find((one) => one.name === name);
    return backlog === undefined ? undefined : { text: `${backlog.name} is a backlog you can open. Tap Open on it below.`, lists: [viewOfBacklog(backlog)] };
  } catch {
    return undefined;
  }
};
