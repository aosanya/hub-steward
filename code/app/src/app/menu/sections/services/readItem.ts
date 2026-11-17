import { callTool } from "../../../../shared/wakala/mcp";
import type { Item } from "../staff/staffData";

export const readItem = async (tool: string, args: Record<string, unknown>): Promise<Item> => {
  try {
    const reply = (await callTool("", tool, args)) as { item?: unknown } | null;
    const inner = reply?.item ?? reply;
    return inner && typeof inner === "object" ? (inner as Item) : {};
  } catch {
    return {};
  }
};
