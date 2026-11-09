import type { ChipTone } from "../ui/Chip";
import type { Issue } from "./api";

export const tagsOf = (issue: Issue): string[] => [issue.mark, issue.repo, ...issue.topics, issue.backlog].filter((tag, at, all) => tag !== "" && all.indexOf(tag) === at);

export const withAllTags = (issues: Issue[], chosen: string[]) => issues.filter((issue) => chosen.every((tag) => tagsOf(issue).includes(tag)));

export const toggled = (chosen: string[], tag: string) => (chosen.includes(tag) ? chosen.filter((one) => one !== tag) : [...chosen, tag]);

export const toneOf = (tag: string, issue: Issue): ChipTone | undefined =>
  tag === "Ready" ? "success" : tag === "Blocked" ? "danger" : tag === issue.backlog ? "accent" : undefined;

export const countWords = (shown: number, total: number, narrowed: boolean) =>
  `${shown} ${shown === 1 ? "issue" : "issues"}${narrowed ? ` of ${total}` : ""}`;
