import { useState } from "react";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { AddPaymentSheet } from "./AddPaymentSheet";
import { ActButton, ChatAboutFinance, EditAct, FactsCard, FinanceHead, useFinanceEdit } from "./FinanceRecord";
import { text, tools, type Item } from "./financeData";

export const manageRole = "accounting.manage";

const paymentLines = 10;

const editFields: EditField[] = [
  { label: "Payer", key: "payer" },
  { label: "Amount", key: "amount", kind: "number", required: true },
  { label: "Due date", key: "due_at", kind: "date" },
  { label: "Narration", key: "narration" },
];

const facts: [string, string][] = [
  ["Charge", "charge"],
  ["Amount", "amountWords"],
  ["Settled", "settled"],
  ["Outstanding", "outstanding"],
  ["Due", "due"],
  ["Late", "late"],
  ["Reminds", "reminds"],
  ["Narration", "narration"],
];

const paymentsOf = (bill: Item) => Array.from({ length: paymentLines }, (_, at) => text(bill, `payment${at + 1}`)).filter((line) => line !== "");

type Props = { bill: Item; back: string; reload: () => Promise<Item>; onSaved: () => void };

export function BillPage({ bill, back, reload, onSaved }: Props) {
  const edit = useFinanceEdit();
  const [adding, setAdding] = useState(false);
  const id = text(bill, "id");
  const status = text(bill, "status");
  const open = ["Open", "Overdue", "Late"].includes(status);
  const line = [status, text(bill, "late")].filter(Boolean).join(" · ");
  const payments = paymentsOf(bill).map((payment) => <ListRow key={payment} title={payment} />);
  return (
    <div className="person-page">
      <ChatAboutFinance about={{ kind: "bill", id, name: text(bill, "payer") }} back={`${back}?bill=${id}`} />
      <FinanceHead name={text(bill, "payer")} line={line} />
      <div className="sections">
        {edit.editing ? (
          <MenuEditForm
            item={bill}
            id={id}
            idArg="billID"
            tool={tools.billUpdate}
            permission={manageRole}
            fields={editFields}
            keep={["payer", "amount", "due_at", "narration"]}
            readAgain={reload}
            bare
            openCount={1}
            onSaved={() => {
              edit.stop();
              onSaved();
            }}
            onCancel={edit.stop}
          />
        ) : (
          <FactsCard word="Bill detail" item={bill} facts={facts} foot={<EditAct permission={manageRole} onEdit={edit.start} />} />
        )}
        <Section
          word="Payments"
          rows={payments}
          empty={{ words: "No payment yet." }}
          foot={open ? <ActButton permission={manageRole} label="Add payment" onAct={() => setAdding(true)} /> : null}
        />
        {adding ? (
          <AddPaymentSheet
            billID={text(bill, "billID")}
            outstanding={text(bill, "outstandingAmount")}
            onSaved={() => {
              setAdding(false);
              onSaved();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
