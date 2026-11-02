import { callTool } from "../wakala/mcp";
import { itemsOf, text } from "./modelLimits";

export const listChatModelsTool = "ai_list_chat_models";

export const pickChatModelTool = "ai_pick_chat_model";

const pending = new Map<string, Promise<boolean>>();

export async function pickedChatModel(hubId: string): Promise<string> {
  try {
    const listed = itemsOf(await callTool(hubId, listChatModelsTool));
    return text(listed.find((model) => model.picked === true)?.id);
  } catch {
    return "";
  }
}

async function sendPick(hubId: string, accountId: string): Promise<boolean> {
  try {
    await callTool(hubId, pickChatModelTool, { account_id: accountId });
    return true;
  } catch {
    return false;
  }
}

export function keepChatModelPick(hubId: string, accountId: string): Promise<boolean> {
  const kept = (pending.get(hubId) ?? Promise.resolve(true)).then(() => sendPick(hubId, accountId));
  pending.set(hubId, kept);
  return kept;
}
