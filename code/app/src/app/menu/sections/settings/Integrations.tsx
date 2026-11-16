import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuList } from "../../MenuList";

const loadServices = async () =>
  itemsOf(await callTool("", "ai_list_accounts")).map((account) => ({ id: account.id, provider: account.provider, state: account.key_set === true ? "Connected" : "Not connected" }));

export function Integrations() {
  const word = useWord();
  return <MenuList title={word("Integrations")} tool="ai_list_accounts" load={loadServices} fields={{ title: "provider", meta: "state" }} empty={{ words: "No services have been set up yet." }} />;
}
