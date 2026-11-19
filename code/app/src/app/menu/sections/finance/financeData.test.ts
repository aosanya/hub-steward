import { describe, expect, it } from "vitest";
import {
  billRow,
  budgetRow,
  certificateWords,
  dayWords,
  dayStart,
  lastDayOf,
  milestoneWords,
  periodEndOf,
  moneyWords,
  owedTotal,
  paymentRow,
  periodWords,
  quoteRow,
  reportPeriodOf,
  reportRow,
  tenderRow,
  tools,
} from "./financeData";

describe("finance tool names", () => {
  it("names the accounting tools every screen calls", () => {
    expect(tools).toEqual({
      budgetList: "accounting_budget_list",
      budgetRead: "accounting_budget_read",
      reportList: "accounting_report_list",
      reportRead: "accounting_report_read",
      upwardReportSend: "accounting_upward_report_send",
      upwardReportList: "accounting_upward_report_list",
      billList: "accounting_bill_list",
      billRead: "accounting_bill_read",
      billUpdate: "accounting_bill_update",
      accountList: "accounting_account_list",
      tenderCreate: "accounting_tender_create",
      tenderList: "accounting_tender_list",
      tenderRead: "accounting_tender_read",
      tenderUpdate: "accounting_tender_update",
      quoteCreate: "accounting_quote_create",
      quoteList: "accounting_quote_list",
      quoteUpdate: "accounting_quote_update",
      paymentList: "accounting_payment_list",
      paymentMarkPaid: "accounting_payment_mark_paid",
      paymentReverse: "accounting_payment_reverse",
      milestoneList: "accounting_milestone_list",
      certificateList: "accounting_certificate_list",
      dimensionTotals: "accounting_dimension_totals",
      dimensionEntries: "accounting_dimension_entries",
    });
  });
});

describe("money and period words", () => {
  it("groups thousands of numbers and numeric strings", () => {
    expect(moneyWords(1000)).toBe("1,000");
    expect(moneyWords("1234567")).toBe("1,234,567");
    expect(moneyWords(0)).toBe("0");
  });

  it("falls back to zero for anything that is not a number", () => {
    expect(moneyWords("")).toBe("0");
    expect(moneyWords("abc")).toBe("0");
  });

  it("keeps the date part of an ISO time", () => {
    expect(dayWords("2026-03-01T08:30:00Z")).toBe("2026-03-01");
    expect(dayWords("2026-03-01")).toBe("2026-03-01");
    expect(dayWords("")).toBe("");
  });

  it("joins two days into a period", () => {
    expect(periodWords("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe("2026-01-01 to 2026-01-31");
  });

  it("shows the hub's exclusive end as the last day, across month and year ends", () => {
    expect(lastDayOf("2027-01-01T00:00:00Z")).toBe("2026-12-31");
    expect(lastDayOf("2026-03-01")).toBe("2026-02-28");
    expect(lastDayOf("2028-03-01")).toBe("2028-02-29");
    expect(lastDayOf("")).toBe("");
  });

  it("sends the typed last day as the next day at midnight, across month and year ends", () => {
    expect(periodEndOf("2026-12-31")).toBe("2027-01-01T00:00:00Z");
    expect(periodEndOf("2026-02-28")).toBe("2026-03-01T00:00:00Z");
    expect(periodEndOf("2028-02-28")).toBe("2028-02-29T00:00:00Z");
  });

  it("sends a typed first day at midnight", () => {
    expect(dayStart("2026-01-01")).toBe("2026-01-01T00:00:00Z");
  });
});

describe("budget rows", () => {
  it("shows planned and spent in the meta line", () => {
    expect(budgetRow({ id: "b1", name: "Roads", department: "Works", planned: 1000, spent: 250 })).toEqual({
      id: "b1",
      name: "Roads",
      meta: "Planned 1,000 · Spent 250",
      department: "Works",
      planned: 1000,
      spent: 250,
    });
  });
});

describe("bill rows", () => {
  it("shows the amount and due day with a capitalised status", () => {
    expect(billRow({ id: "i1", payer: "Anna", amount: 900, due_at: "2026-03-01T00:00:00Z", status: "open" })).toEqual({
      id: "i1",
      payer: "Anna",
      meta: "900 · due 2026-03-01",
      status: "Open",
    });
  });

  it("capitalises every bill status", () => {
    const statuses = ["open", "overdue", "settled", "reversed"].map((status) => billRow({ id: "x", status }).status);
    expect(statuses).toEqual(["Open", "Overdue", "Settled", "Reversed"]);
  });
});

describe("tender rows", () => {
  it("waits for a quote while there are none", () => {
    expect(tenderRow({ id: "t1", title: "Pump", quote_count: 0 })).toMatchObject({
      id: "t1",
      title: "Pump",
      status: "Waiting for quote",
    });
  });

  it("is quoted once quotes arrive and names the lowest amount", () => {
    const row = tenderRow({ id: "t1", title: "Pump", quote_count: 3, lowest_amount: 4500 });
    expect(row.status).toBe("Quoted");
    expect(row.meta).toBe("3 quotes · lowest 4,500");
  });

  it("uses the singular for one quote", () => {
    expect(tenderRow({ id: "t1", title: "Pump", quote_count: 1, lowest_amount: 10 }).meta).toBe("1 quote · lowest 10");
  });
});

describe("quote rows", () => {
  it("shows the supplier with the amount", () => {
    expect(quoteRow({ id: "q1", supplier: "Acme", amount: 4500 })).toEqual({ id: "q1", supplier: "Acme", meta: "4,500" });
  });
});

describe("report rows", () => {
  it("builds its id from the period and shows the period as meta", () => {
    const row = reportRow({ name: "Q1", period_start: "2026-01-01", period_end: "2026-02-01" });
    expect(row).toEqual({ id: "2026-01-01~2026-02-01", name: "Q1", meta: "2026-01-01 to 2026-01-31" });
  });

  it("reads the period back out of the id", () => {
    expect(reportPeriodOf("2026-01-01~2026-02-01")).toEqual({ period_start: "2026-01-01", period_end: "2026-02-01" });
  });
});

describe("payment rows (accounting_payment_list is being built by MUN1042)", () => {
  it("marks a paid payment", () => {
    expect(paymentRow({ id: "p1", payer: "Anna", amount: 1200, paid: true })).toEqual({
      id: "p1",
      payer: "Anna",
      meta: "1,200",
      paid: true,
      status: "Paid",
    });
  });

  it("marks an unpaid payment", () => {
    expect(paymentRow({ id: "p2", payer: "Ben", amount: "50", paid: false })).toMatchObject({ paid: false, status: "Unpaid" });
  });
});

describe("owedTotal", () => {
  it("adds the outstanding amounts and counts the payers who owe", () => {
    const bills = [
      { id: "b1", payer: "Anna", outstanding: 1200 },
      { id: "b2", payer: "Csilla", outstanding: 800 },
    ];
    expect(owedTotal(bills)).toEqual({ amount: 2000, payers: 2 });
  });

  it("counts a payer with two bills once and adds both amounts", () => {
    const bills = [
      { id: "b1", payer: "Anna", outstanding: 1200 },
      { id: "b2", payer: "Anna", outstanding: 300 },
    ];
    expect(owedTotal(bills)).toEqual({ amount: 1500, payers: 1 });
  });

  it("leaves out a bill with nothing outstanding, even from a payer who owes on another", () => {
    const bills = [
      { id: "b1", payer: "Anna", outstanding: 1200 },
      { id: "b2", payer: "Ben", outstanding: 0 },
      { id: "b3", payer: "Anna", outstanding: 0 },
    ];
    expect(owedTotal(bills)).toEqual({ amount: 1200, payers: 1 });
  });

  it("reads outstanding amounts sent as numeric strings", () => {
    expect(owedTotal([{ id: "b1", payer: "Anna", outstanding: "250" }])).toEqual({ amount: 250, payers: 1 });
  });

  it("is zero for no bills and for bills with nothing outstanding", () => {
    expect(owedTotal([])).toEqual({ amount: 0, payers: 0 });
    expect(owedTotal([{ id: "b1", payer: "Ben", outstanding: 0 }])).toEqual({ amount: 0, payers: 0 });
  });
});

describe("milestone and certificate words", () => {
  it("says a milestone's status without its underscore", () => {
    expect(milestoneWords({ name: "Base", amount: 600, due_at: "2026-03-15T00:00:00Z", status: "part_certified", certified_amount: 400 }, " Ft")).toBe("Base · 600 Ft · due 2026-03-15 · part certified · 400 Ft certified");
  });

  it("leaves out the release words of a certificate with no release day", () => {
    expect(certificateWords({ amount: 100, retention_amount: 10 }, "Base", "", "")).toBe("Base · 100 certified · 10 withheld");
  });

  it("prefers released over the release day once the retention is released", () => {
    expect(certificateWords({ amount: 100, retention_amount: 10, release_due_at: "2026-05-20T00:00:00Z", released_at: "2026-05-21T00:00:00Z" }, "Base", "Acme", "")).toBe("Base · 100 certified · Acme · 10 withheld · released");
  });
});
