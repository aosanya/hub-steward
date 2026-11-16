import { callTool } from "../../../../shared/wakala/mcp";
import { listOf, text, tools } from "./financeData";

export const accountListTool = "accounting_account_list";

export const cashAccountId = async () => {
  const accounts = await listOf(accountListTool);
  return accounts.find((account) => text(account, "category") === "cash" && text(account, "type") === "asset")?.id as string | undefined;
};

export const markBillPaid = async (billID: string) => {
  const cash = await cashAccountId();
  if (!cash) throw new Error("no cash account");
  await callTool("", tools.paymentMarkPaid, { billID, cash_account_id: cash });
};
