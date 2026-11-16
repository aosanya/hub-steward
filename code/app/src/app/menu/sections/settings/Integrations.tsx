import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuList } from "../../MenuList";

const loadServices = async () =>
  itemsOf(await callTool("", "ai_list_accounts")).map((account) => ({ id: account.id, provider: account.provider, state: account.key_set === true ? "Connected" : "Not connected" }));

export function Integrations() {
  return <MenuList title="Integrations" tool="ai_list_accounts" load={loadServices} fields={{ title: "provider", meta: "state" }} empty={{ words: "No services have been set up yet." }} />;
}
