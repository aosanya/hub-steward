import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { useWord } from "../../../../features/agency/useWord";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { AddPaymentSheet } from "./AddPaymentSheet";
import { HandOverSheet } from "./HandOverSheet";
import { PaymentPage } from "./PaymentPage";
import { billStatusWords, capitalised, chargeNames, chargeWords, dayWords, daysLateWords, homeEmpty, lateRulesFor, listOf, moneyWords, owedTotal, owedWords, remindsWords, text, tools, unitOf, type Charges, type Item, type LateRules } from "./financeData";

const owedHeading = "To pay";

const raisePermission = "notification.raise";

const chaserKey = "unpaid_list_chaser";

const unpaidLine = (row: Item) => `${text(row, "payer")} · ${text(row, "meta")}`;

const paidHeading = "Paid";

const owedRow = (bill: Item, unit: string, charges: Charges, rules: LateRules) => ({
  id: `bill:${text(bill, "id")}`,
  billID: text(bill, "id"),
  group: owedHeading,
  payer: text(bill, "payer"),
  meta: [chargeWords(bill, charges), `${moneyWords(text(bill, "outstanding"), unit)} · due ${dayWords(text(bill, "due_at"))}`, daysLateWords(bill)].filter(Boolean).join(" · "),
  charge: chargeWords(bill, charges),
  outstanding: moneyWords(text(bill, "outstanding"), unit),
  outstandingAmount: String(Number(text(bill, "outstanding")) || 0),
  due: dayWords(text(bill, "due_at")),
  late: daysLateWords(bill),
  reminds: remindsWords(bill, rules),
  status: text(bill, "status") === "overdue" ? billStatusWords(bill, rules) : Number(text(bill, "settled")) > 0 ? "Part paid" : "Unpaid",
});

const paidRow = (payment: Item, unit: string) => ({
  id: `payment:${text(payment, "id")}`,
  billID: "",
  paymentID: text(payment, "id"),
  group: paidHeading,
  payer: text(payment, "payer") || text(payment, "narration") || text(payment, "kind"),
  meta: `${moneyWords(text(payment, "amount"), unit)} · ${dayWords(text(payment, "paid_at"))}`,
  amount: moneyWords(text(payment, "amount"), unit),
  paidOn: dayWords(text(payment, "paid_at")),
  narration: text(payment, "narration"),
  method: capitalised(text(payment, "method")),
  reference: text(payment, "reference"),
  settledBillID: text(payment, "bill_id"),
  status: "Paid",
});

const billWords = async (billID: string, unit: string) => {
  if (!billID) return "";
  try {
    const bill = (await callTool("", tools.billRead, { billID })) as Item | null;
    if (!bill) return "";
    return `${text(bill, "payer")} · ${moneyWords(text(bill, "amount"), unit)} · due ${dayWords(text(bill, "due_at"))}`;
  } catch {
    return "";
  }
};

const loadRows = async (unit: string): Promise<Item[]> => {
  const [open, overdue, payments, charges] = await Promise.all([
    listOf(tools.billList, { status: "open" }),
    listOf(tools.billList, { status: "overdue" }),
    listOf(tools.paymentList),
    chargeNames(),
  ]);
  const rules = await lateRulesFor(overdue);
  return [...open.map((bill) => owedRow(bill, unit, charges, rules)), ...overdue.map((bill) => owedRow(bill, unit, charges, rules)), ...payments.map((payment) => paidRow(payment, unit))];
};

export function PaymentListScreen() {
  const word = useWord("accounting");
  const unit = unitOf(word);
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState("");
  const [owing, setOwing] = useState({ amount: 0, payers: 0 });
  const [unpaidLines, setUnpaidLines] = useState<string[]>([]);
  const [handingOver, setHandingOver] = useState(false);
  const mayHandOver = useMay(raisePermission);
  const loadCounted = async () => {
    const rows = await loadRows(unit);
    const owedRows = rows.filter((row) => text(row, "group") === owedHeading);
    setOwing(owedTotal(owedRows.map((row) => ({ payer: row.payer, outstanding: row.outstandingAmount }))));
    setUnpaidLines(owedRows.map(unpaidLine));
    return rows;
  };
  const loadRow = async (id: string) => {
    const row = (await loadRows(unit)).find((found) => found.id === id) ?? { id };
    return { ...row, bill: await billWords(text(row, "settledBillID"), unit) };
  };
  const saved = () => {
    setAdding("");
    setVersion((was) => was + 1);
  };
  return (
    <MenuWindow
      key={`${version}${unit}`}
      title={word("Payments")}
      withTabs
      bandless
      above={
        owing.amount > 0 ? (
          <>
            <Section
              word="Owed"
              plain
              rows={[<ListRow key="owed" title={owedWords(owing, unit)} />]}
              foot={mayHandOver ? <button type="button" className="sec-act" onClick={() => setHandingOver(true)}>Send the list</button> : undefined}
            />
            {handingOver ? (
              <HandOverSheet
                title="Hand over the list"
                category="task"
                event="payment_list_handed_over"
                subjectKind="report"
                subjectId="unpaid"
                names={{ total: moneyWords(owing.amount, unit), payers: String(owing.payers), list: unpaidLines.join("\n") }}
                rememberAs={chaserKey}
                onClose={() => setHandingOver(false)}
              />
            ) : null}
          </>
        ) : null
      }
      list={{
        title: word("Payments"),
        tool: tools.paymentList,
        load: loadCounted,
        fields: { title: "payer", meta: "meta" },
        empty: homeEmpty(`No ${word("Payments").toLowerCase()} yet.`),
        end: (row) => text(row, "status"),
        groups: (rows) =>
          [owedHeading, paidHeading].map((heading) => ({ heading, items: rows.filter((row) => text(row, "group") === heading) })).filter((group) => group.items.length > 0),
      }}
      detail={{
        tool: tools.paymentList,
        load: loadRow,
        fields: {},
        status: "",
        extra: (row) => (
          <PaymentPage
            row={row}
            owed={text(row, "group") === owedHeading}
            onMark={() => setAdding(text(row, "billID"))}
            onReversed={() => setVersion((was) => was + 1)}
            form={adding !== "" && adding === text(row, "billID") ? <AddPaymentSheet billID={adding} outstanding={text(row, "outstandingAmount")} onSaved={saved} onCancel={() => setAdding("")} /> : null}
          />
        ),
      }}
    />
  );
}
