import { listOf, text } from "./financeData";

export const accountListTool = "accounting_account_list";

export const cashAccountId = async () => {
  const accounts = await listOf(accountListTool);
  return accounts.find((account) => text(account, "category") === "cash" && text(account, "type") === "asset")?.id as string | undefined;
};
