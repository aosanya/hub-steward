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

export const showNamedBacklog = async (message: string): Promise<Shown | undefined> => {
  try {
    const reply = await callTool("", taskTools.backlogs, {});
    const names: string[] = itemsOf(reply).map((item) => (typeof item?.name === "string" ? item.name : "")).filter((name) => name !== "");
    const name = askedBacklog(message, names);
    const draft = name === undefined ? null : draftOf(taskTools.backlogs, {}, reply);
    return name === undefined || draft === null ? undefined : { text: `${name} is a backlog you can open. Tap Open on it below.`, lists: [draft] };
  } catch {
    return undefined;
  }
};
