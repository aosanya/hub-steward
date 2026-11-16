import { useState } from "react";
import { useWord, type Wording } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { SearchSelect } from "../../../../shared/ui/SearchSelect";
import { callTool, McpError } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { actionFailedWords } from "../../MenuDetail";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { budgetRow, homeEmpty, listOf, moneyWords, periodWords, text, tools, type Item } from "./financeData";

const managePermission = "accounting.manage";

const rolesTool = "agency_get_my_roles";

const accountListTool = "accounting_account_list";

const budgetSetTool = "accounting_budget_set";

const mayManage = async () => {
  const reply = (await callTool("", rolesTool)) as { permissions?: unknown } | null;
  return Array.isArray(reply?.permissions) && reply.permissions.includes(managePermission);
};

const refusalWords = (error: unknown) => {
  const message = error instanceof McpError ? error.message : "";
  const colon = message.indexOf(": ");
  const words = colon >= 0 ? message.slice(colon + 2) : message;
  return words || actionFailedWords;
};

const shareWords = (planned: number, spent: number) => (planned > 0 ? `${Math.round((spent / planned) * 100)}%` : "");

const tenderWords = (tender: Item) => [text(tender, "title"), text(tender, "status")].filter((word) => word !== "").join(" · ");

const loadLines = async () => (await listOf(tools.budgetList)).map(budgetRow);

const loadLine = async (id: string) => {
  const [line, tenders] = await Promise.all([callTool("", tools.budgetRead, { budgetID: id }) as Promise<Item | null>, listOf(tools.tenderList, { budget_id: id })]);
  const planned = Number(text(line, "planned")) || 0;
  const spent = Number(text(line, "spent")) || 0;
  return {
    id,
    account_id: text(line, "account_id"),
    period_start: text(line, "period_start"),
    period_end: text(line, "period_end"),
    amount: String(planned),
    name: text(line, "name"),
    department: text(line, "department"),
    period: periodWords(text(line, "period_start"), text(line, "period_end")),
    planned: moneyWords(planned),
    spent: moneyWords(spent),
    remaining: moneyWords(planned - spent),
    share: shareWords(planned, spent),
    tenders: tenders.map(tenderWords).join(", "),
  };
};

type Draft = { account: string; name: string; department: string; start: string; end: string; amount: string };

const blank: Draft = { account: "", name: "", department: "", start: "", end: "", amount: "" };

const accountChoices = async () =>
  (await listOf(accountListTool)).map((account) => ({ value: text(account, "id"), label: [text(account, "category"), text(account, "code")].filter((word) => word !== "").join(" ") }));

const complete = (draft: Draft) => draft.account !== "" && draft.name.trim() !== "" && draft.start !== "" && draft.end !== "" && Number(draft.amount) > 0;

const editFields: EditField[] = [
  { label: "Name", key: "name", required: true },
  { label: "Department", key: "department" },
  { label: "Planned amount", key: "amount", kind: "number", required: true },
];

const dayStart = (day: string) => `${day}T00:00:00Z`;

function AddLineForm({ onSaved, word }: { onSaved: () => void; word: Wording }) {
  const [draft, setDraft] = useState(blank);
  const [refused, setRefused] = useState("");
  const accounts = useLoad(accountChoices, `budget-accounts:${openAgencyId()}`);
  const set = (key: keyof Draft) => (value: string) => setDraft((was) => ({ ...was, [key]: value }));
  const save = async () => {
    setRefused("");
    try {
      await callTool("", budgetSetTool, {
        account_id: draft.account,
        name: draft.name.trim(),
        department: draft.department.trim(),
        period_start: dayStart(draft.start),
        period_end: dayStart(draft.end),
        amount: Number(draft.amount),
      });
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    }
  };
  return (
    <>
      <SearchSelect label="Account" choices={accounts.state === "ready" ? accounts.data : []} value={draft.account} onChange={set("account")} />
      <Field label="Name" value={draft.name} onChange={(event) => set("name")(event.target.value)} />
      <Field label="Department" value={draft.department} onChange={(event) => set("department")(event.target.value)} />
      <Field label="Period start" placeholder="2026-01-01" value={draft.start} onChange={(event) => set("start")(event.target.value)} />
      <Field label="Period end" placeholder="2026-12-31" value={draft.end} onChange={(event) => set("end")(event.target.value)} />
      <Field label="Amount" inputMode="decimal" value={draft.amount} onChange={(event) => set("amount")(event.target.value)} />
      <Button kind="primary" disabled={!complete(draft)} onClick={save}>Save {word("Budget line").toLowerCase()}</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function BudgetScreen() {
  const word = useWord("accounting");
  const [version, setVersion] = useState(0);
  const [edited, setEdited] = useState(0);
  const [adding, setAdding] = useState(false);
  const [count, setCount] = useState(0);
  const allowed = useLoad(mayManage, `may-manage-budget:${openAgencyId()}`);
  const may = allowed.state === "ready" && allowed.data;
  const addButton = may && !adding ? <Button kind="primary" onClick={() => setAdding(true)}>Add {word("Budget line").toLowerCase()}</Button> : null;
  const saved = () => {
    setAdding(false);
    setVersion((was) => was + 1);
  };
  const load = async () => {
    const lines = await loadLines();
    setCount(lines.length);
    return lines;
  };
  return (
    <MenuWindow
      key={version}
      title={word("Budget")}
      listKey={edited}
      detailKey={edited}
      list={{ title: word("Budget"), tool: tools.budgetList, load, fields: { title: "name", meta: "meta" }, empty: { ...homeEmpty(`No ${word("Budget lines").toLowerCase()} yet.`), children: addButton } }}
      detail={{
        tool: tools.budgetRead,
        load: loadLine,
        fields: { Name: "name", Department: "department", Period: "period", Planned: "planned", Spent: "spent", Remaining: "remaining", "Share spent": "share", Tenders: "tenders" },
        status: "status",
        extra: (line) => (
          <MenuEditForm
            item={line}
            id={String(line.account_id ?? "")}
            idArg="account_id"
            tool={budgetSetTool}
            permission={managePermission}
            fields={editFields}
            keep={["name", "department", "amount", "period_start", "period_end"]}
            onSaved={() => setEdited((was) => was + 1)}
          />
        ),
      }}
      above={may && adding ? <AddLineForm onSaved={saved} word={word} /> : count > 0 ? addButton : null}
    />
  );
}
