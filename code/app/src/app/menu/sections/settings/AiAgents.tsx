import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { settingsPaths } from "./paths";
import { ChatAboutItem, useChosenItem } from "./RecordPage";
import { FactsCard, type Fact } from "../../FactsCard";
import { labelOf } from "./personLabel";
import { PageFrame } from "../../PageFrame";
import { SectionGo } from "../residents/SectionAct";
import { agentLimitFields, everyoneId as everyone, limitsPermission } from "./aiLimits";

type Record_ = Record<string, unknown>;


const number = (value: unknown) => (typeof value === "number" ? value : 0);

const grouped = (value: number) => value.toLocaleString("en");

const text = (record: Record_, key: string) => (typeof record[key] === "string" ? (record[key] as string) : "");

const limitsOf = (record: Record_) => {
  const set = agentLimitFields.filter(([key]) => number(record[key]) > 0);
  return set.length === 0 ? "No limits set" : set.map(([key, label]) => `${label} ${grouped(number(record[key]))}`).join("; ");
};

const ifAllowed = async <T,>(read: () => Promise<T>, otherwise: T) => {
  try {
    return await read();
  } catch {
    return otherwise;
  }
};

const tokensOf = (row: Record_) => number(row.tokens_in) + number(row.tokens_out);

const rowsOf = (answer: unknown) => (Array.isArray((answer as Record_ | null)?.rows) ? ((answer as Record_).rows as Record_[]) : []);

const seeCodes = (code: string) => /\.(view|read|list)$/.test(code);

const wordsOf = (codes: string[], names: Map<string, string>) => codes.map((code) => names.get(code) ?? code).join("; ");

const permissionsOf = async (seatId: string) => {
  if (!seatId) return { see: "", change: "" };
  const seat = (await ifAllowed(() => callTool("", "agency_get_role", { role_id: seatId }), null)) as Record_ | null;
  const codes = Array.isArray(seat?.permissions) ? (seat?.permissions as string[]) : [];
  if (codes.length === 0) return { see: "", change: "" };
  const vocabulary = itemsOf(await ifAllowed(() => callTool("", "agency_list_permissions"), { items: [] }));
  const names = new Map(vocabulary.map((entry) => [text(entry, "code"), text(entry, "name")]));
  return { see: wordsOf(codes.filter(seeCodes), names), change: wordsOf(codes.filter((code) => !seeCodes(code)), names) };
};

const peopleNames = async () =>
  new Map(itemsOf(await ifAllowed(() => callTool("", "actor_list_actors"), { items: [] })).map((person) => [text(person, "id"), labelOf(person)] as const));

const usedBy = (rows: Record_[], key: string, names: Map<string, string>) => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const who = text(row, key);
    const named = names.get(who) ?? who;
    if (named) totals.set(named, (totals.get(named) ?? 0) + tokensOf(row));
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([who, tokens]) => `${who} ${grouped(tokens)}`).join("; ");
};

const loadRows = async () => {
  const agents = itemsOf(await callTool("", "ai_list_roles")).map((agent) => ({ id: text(agent, "id"), name: text(agent, "name"), state: text(agent, "status") }));
  return [{ id: everyone, name: "Each person", state: "Day and month" }, ...agents];
};

const loadPeople = async () => {
  const limits = (await ifAllowed(() => callTool("", "ai_get_assistant_limits"), {})) as Record_;
  const [month, names] = await Promise.all([ifAllowed(() => callTool("", "ai_usage_breakdown", { window: "month", group_by: "person" }), { rows: [] }), peopleNames()]);
  const perDay = (value: unknown) => (number(value) > 0 ? grouped(number(value)) : "No limit");
  return {
    id: everyone,
    name: "Each person",
    day: perDay(limits.tokens_per_person_day),
    month: perDay(limits.tokens_per_person_month),
    ownerDay: perDay(limits.owner_tokens_per_person_day),
    ownerMonth: perDay(limits.owner_tokens_per_person_month),
    usedByPerson: usedBy(rowsOf(month), "person", names) || "Nobody has used it this month",
  };
};

const loadAgent = async (id: string) => {
  if (id === everyone) return loadPeople();
  const agent = (itemsOf(await callTool("", "ai_list_roles")).find((entry) => text(entry, "id") === id) ?? {}) as Record_;
  const [permissions, account, month, names] = await Promise.all([
    permissionsOf(text(agent, "agency_role_id")),
    ifAllowed(() => callTool("", "ai_get_account", { accountID: text(agent, "account_id") }), {}) as Promise<Record_>,
    ifAllowed(() => callTool("", "ai_usage_breakdown", { window: "month", role_id: id }), { rows: [] }),
    peopleNames(),
  ]);
  const rows = rowsOf(month);
  const spent = rows.reduce((sum, row) => sum + tokensOf(row), 0);
  return {
    id,
    name: text(agent, "name"),
    description: text(agent, "description"),
    state: text(agent, "status"),
    see: permissions.see || "Nothing it may see",
    change: permissions.change || "Nothing it may change",
    limits: limitsOf(agent),
    account: text(account, "name"),
    accountLimits: text(account, "name") ? limitsOf(account) : "",
    used: rows.length === 0 ? "Nothing this month" : `${grouped(spent)} tokens in ${grouped(rows.reduce((sum, row) => sum + number(row.requests), 0))} requests this month`,
    usedBy: usedBy(rows, "person", names),
  };
};

const factsOf = (agent: Record_, labels: [string, string][]): Fact[] => labels.map(([label, key]) => [label, text(agent, key)]);

const doLabels: [string, string][] = [["May see", "see"], ["May change", "change"]];

const limitLabelsOnPage: [string, string][] = [["Its limits", "limits"], ["Account", "account"], ["Account limits", "accountLimits"], ["Each person a day", "day"], ["Each person a month", "month"], ["The owner a day", "ownerDay"], ["The owner a month", "ownerMonth"]];

const useLabels: [string, string][] = [["Used this month", "used"], ["Used by", "usedBy"], ["Used by each person this month", "usedByPerson"]];

export function AiAgents() {
  const word = useWord();
  const startAt = useChosenItem();
  return (
    <MenuWindow
      title={word("AI Agents & Limits")}
      withTabs
      bandless
      startAt={startAt}
      list={{ title: word("AI Agents & Limits"), tool: "ai_list_roles", load: loadRows, fields: { title: "name", meta: "state" }, empty: { words: "No AI agents have been set up yet." } }}
      detail={{ tool: "ai_list_roles", load: loadAgent, fields: {}, status: "",
        extra: (agent) => (
          <>
            <ChatAboutItem about={{ kind: "ai-agent", id: text(agent, "id") === everyone ? "" : text(agent, "id"), name: text(agent, "name"), extra: { details: [text(agent, "description"), text(agent, "limits")].filter(Boolean).join("; ") } }} back={settingsPaths.aiAgents.path()} />
            <PageFrame title={text(agent, "name")} line={text(agent, "state") || text(agent, "description")}>
              <FactsCard word="What it may do" facts={factsOf(agent, doLabels)} />
              <FactsCard word="Limits" facts={factsOf(agent, limitLabelsOnPage)} foot={<SectionGo permission={limitsPermission(text(agent, "id"))} act="Edit limits" to={settingsPaths.aiAgentEdit.path({ id: text(agent, "id") })} />} />
              <FactsCard word="Use" facts={factsOf(agent, useLabels)} />
            </PageFrame>
          </>
        ),
      }}
    />
  );
}
