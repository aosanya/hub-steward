import { callTool } from "../wakala/mcp";
import { itemsOf, textOf } from "./pages/groups";

export async function permissionNames(hubId: string): Promise<Map<string, string>> {
  try {
    const list = await callTool<unknown>(hubId, "agency_list_permissions");
    return new Map(itemsOf(list).map((item) => [textOf(item, "code"), textOf(item, "name")]));
  } catch {
    return new Map();
  }
}
