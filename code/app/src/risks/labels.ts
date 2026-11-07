import type { Words } from "../entry/words";

const camel = (value: string) => value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");

export const labelOf = (words: Words, prefix: string, value: string) => (words as Record<string, string>)[`${prefix}${camel(value)}`] ?? value;

export const filled = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));

export const standingTone = (standing: string) =>
  standing === "proven" ? "success" : standing === "failing" ? "danger" : standing === "weak" ? "info" : undefined;
