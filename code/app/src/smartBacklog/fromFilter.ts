import type { Draft } from "./rulesDraft";
import type { Rule } from "./types";

const marks = ["Ready", "Blocked"];

export const ruleOfTag = (tag: string, backlogs: string[]): Rule =>
  marks.includes(tag) ? { field: "mark", operator: "is", value: tag } : backlogs.includes(tag) ? { field: "backlog", operator: "is", value: tag } : { field: "tag", operator: "has", value: tag };

export const wordsOf = (query: string): string[] => query.split(/\s+/).filter((word) => word !== "");

export const filterName = (chosen: string[], query: string): string => [...chosen, ...(query.trim() === "" ? [] : [`"${query.trim()}"`])].join(" ");

export const filterDraft = (chosen: string[], query: string, backlogs: string[]): Draft => ({
  name: filterName(chosen, query),
  match: "all",
  rules: [...chosen.map((tag) => ruleOfTag(tag, backlogs)), ...wordsOf(query).map((word): Rule => ({ field: "title", operator: "contains", value: word }))],
});
