import type { Wording } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { listOf, text, type Item } from "../staff/staffData";

export { homeEmpty, listOf, text } from "../staff/staffData";
export type { Item } from "../staff/staffData";

export const tools = {
  budgetList: "accounting_budget_list",
  budgetRead: "accounting_budget_read",
  reportList: "accounting_report_list",
  reportRead: "accounting_report_read",
  upwardReportSend: "accounting_upward_report_send",
  upwardReportList: "accounting_upward_report_list",
  billList: "accounting_bill_list",
  billRead: "accounting_bill_read",
  accountList: "accounting_account_list",
  billUpdate: "accounting_bill_update",
  tenderCreate: "accounting_tender_create",
  tenderList: "accounting_tender_list",
  tenderRead: "accounting_tender_read",
  tenderUpdate: "accounting_tender_update",
  quoteCreate: "accounting_quote_create",
  quoteList: "accounting_quote_list",
  quoteUpdate: "accounting_quote_update",
  paymentList: "accounting_payment_list",
  paymentMarkPaid: "accounting_payment_mark_paid",
  milestoneList: "accounting_milestone_list",
  certificateList: "accounting_certificate_list",
  dimensionTotals: "accounting_dimension_totals",
};

const settingReadTool = "forms_catalog_setting_read";

const numberOf = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const unitOf = (word: Wording) => {
  const own = word("Currency");
  return own === "Currency" ? "" : ` ${own}`;
};

export const moneyWords = (amount: number | string, unit = "") => `${Math.round(numberOf(amount)).toLocaleString("en-US")}${unit}`;

export const dayWords = (iso: string) => iso.slice(0, 10);

const dayShifted = (day: string, by: number) => {
  const moved = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(moved.getTime())) return day;
  moved.setUTCDate(moved.getUTCDate() + by);
  return moved.toISOString().slice(0, 10);
};

export const dayStart = (day: string) => `${day}T00:00:00Z`;

export const periodEndOf = (lastDay: string) => dayStart(dayShifted(lastDay, 1));

export const lastDayOf = (end: string) => dayShifted(dayWords(end), -1);

export const periodWords = (start: string, end: string) => `${dayWords(start)} to ${lastDayOf(end)}`;

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const budgetRow = (line: Item, unit = "") => ({
  id: text(line, "id"),
  name: text(line, "name"),
  meta: `Planned ${moneyWords(numberOf(line.planned), unit)} · Spent ${moneyWords(numberOf(line.spent), unit)}`,
  department: text(line, "department"),
  planned: numberOf(line.planned),
  spent: numberOf(line.spent),
});

export const departmentRow = (figure: Item, unit = "") => ({
  name: text(figure, "department") || "No department",
  meta: `Planned ${moneyWords(numberOf(figure.planned), unit)} · Spent ${moneyWords(numberOf(figure.spent), unit)} · Difference ${moneyWords(numberOf(figure.difference), unit)}`,
});

export const daysLateWords = (bill: Item) => {
  const days = numberOf(bill.days_overdue);
  if (text(bill, "status") !== "overdue" || days <= 0) return "";
  return `${days} ${days === 1 ? "day" : "days"} late`;
};

export type LateRule = { days: number; role: string };

export type LateRules = Map<string, LateRule | null>;

export const lateRuleKey = (accountId: string) => `late_rule.${accountId}`;

export const lateRuleOf = (value: unknown): LateRule | null => {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as { days?: unknown; role?: unknown };
    const days = Number(parsed.days);
    if (!Number.isFinite(days) || days < 0 || typeof parsed.role !== "string") return null;
    return { days, role: parsed.role };
  } catch {
    return null;
  }
};

export const readLateRule = async (accountId: string): Promise<LateRule | null> => {
  try {
    const reply = (await callTool("", settingReadTool, { key: lateRuleKey(accountId) })) as { value?: unknown } | null;
    return lateRuleOf(reply?.value);
  } catch {
    return null;
  }
};

export const lateRulesFor = async (bills: Item[]): Promise<LateRules> => {
  const accounts = [...new Set(bills.filter((bill) => text(bill, "status") === "overdue").map((bill) => text(bill, "income_account_id")).filter(Boolean))];
  const rules = await Promise.all(accounts.map(readLateRule));
  return new Map(accounts.map((account, at) => [account, rules[at]]));
};

export const ruleOfBill = (bill: Item, rules: LateRules) => rules.get(text(bill, "income_account_id")) ?? null;

export const isLate = (bill: Item, rules: LateRules) => text(bill, "status") === "overdue" && numberOf(bill.days_overdue) > (ruleOfBill(bill, rules)?.days ?? 0);

export const remindsWords = (bill: Item, rules: LateRules) => (isLate(bill, rules) ? (ruleOfBill(bill, rules)?.role ?? "") : "");

export type Charges = Map<string, string>;

export const chargeNames = async (): Promise<Charges> => {
  try {
    const accounts = await listOf(tools.accountList);
    return new Map(accounts.filter((account) => text(account, "type") === "income").map((account) => [text(account, "id"), text(account, "name")]));
  } catch {
    return new Map();
  }
};

export const chargeWords = (bill: Item | null, charges: Charges) => charges.get(text(bill, "income_account_id")) ?? "";

export const billStatusWords = (bill: Item, rules: LateRules = new Map()) => (isLate(bill, rules) ? "Late" : capitalised(text(bill, "status")));

export const billRow = (bill: Item, unit = "", charges: Charges = new Map(), rules: LateRules = new Map()) => ({
  id: text(bill, "id"),
  payer: text(bill, "payer"),
  meta: [chargeWords(bill, charges), `${moneyWords(numberOf(bill.amount), unit)} · due ${dayWords(text(bill, "due_at"))}`, daysLateWords(bill)].filter(Boolean).join(" · "),
  status: billStatusWords(bill, rules),
});

export const paymentLine = (payment: Item, unit = "") => `${moneyWords(numberOf(payment.amount), unit)} · paid ${dayWords(text(payment, "paid_at"))}`;

export const tenderRow = (tender: Item, unit = "") => {
  const quotes = numberOf(tender.quote_count);
  return {
    id: text(tender, "id"),
    title: text(tender, "title"),
    meta: quotes === 0 ? "No quotes yet" : `${quotes} ${quotes === 1 ? "quote" : "quotes"} · lowest ${moneyWords(numberOf(tender.lowest_amount), unit)}`,
    status: quotes === 0 ? "Waiting for quote" : "Quoted",
  };
};

export const quoteRow = (quote: Item, unit = "") => ({
  id: text(quote, "id"),
  supplier: text(quote, "supplier"),
  meta: moneyWords(numberOf(quote.amount), unit),
});

export const reportRow = (report: Item) => ({
  id: `${text(report, "period_start")}~${text(report, "period_end")}`,
  name: text(report, "name"),
  meta: periodWords(text(report, "period_start"), text(report, "period_end")),
});

export const reportPeriodOf = (id: string) => {
  const [period_start = "", period_end = ""] = id.split("~");
  return { period_start, period_end };
};

export const paymentRow = (payment: Item, unit = "") => {
  const paid = payment.paid === true;
  return {
    id: text(payment, "id"),
    payer: text(payment, "payer"),
    meta: moneyWords(numberOf(payment.amount), unit),
    paid,
    status: paid ? "Paid" : "Unpaid",
  };
};

const certifiedStatusWords = (status: string) => status.replace(/_/g, " ");

export const milestoneWords = (milestone: Item, unit = "") =>
  [
    text(milestone, "name"),
    moneyWords(numberOf(milestone.amount), unit),
    `due ${dayWords(text(milestone, "due_at"))}`,
    certifiedStatusWords(text(milestone, "status")),
    `${moneyWords(numberOf(milestone.certified_amount), unit)} certified`,
  ]
    .filter((word) => word !== "")
    .join(" · ");

const releaseWords = (certificate: Item) => {
  if (text(certificate, "released_at") !== "") return "released";
  const due = text(certificate, "release_due_at");
  return due === "" ? "" : `can be released ${dayWords(due)}`;
};

export const certificateWords = (certificate: Item, milestoneName: string, payeeName: string, unit = "") =>
  [
    milestoneName,
    `${moneyWords(numberOf(certificate.amount), unit)} certified`,
    payeeName,
    `${moneyWords(numberOf(certificate.retention_amount), unit)} withheld`,
    releaseWords(certificate),
  ]
    .filter((word) => word !== "")
    .join(" · ");

export const owedTotal = (bills: Item[]) => {
  const owing = bills.filter((bill) => numberOf(bill.outstanding) > 0);
  return {
    amount: owing.reduce((sum, bill) => sum + numberOf(bill.outstanding), 0),
    payers: new Set(owing.map((bill) => text(bill, "payer")).filter(Boolean)).size,
  };
};

export const owedWords = ({ amount, payers }: { amount: number; payers: number }, unit = "") => `Owed in total: ${moneyWords(amount, unit)} · ${payers} ${payers === 1 ? "payer" : "payers"}`;

export const instantOf = (day: string) => (day ? `${day}T00:00:00Z` : undefined);

export const withoutBlanks = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== ""));
