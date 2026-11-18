import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";

type Account = Record<string, unknown>;

const limitLabels: [string, string][] = [
  ["tokens_per_call", "Tokens per call"],
  ["tokens_per_day", "Tokens per day"],
  ["tokens_per_week", "Tokens per week"],
  ["tokens_per_month", "Tokens per month"],
  ["requests_per_minute", "Requests per minute"],
  ["requests_per_day", "Requests per day"],
  ["requests_per_week", "Requests per week"],
  ["tokens_per_test", "Tokens per test"],
  ["scenarios_at_once", "Scenarios at once"],
];

const textOf = (account: Account, key: string) => (typeof account[key] === "string" ? (account[key] as string) : "");

const stateOf = (account: Account) => (account.key_set === true ? "Connected" : "Not connected");

const limitsOf = (account: Account) => {
  const set = limitLabels.filter(([key]) => typeof account[key] === "number" && (account[key] as number) > 0);
  return set.length === 0 ? "No limits set" : set.map(([key, label]) => `${label} ${(account[key] as number).toLocaleString("en")}`).join("; ");
};

const nameOf = (account: Account) => textOf(account, "name") || textOf(account, "provider");

const loadAccounts = async () => itemsOf(await callTool("", "ai_list_accounts")).map((account) => ({ id: account.id, name: nameOf(account), state: stateOf(account) }));

const loadAccount = async (id: string) => {
  const account = await readAccount(id);
  return {
    id,
    name: nameOf(account),
    provider: textOf(account, "provider"),
    address: textOf(account, "base_url"),
    model: textOf(account, "model_name"),
    state: stateOf(account),
    limits: limitsOf(account),
  };
};

const readAccount = async (id: string): Promise<Account> => {
  try {
    return (await callTool("", "ai_get_account", { accountID: id })) as Account;
  } catch {
    return (itemsOf(await callTool("", "ai_list_accounts")).find((account) => account.id === id) ?? {}) as Account;
  }
};

export function Integrations() {
  const word = useWord();
  return (
    <MenuWindow
      title={word("Integrations")}
      list={{ title: word("Integrations"), tool: "ai_list_accounts", load: loadAccounts, fields: { title: "name", meta: "state" }, empty: { words: "No services have been set up yet." } }}
      detail={{ tool: "ai_get_account", load: loadAccount, fields: { Name: "name", Provider: "provider", Address: "address", Model: "model", Status: "state", Limits: "limits" }, status: "state" }}
    />
  );
}
