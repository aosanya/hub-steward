import { McpError } from "../../../../shared/wakala/mcp";

export type Shares = Record<string, number>;

const shareLine = /^(.+?)\s+(\d+)\s*%?$/;

const badLineWords = "Write each share as a neighbourhood and a percent, such as Óváros 60";

export const sharesOf = (value: unknown): Shares => {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
};

export const shareLinesOf = (shares: Shares) => Object.entries(shares).map(([name, percent]) => `${name} ${percent}`);

export const shareWordsOf = (shares: Shares) =>
  Object.entries(shares)
    .map(([name, percent]) => `${name} ${percent}%`)
    .join(", ");

export const parsedShares = (lines: unknown): Shares => {
  const entries = (Array.isArray(lines) ? lines : []).map((line) => String(line).match(shareLine));
  if (entries.length === 0 || entries.some((entry) => entry === null)) throw new McpError(badLineWords);
  return Object.fromEntries(entries.map((entry) => [entry![1].trim(), Number(entry![2])]));
};
