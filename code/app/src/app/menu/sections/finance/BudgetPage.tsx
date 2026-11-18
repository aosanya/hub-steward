import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { ChatAboutFinance, EditAct, FactsCard, FinanceHead, useFinanceEdit } from "./FinanceRecord";
import { parsedShares } from "./costShares";
import { text, type Item } from "./financeData";

export const budgetManage = "accounting.manage";

export const budgetSetTool = "accounting_budget_set";

const editFields: EditField[] = [
  { label: "Name", key: "name", required: true },
  { label: "Department", key: "department" },
  { label: "Planned amount", key: "amount", kind: "number", required: true },
  { label: "Follow milestones", key: "follow", choices: [{ value: "off", label: "Off" }, { value: "on", label: "On" }] },
  { label: "Cost", key: "cost", choices: [{ value: "one", label: "Counted in one" }, { value: "shared", label: "Shared" }] },
  { label: "Cost shares", key: "shares", kind: "lines" },
];

const budgetArguments = (line: Item, sent: Record<string, unknown>) => {
  const current = (key: string) => (key in sent ? sent[key] : line[key]);
  return {
    account_id: line.account_id,
    name: current("name"),
    department: current("department"),
    amount: Number(current("amount")),
    period_start: line.period_start,
    period_end: line.period_end,
    follow_milestones: current("follow") === "on",
    cost_shares: current("cost") === "shared" ? parsedShares(current("shares")) : {},
  };
};

const figures: [string, string][] = [
  ["Department", "department"],
  ["Planned", "planned"],
  ["Spent", "spent"],
  ["Remaining", "remaining"],
  ["Share spent", "share"],
  ["Cost shared", "cost_words"],
];

const progress: [string, string][] = [
  ["Tenders", "tenders"],
  ["Milestones", "milestones"],
  ["Payment certificates", "certificates"],
];

type Props = { line: Item; back: string; onSaved: () => void };

export function BudgetPage({ line, back, onSaved }: Props) {
  const edit = useFinanceEdit();
  const id = text(line, "id");
  const quiet = [text(line, "period"), text(line, "share") ? `${text(line, "share")} spent` : ""].filter(Boolean).join(" · ");
  return (
    <div className="person-page">
      <ChatAboutFinance about={{ kind: "budget", id, name: text(line, "name") }} back={`${back}?line=${id}`} />
      <FinanceHead name={text(line, "name")} line={quiet} />
      <div className="sections">
        {edit.editing ? (
          <MenuEditForm
            item={line}
            id={String(line.account_id ?? "")}
            idArg="account_id"
            tool={budgetSetTool}
            permission={budgetManage}
            fields={editFields}
            build={(sent) => budgetArguments(line, sent)}
            bare
            openCount={1}
            onSaved={() => {
              edit.stop();
              onSaved();
            }}
            onCancel={edit.stop}
          />
        ) : (
          <FactsCard word="Budget line" item={line} facts={figures} foot={<EditAct permission={budgetManage} onEdit={edit.start} />} />
        )}
        <FactsCard word="Progress" item={line} facts={progress} />
      </div>
    </div>
  );
}
