import { useState } from "react";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { dayWords, homeEmpty, listOf, moneyWords, text, tools, type Item } from "./financeData";

const owedHeading = "To pay";

const paidHeading = "Paid";

const accountListTool = "accounting_account_list";

const owedRow = (bill: Item) => ({
  id: `bill:${text(bill, "id")}`,
  billID: text(bill, "id"),
  group: owedHeading,
  payer: text(bill, "payer"),
  meta: `${moneyWords(text(bill, "outstanding"))} · due ${dayWords(text(bill, "due_at"))}`,
  outstanding: moneyWords(text(bill, "outstanding")),
  due: dayWords(text(bill, "due_at")),
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
  status: "Paid",
});

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

export function PaymentListScreen() {
  const [version, setVersion] = useState(0);
  const [refused, setRefused] = useState(false);
  const loadRow = async (id: string) => (await loadRows()).find((row) => row.id === id) ?? { id };
  const markPaid = async (row: Item) => {
    setRefused(false);
    try {
      const cash = await cashAccountId();
      if (!cash) throw new Error("no cash account");
      await callTool("", tools.paymentMarkPaid, { billID: text(row, "billID"), cash_account_id: cash });
      setVersion((was) => was + 1);
    } catch {
      setRefused(true);
    }
  };
  return (
    <MenuWindow
      key={version}
      title="Payments"
      list={{
        title: "Payments",
        tool: tools.paymentList,
        load: loadRows,
        fields: { title: "payer", meta: "meta" },
        empty: homeEmpty("No payments yet."),
        end: (row) => text(row, "status"),
        groups: (rows) =>
          [owedHeading, paidHeading].map((heading) => ({ heading, items: rows.filter((row) => text(row, "group") === heading) })).filter((group) => group.items.length > 0),
      }}
      detail={{
        tool: tools.paymentList,
        load: loadRow,
        fields: { Payer: "payer", Outstanding: "outstanding", Due: "due", Amount: "amount", "Paid on": "paidOn" },
        status: "status",
        action: { label: "Mark paid", tool: tools.paymentMarkPaid, run: markPaid, when: (row) => text(row, "group") === owedHeading },
      }}
      below={refused ? <LoadFailed words={actionFailedWords} /> : null}
    />
  );
}
