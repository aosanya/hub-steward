import { useState } from "react";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { MenuWindow } from "../../MenuWindow";
import { PaidMark } from "./PaidMark";
import { homeEmpty, listOf, paymentRow, text, tools, type Item } from "./financeData";

export function PaymentListScreen() {
  const [paidNow, setPaidNow] = useState<string[]>([]);
  const [refused, setRefused] = useState(false);
  const isPaid = (row: Item) => row.paid === true || paidNow.includes(text(row, "id"));
  const rowsOf = async () => (await listOf(tools.paymentList)).map(paymentRow);
  const loadPayment = async (id: string) => {
    const row = (await rowsOf()).find((payment) => payment.id === id) ?? { id, payer: "", meta: "", paid: false };
    const paid = isPaid(row);
    return { ...row, paid, status: paid ? "Paid" : "Unpaid" };
  };
  const markPaid = async (payment: Item) => {
    const id = text(payment, "id");
    setRefused(false);
    try {
      await callTool("", tools.paymentMarkPaid, { id });
      setPaidNow((ids) => [...ids, id]);
    } catch {
      setRefused(true);
    }
  };
  return (
    <MenuWindow
      title="Payments"
      detailKey={paidNow.length}
      list={{
        title: "Payments",
        tool: tools.paymentList,
        load: rowsOf,
        fields: { title: "payer", meta: "meta" },
        empty: homeEmpty("No payments yet."),
        end: (row) => (isPaid(row) ? <PaidMark /> : "Unpaid"),
      }}
      detail={{
        tool: tools.paymentList,
        load: loadPayment,
        fields: { Payer: "payer", Amount: "meta" },
        status: "status",
        action: { label: "Mark paid", tool: tools.paymentMarkPaid, run: markPaid, when: (payment) => !isPaid(payment) },
      }}
      below={refused ? <LoadFailed words={actionFailedWords} /> : null}
    />
  );
}
