import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Chip } from "../../../../shared/ui/Chip";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Segmented } from "../../../../shared/ui/Segmented";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { RaiseBillSheet } from "./RaiseBillSheet";
import { billRow, dayWords, daysLateWords, homeEmpty, listOf, moneyWords, text, tools, unitOf, type Item } from "./financeData";
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

const paymentLine = (payment: Item, unit: string) => [moneyWords(text(payment, "amount"), unit), dayWords(text(payment, "paid_at")), text(payment, "narration")].filter(Boolean).join(" · ");

const newestFirst = (payments: Item[]) => [...payments].sort((a, b) => text(b, "paid_at").localeCompare(text(a, "paid_at")));

const loadBill = async (id: string, unit: string) => {
  const [bill, payments] = await Promise.all([callTool("", tools.billRead, { billID: id }) as Promise<Item | null>, listOf(tools.paymentList, { bill_id: id })]);
  return {
    id,
    billID: id,
    payer: text(bill, "payer"),
    amount: text(bill, "amount"),
    amountWords: moneyWords(text(bill, "amount"), unit),
    settled: moneyWords(text(bill, "settled"), unit),
    outstanding: moneyWords(text(bill, "outstanding"), unit),
    due: dayWords(text(bill, "due_at")),
    due_at: text(bill, "due_at"),
    narration: text(bill, "narration"),
    late: daysLateWords(bill ?? {}),
    status: billRow(bill ?? {}).status,
    ...Object.fromEntries(newestFirst(payments).slice(0, paymentLines).map((payment, at) => [`payment${at + 1}`, paymentLine(payment, unit)])),
  };
};

const editFields: EditField[] = [
  { label: "Payer", key: "payer" },
  { label: "Amount", key: "amount", kind: "number", required: true },
  { label: "Due date", key: "due_at", kind: "date" },
  { label: "Narration", key: "narration" },
];

const paymentFields = Object.fromEntries(paymentLabels.map((label, at) => [label, `payment${at + 1}`]));

export function BillsScreen() {
  const word = useWord("accounting");
  const unit = unitOf(word);
  const [version, setVersion] = useState(0);
  const [edited, setEdited] = useState(0);
  const [status, setStatus] = useState("");
  const [raising, setRaising] = useState(false);
  const [refused, setRefused] = useState(false);
  const [search] = useSearchParams();
  const [listed, setListed] = useState(-1);
  const roles = useLoad(() => callTool("", rolesTool, {}), "bills-roles");
  const manage = roles.state === "ready" && ((roles.data as { permissions?: string[] } | null)?.permissions ?? []).includes(manageRole);
  const loadBills = async () => {
    const bills = (await listOf(tools.billList, status ? { status } : undefined)).map((bill) => billRow(bill, unit));
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
      startAt={search.get("bill") ?? undefined}
      listKey={`${edited}${unit}`}
      detailKey={`${edited}${unit}`}
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
        load: (id: string) => loadBill(id, unit),
        fields: { Payer: "payer", Amount: "amountWords", Settled: "settled", Outstanding: "outstanding", Due: "due", Late: "late", Narration: "narration", Status: "status", ...paymentFields },
        status: "",
        extra: (bill) => (
          <MenuEditForm
            item={bill}
            id={text(bill, "id")}
            idArg="billID"
            tool={tools.billUpdate}
            permission={manageRole}
            fields={editFields}
            keep={["payer", "amount", "due_at", "narration"]}
            readAgain={() => loadBill(text(bill, "id"), unit)}
            onSaved={() => setEdited((was) => was + 1)}
          />
        ),
        action: { label: "Mark paid", tool: tools.paymentMarkPaid, run: markPaid, when: (row) => manage && ["Open", "Overdue"].includes(text(row, "status")) },
      }}
      below={refused ? <LoadFailed words={actionFailedWords} /> : null}
    />
  );
}
