import type { ReactNode } from "react";
import { manageRole } from "./BillPage";
import { ActButton, ChatAboutFinance, FactsCard, FinanceHead } from "./FinanceRecord";
import { text, type Item } from "./financeData";
import { financePaths } from "./paths";

const owedFacts: [string, string][] = [
  ["Charge", "charge"],
  ["Outstanding", "outstanding"],
  ["Due", "due"],
  ["Late", "late"],
];

const paidFacts: [string, string][] = [
  ["Amount", "amount"],
  ["Paid on", "paidOn"],
  ["Narration", "narration"],
  ["Bill", "bill"],
];

type Props = { row: Item; owed: boolean; onMark: () => void; form: ReactNode };

export function PaymentPage({ row, owed, onMark, form }: Props) {
  const payer = text(row, "payer");
  const billID = owed ? text(row, "billID") : text(row, "settledBillID");
  const line = [text(row, "status"), owed ? text(row, "late") : ""].filter(Boolean).join(" · ");
  return (
    <div className="person-page">
      {billID ? <ChatAboutFinance about={{ kind: "bill", id: billID, name: payer }} back={financePaths.payments.path()} /> : null}
      <FinanceHead name={payer} line={line} />
      <div className="sections">
        {owed ? (
          <FactsCard word="Bill detail" item={row} facts={owedFacts} foot={<ActButton permission={manageRole} label="Mark paid" onAct={onMark} />} />
        ) : (
          <FactsCard word="Payment detail" item={row} facts={paidFacts} />
        )}
        {form}
      </div>
    </div>
  );
}
