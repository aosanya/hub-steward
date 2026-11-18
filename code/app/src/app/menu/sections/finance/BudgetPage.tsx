import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { ChatAboutFinance, EditAct, FactsCard, FinanceHead, useFinanceEdit } from "./FinanceRecord";
import { text, type Item } from "./financeData";

export const budgetManage = "accounting.manage";

export const budgetSetTool = "accounting_budget_set";

const editFields: EditField[] = [
  { label: "Name", key: "name", required: true },
  { label: "Department", key: "department" },
  { label: "Planned amount", key: "amount", kind: "number", required: true },
];

const figures: [string, string][] = [
  ["Department", "department"],
  ["Planned", "planned"],
  ["Spent", "spent"],
  ["Remaining", "remaining"],
  ["Share spent", "share"],
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
            keep={["name", "department", "amount", "period_start", "period_end"]}
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
