import { callTool } from "../wakala/mcp";
import { itemsOf, text } from "./modelLimits";

const fromProvider = "provider";
const emptyListWords = "the provider listed no model";

export async function keyModels(hubId: string, accountId: string): Promise<string[]> {
  const listed = itemsOf(await callTool(hubId, "ai_refresh_models", { accountID: accountId }));
  const names = listed
    .filter((entry) => text(entry.source) === fromProvider)
    .map((entry) => text(entry.model_name))
    .filter((name) => name !== "");
  if (names.length === 0) throw new Error(emptyListWords);
  return [...new Set(names)];
}
