import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Chip } from "../../../../shared/ui/Chip";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Segmented } from "../../../../shared/ui/Segmented";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { RaiseBillSheet } from "./RaiseBillSheet";
import { billRow, dayWords, homeEmpty, listOf, moneyWords, text, tools, type Item } from "./financeData";
import { markBillPaid } from "./markBillPaid";

const manageRole = "accounting.manage";

const rolesTool = "agency_get_my_roles";

const statuses = [
  { id: "", label: "All" },
  { id: "open", label: "Open" },
  { id: "overdue", label: "Overdue" },
  { id: "settled", label: "Settled" },
  { id: "reversed", label: "Reversed" },
];

const paymentLines = 10;

const paymentLabels = Array.from({ length: paymentLines }, (_, at) => `Payment ${at + 1}`);

const paymentLine = (payment: Item) => [moneyWords(text(payment, "amount")), dayWords(text(payment, "paid_at")), text(payment, "narration")].filter(Boolean).join(" · ");

const newestFirst = (payments: Item[]) => [...payments].sort((a, b) => text(b, "paid_at").localeCompare(text(a, "paid_at")));

const loadBill = async (id: string) => {
  const [bill, payments] = await Promise.all([callTool("", tools.billRead, { billID: id }) as Promise<Item | null>, listOf(tools.paymentList, { bill_id: id })]);
  return {
    id,
    billID: id,
    payer: text(bill, "payer"),
    amount: moneyWords(text(bill, "amount")),
    settled: moneyWords(text(bill, "settled")),
    outstanding: moneyWords(text(bill, "outstanding")),
    due: dayWords(text(bill, "due_at")),
    narration: text(bill, "narration"),
    status: billRow(bill ?? {}).status,
    ...Object.fromEntries(newestFirst(payments).slice(0, paymentLines).map((payment, at) => [`payment${at + 1}`, paymentLine(payment)])),
  };
};

const paymentFields = Object.fromEntries(paymentLabels.map((label, at) => [label, `payment${at + 1}`]));

export function BillsScreen() {
  const word = useWord("accounting");
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState("");
  const [raising, setRaising] = useState(false);
  const [refused, setRefused] = useState(false);
  const [listed, setListed] = useState(-1);
  const roles = useLoad(() => callTool("", rolesTool, {}), "bills-roles");
  const manage = roles.state === "ready" && ((roles.data as { permissions?: string[] } | null)?.permissions ?? []).includes(manageRole);
  const loadBills = async () => {
    const bills = (await listOf(tools.billList, status ? { status } : undefined)).map(billRow);
    setListed(bills.length);
    return bills;
  };
  const markPaid = async (row: Item) => {
    setRefused(false);
    try {
      await markBillPaid(text(row, "billID"));
      setVersion((was) => was + 1);
    } catch {
      setRefused(true);
    }
  };
  const noBills = `No ${word("Bills").toLowerCase()} yet.`;
  const raiseButton = <Button kind="primary" onClick={() => setRaising(true)}>Raise {word("Bill").toLowerCase()}</Button>;
  return (
    <MenuWindow
      key={`${status}:${version}`}
      title={word("Revenue & Billing")}
      above={
        <>
          <Segmented label="Status" items={statuses.map(({ id, label }) => ({ id, label }))} current={status} onChange={setStatus} />
          {manage && listed !== 0 ? raiseButton : null}
          {raising ? (
            <RaiseBillSheet
              onClose={() => setRaising(false)}
              onRaised={() => {
                setRaising(false);
                setVersion((was) => was + 1);
              }}
            />
          ) : null}
        </>
      }
      list={{
        title: word("Revenue & Billing"),
        tool: tools.billList,
        load: loadBills,
        fields: { title: "payer", meta: "meta" },
        empty: manage ? { words: noBills, children: raiseButton } : homeEmpty(noBills),
        end: (bill) => <Chip>{text(bill, "status")}</Chip>,
      }}
      detail={{
        tool: tools.billRead,
        load: loadBill,
        fields: { Payer: "payer", Amount: "amount", Settled: "settled", Outstanding: "outstanding", Due: "due", Narration: "narration", Status: "status", ...paymentFields },
        status: "",
        action: { label: "Mark paid", tool: tools.paymentMarkPaid, run: markPaid, when: (row) => ["Open", "Overdue"].includes(text(row, "status")) },
      }}
      below={refused ? <LoadFailed words={actionFailedWords} /> : null}
    />
  );
}
