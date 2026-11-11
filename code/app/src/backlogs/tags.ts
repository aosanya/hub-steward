import type { ChipTone } from "../ui/Chip";
import type { Issue } from "./api";

export const tagsOf = (issue: Issue): string[] => [issue.mark, issue.repo, ...issue.topics, issue.backlog].filter((tag, at, all) => tag !== "" && all.indexOf(tag) === at);

export const withAllTags = (issues: Issue[], chosen: string[]) => issues.filter((issue) => chosen.every((tag) => tagsOf(issue).includes(tag)));

export const matchesQuery = (issue: Issue, query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word !== "");
  const text = [issue.title.replace(/[`*]/g, ""), ...tagsOf(issue)].join(" ").toLowerCase();
  return words.every((word) => text.includes(word));
};

export const narrowed = (issues: Issue[], chosen: string[], query: string) => withAllTags(issues, chosen).filter((issue) => matchesQuery(issue, query));

export const toggled = (chosen: string[], tag: string) => (chosen.includes(tag) ? chosen.filter((one) => one !== tag) : [...chosen, tag]);

export const toneOf = (tag: string): ChipTone | undefined => (tag === "Ready" ? "success" : tag === "Blocked" ? "danger" : undefined);

export const hueOf = (tag: string) => [...tag].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) % 360, 7);

export const chipLook = (tag: string) => {
  const tone = toneOf(tag);
  return tone ? { tone } : { hue: hueOf(tag) };
};

export const issuesWords = (count: number) => `${count} ${count === 1 ? "issue" : "issues"}`;

export const countWords = (shown: number, total: number, narrowed: boolean) =>
  narrowed ? `${shown} of ${issuesWords(total)}` : issuesWords(shown);
