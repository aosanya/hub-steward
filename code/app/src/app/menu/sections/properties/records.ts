import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";

export const digitaltwinModule = "digitaltwin";

export const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const joined = (parts: string[], separator = " · ") => parts.filter(Boolean).join(separator);

export const dayOf = (stamp: unknown) => textOf(stamp).slice(0, 10);

export const loadRecords = async (tool: string, row: (record: Record<string, unknown>) => Record<string, string>) => {
  const records: Record<string, unknown>[] = itemsOf(await callTool("", tool));
  return records.map((record) => ({ id: textOf(record.id), ...row(record) }));
};
