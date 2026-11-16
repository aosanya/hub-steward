import { text, type Item } from "../staff/staffData";

export { homeEmpty, listOf, text } from "../staff/staffData";
export type { Item } from "../staff/staffData";

export const tools = {
  budgetList: "accounting_budget_list",
  budgetRead: "accounting_budget_read",
  reportList: "accounting_report_list",
  reportRead: "accounting_report_read",
  billList: "accounting_bill_list",
  billRead: "accounting_bill_read",
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
};

const numberOf = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const moneyWords = (amount: number | string) => Math.round(numberOf(amount)).toLocaleString("en-US");

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

export const budgetRow = (line: Item) => ({
  id: text(line, "id"),
  name: text(line, "name"),
  meta: `Planned ${moneyWords(numberOf(line.planned))} · Spent ${moneyWords(numberOf(line.spent))}`,
  department: text(line, "department"),
  planned: numberOf(line.planned),
  spent: numberOf(line.spent),
});

export const billRow = (bill: Item) => ({
  id: text(bill, "id"),
  payer: text(bill, "payer"),
  meta: `${moneyWords(numberOf(bill.amount))} · due ${dayWords(text(bill, "due_at"))}`,
  status: capitalised(text(bill, "status")),
});

export const tenderRow = (tender: Item) => {
  const quotes = numberOf(tender.quote_count);
  return {
    id: text(tender, "id"),
    title: text(tender, "title"),
    meta: quotes === 0 ? "No quotes yet" : `${quotes} ${quotes === 1 ? "quote" : "quotes"} · lowest ${moneyWords(numberOf(tender.lowest_amount))}`,
    status: quotes === 0 ? "Waiting for quote" : "Quoted",
  };
};

export const quoteRow = (quote: Item) => ({
  id: text(quote, "id"),
  supplier: text(quote, "supplier"),
  meta: moneyWords(numberOf(quote.amount)),
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

export const paymentRow = (payment: Item) => {
  const paid = payment.paid === true;
  return {
    id: text(payment, "id"),
    payer: text(payment, "payer"),
    meta: moneyWords(numberOf(payment.amount)),
    paid,
    status: paid ? "Paid" : "Unpaid",
  };
};
