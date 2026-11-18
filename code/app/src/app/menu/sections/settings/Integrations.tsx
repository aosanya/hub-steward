import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { settingsPaths } from "./paths";
import { ChatAboutItem, FactsCard, RecordPage, text as shown, useChosenItem } from "./RecordPage";

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
  const startAt = useChosenItem();
  return (
    <MenuWindow
      title={word("Integrations")}
      withTabs
      bandless
      startAt={startAt}
      list={{ title: word("Integrations"), tool: "ai_list_accounts", load: loadAccounts, fields: { title: "name", meta: "state" }, empty: { words: "No services have been set up yet." } }}
      detail={{ tool: "ai_get_account", load: loadAccount, fields: {}, status: "",
        extra: (account) => (
          <>
            <ChatAboutItem about={{ kind: "integration", id: shown(account, "id"), name: shown(account, "name"), extra: { details: [shown(account, "provider"), shown(account, "state"), shown(account, "limits")].filter(Boolean).join("; ") } }} back={settingsPaths.integrations.path()} />
            <RecordPage name={shown(account, "name")} line={shown(account, "state")}>
              <FactsCard word="Integration" facts={[["Provider", shown(account, "provider")], ["Address", shown(account, "address")], ["Model", shown(account, "model")], ["Status", shown(account, "state")], ["Limits", shown(account, "limits")]]} />
            </RecordPage>
          </>
        ),
      }}
    />
  );
}
