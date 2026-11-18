import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";

type Item = Record<string, unknown>;

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const statusesOf = async (raisedBy: string): Promise<[string, string][]> => {
  try {
    const rows = itemsOf(await callTool("", "forms_catalog_raised_item_list_of_person", { raised_by: raisedBy })) as Item[];
    return rows.map((row) => [text(row, "id"), text(row, "status")]);
  } catch {
    return [];
  }
};

export const withStatus = async (issues: Item[]): Promise<Item[]> => {
  const raisers = [...new Set(issues.filter((issue) => !text(issue, "status")).map((issue) => text(issue, "raised_by")).filter(Boolean))];
  if (raisers.length === 0) return issues;
  const known = new Map((await Promise.all(raisers.map(statusesOf))).flat());
  return issues.map((issue) => (text(issue, "status") ? issue : { ...issue, status: known.get(text(issue, "id")) ?? "" }));
};
