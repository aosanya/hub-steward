import { useEffect, useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { refusalText } from "../../../../features/backlogs";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Sheet } from "../../../../shared/ui/Sheet";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { dayStart, dayWords, daysLateWords, homeEmpty, listOf, moneyWords, owedTotal, owedWords, text, tools, type Item } from "./financeData";

const owedHeading = "To pay";

const paidHeading = "Paid";

const accountListTool = "accounting_account_list";

const myRolesTool = "agency_get_my_roles";

const managePermission = "accounting.manage";

const noCashAccountWords = "There is no cash account to pay from.";

const todayIso = () => new Date().toISOString().slice(0, 10);

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const holdsManage = async () => {
  try {
    const reply = (await callTool("", myRolesTool)) as { permissions?: unknown } | null;
    return Array.isArray(reply?.permissions) && reply.permissions.includes(managePermission);
  } catch {
    return false;
  }
};

const refusalWords = (error: unknown) => (error instanceof Error ? refusalText(error) || error.message : "") || actionFailedWords;

const owedRow = (bill: Item) => ({
  id: `bill:${text(bill, "id")}`,
  billID: text(bill, "id"),
  group: owedHeading,
  payer: text(bill, "payer"),
  meta: [`${moneyWords(text(bill, "outstanding"))} · due ${dayWords(text(bill, "due_at"))}`, daysLateWords(bill)].filter(Boolean).join(" · "),
  outstanding: moneyWords(text(bill, "outstanding")),
  outstandingAmount: String(Number(text(bill, "outstanding")) || 0),
  due: dayWords(text(bill, "due_at")),
  late: daysLateWords(bill),
  status: text(bill, "status") === "overdue" ? "Overdue" : "Unpaid",
});

const paidRow = (payment: Item) => ({
  id: `payment:${text(payment, "id")}`,
  billID: "",
  group: paidHeading,
  payer: text(payment, "payer") || text(payment, "narration") || text(payment, "kind"),
  meta: `${moneyWords(text(payment, "amount"))} · ${dayWords(text(payment, "paid_at"))}`,
  amount: moneyWords(text(payment, "amount")),
  paidOn: dayWords(text(payment, "paid_at")),
  narration: text(payment, "narration"),
  settledBillID: text(payment, "bill_id"),
  status: "Paid",
});

const billWords = async (billID: string) => {
  if (!billID) return "";
  try {
    const bill = (await callTool("", tools.billRead, { billID })) as Item | null;
    if (!bill) return "";
    return `${text(bill, "payer")} · ${moneyWords(text(bill, "amount"))} · due ${dayWords(text(bill, "due_at"))}`;
  } catch {
    return "";
  }
};

const loadRows = async (): Promise<Item[]> => {
  const [open, overdue, payments] = await Promise.all([
    listOf(tools.billList, { status: "open" }),
    listOf(tools.billList, { status: "overdue" }),
    listOf(tools.paymentList),
  ]);
  return [...open.map(owedRow), ...overdue.map(owedRow), ...payments.map(paidRow)];
};

const cashAccountId = async () => {
  const accounts = await listOf(accountListTool);
  return accounts.map((account) => ({ id: text(account, "id"), category: text(account, "category"), type: text(account, "type") })).find((account) => account.category === "cash" && account.type === "asset")?.id;
};

type Draft = { billID: string; payer: string; amount: string; paidOn: string; narration: string };

type MarkPaidFormProps = { draft: Draft; refused: string; busy: boolean; onChange: (next: Draft) => void; onSave: () => void; onCancel: () => void };

function MarkPaidForm({ draft, refused, busy, onChange, onSave, onCancel }: MarkPaidFormProps) {
  const amount = Number(draft.amount);
  const valid = draft.amount.trim() !== "" && Number.isFinite(amount) && amount > 0 && isDay(draft.paidOn);
  return (
    <Sheet title="Mark paid" onClose={onCancel}>
      <Field label="Amount" inputMode="decimal" value={draft.amount} onChange={(event) => onChange({ ...draft, amount: event.target.value })} />
      <Field label="Paid on" value={draft.paidOn} onChange={(event) => onChange({ ...draft, paidOn: event.target.value })} />
      <TextArea label="Narration" value={draft.narration} onChange={(event) => onChange({ ...draft, narration: event.target.value })} />
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={!valid || busy} onClick={onSave}>Save</Button>
      <Button onClick={onCancel}>Cancel</Button>
    </Sheet>
  );
}

export function PaymentListScreen() {
  const word = useWord("accounting");
  const [version, setVersion] = useState(0);
  const [mayMark, setMayMark] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refused, setRefused] = useState("");
  const [busy, setBusy] = useState(false);
  const [owing, setOwing] = useState({ amount: 0, payers: 0 });
  useEffect(() => {
    let live = true;
    holdsManage().then((holds) => live && setMayMark(holds));
    return () => {
      live = false;
    };
  }, []);
  const loadCounted = async () => {
    const rows = await loadRows();
    setOwing(owedTotal(rows.filter((row) => text(row, "group") === owedHeading).map((row) => ({ payer: row.payer, outstanding: row.outstandingAmount }))));
    return rows;
  };
  const loadRow = async (id: string) => {
    const row = (await loadRows()).find((found) => found.id === id) ?? { id };
    return { ...row, bill: await billWords(text(row, "settledBillID")) };
  };
  const openForm = (row: Item) => {
    setRefused("");
    setDraft({ billID: text(row, "billID"), payer: text(row, "payer"), amount: text(row, "outstandingAmount"), paidOn: todayIso(), narration: "" });
  };
  const closeForm = () => setDraft(null);
  const save = async () => {
    if (!draft) return;
    setRefused("");
    setBusy(true);
    try {
      const cash = await cashAccountId();
      if (!cash) throw new Error(noCashAccountWords);
      const narration = draft.narration.trim();
      await callTool("", tools.paymentMarkPaid, {
        billID: draft.billID,
        cash_account_id: cash,
        amount: Number(draft.amount),
        paid_on: dayStart(draft.paidOn),
        ...(narration ? { narration } : {}),
      });
      setDraft(null);
      setVersion((was) => was + 1);
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <MenuWindow
      key={version}
      title={word("Payments")}
      above={owing.amount > 0 ? <p className="sub">{owedWords(owing)}</p> : null}
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
        fields: { Payer: "payer", Outstanding: "outstanding", Due: "due", Late: "late", Amount: "amount", "Paid on": "paidOn", Narration: "narration", Bill: "bill" },
        status: "status",
        action: { label: "Mark paid", tool: tools.paymentMarkPaid, run: openForm, when: (row) => mayMark && text(row, "group") === owedHeading },
        extra: (row) =>
          draft && draft.billID === text(row, "billID") ? <MarkPaidForm draft={draft} refused={refused} busy={busy} onChange={setDraft} onSave={save} onCancel={closeForm} /> : null,
      }}
    />
  );
}
