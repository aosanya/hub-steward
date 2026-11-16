import { Chip } from "../../../../shared/ui/Chip";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";
import { billRow, dayWords, homeEmpty, listOf, moneyWords, text, tools, type Item } from "./financeData";

const loadBills = async () => (await listOf(tools.billList)).map(billRow);

const loadBill = async (id: string) => {
  const bill = (await callTool("", tools.billRead, { billID: id })) as Item | null;
  return {
    id,
    payer: text(bill, "payer"),
    amount: moneyWords(text(bill, "amount")),
    settled: moneyWords(text(bill, "settled")),
    outstanding: moneyWords(text(bill, "outstanding")),
    due: dayWords(text(bill, "due_at")),
    status: billRow(bill ?? {}).status,
  };
};

export function BillsScreen() {
  return (
    <MenuWindow
      title="Revenue & Billing"
      list={{
        title: "Revenue & Billing",
        tool: tools.billList,
        load: loadBills,
        fields: { title: "payer", meta: "meta" },
        empty: homeEmpty("No bills yet."),
        end: (bill) => <Chip>{text(bill, "status")}</Chip>,
      }}
      detail={{
        tool: tools.billRead,
        load: loadBill,
        fields: { Payer: "payer", Amount: "amount", Settled: "settled", Outstanding: "outstanding", Due: "due", Status: "status" },
        status: "",
      }}
    />
  );
}
