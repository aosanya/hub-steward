import { vi, type MockInstance } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BillsScreen } from "./BillsScreen";
import { TendersScreen } from "./TendersScreen";
import { tools } from "./financeData";

type Row = { [key: string]: unknown };

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let refusal: string;
let bills: Row[];
let tenders: Row[];
let quotes: Row[];

const patched = (rows: Row[], key: string, given: Row) => rows.map((row) => (row.id === given[key] ? { ...row, ...given } : row));

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Row;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === tools.billList) return { items: bills };
  if (name === tools.billRead) return bills.find((row) => row.id === given.billID);
  if (name === tools.tenderList) return { items: tenders.map((tender) => ({ ...tender, quote_count: quotes.length })) };
  if (name === tools.tenderRead) return tenders.find((row) => row.id === given.tenderID);
  if (name === tools.quoteList) return { items: quotes };
  if (name === tools.budgetRead) return { id: "bl1", name: "Town Hall repairs" };
  if (name === tools.billUpdate || name === tools.tenderUpdate || name === tools.quoteUpdate) {
    if (refusal) throw new mcp.McpError(refusal);
    if (name === tools.billUpdate) bills = patched(bills, "billID", { ...given, id: given.billID });
    if (name === tools.tenderUpdate) tenders = patched(tenders, "tenderID", { ...given, id: given.tenderID });
    if (name === tools.quoteUpdate) quotes = patched(quotes, "quoteID", { ...given, id: given.quoteID });
    return {};
  }
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  permissions = ["accounting.manage"];
  refusal = "";
  bills = [{ id: "b2", payer: "Sample Garage", amount: 1500, settled: 500, outstanding: 1000, due_at: "2026-01-15T00:00:00Z", status: "overdue", narration: "January stall fee" }];
  tenders = [{ id: "t1", budget_id: "bl1", title: "Roof repair", description: "Slate roof", closes_at: "2026-12-01T00:00:00Z" }];
  quotes = [{ id: "q1", tender_id: "t1", supplier: "Sample Roofers", amount: 8200, note: "with scaffolding", valid_until: "2026-11-30T00:00:00Z" }];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = async (path: string, pattern: string, element: JSX.Element, row: RegExp) => {
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state: { from: { path: "/a/town/menu/finance", title: "Finance" } } }]}>
      <Routes>
        <Route path={pattern} element={element} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: row }));
};

const showBill = () => show("/a/town/menu/finance/revenue-and-billing", "/a/:agencyId/menu/finance/revenue-and-billing", <BillsScreen />, /Sample Garage/);

const showTender = () => show("/a/town/menu/finance/procurement", "/a/:agencyId/menu/finance/procurement", <TendersScreen />, /Roof repair/);

const replace = async (label: string, text: string) => {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, text);
};

const setDay = (label: string, day: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: day } });

const editButtons = () => screen.queryAllByRole("button", { name: "Edit" });

describe("editing a bill from its detail", () => {
  it("sends the whole record with the narration changed, the amount as a number, and the due date as recorded", async () => {
    await showBill();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await replace("Narration", "February stall fee");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.billUpdate, { billID: "b2", payer: "Sample Garage", amount: 1500, due_at: "2026-01-15T00:00:00Z", narration: "February stall fee" }),
    );
    expect(await screen.findByText("February stall fee")).toBeTruthy();
  });

  it("shows the hub's words when a bill with a payment is given a new amount", async () => {
    refusal = "accounting_bill_update: bill b2 already has a payment of 500, so its amount stays 1500";
    await showBill();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await replace("Amount", "1800");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("bill b2 already has a payment of 500, so its amount stays 1500")).toBeTruthy();
    expect(called).toHaveBeenCalledWith("", tools.billUpdate, expect.objectContaining({ amount: 1800 }));
  });

  it("shows no Edit to a caller who holds accounting.view only", async () => {
    permissions = ["accounting.view"];
    await showBill();

    await screen.findByRole("heading", { level: 1, name: "Sample Garage" });
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(editButtons()).toHaveLength(0);
  });
});

describe("editing a tender and its quotes from the tender detail", () => {
  it("sends the whole tender with the title changed and the closing instant as recorded", async () => {
    await showTender();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await replace("Title", "Roof repair, north side");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.tenderUpdate, { tenderID: "t1", title: "Roof repair, north side", description: "Slate roof", closes_at: "2026-12-01T00:00:00Z" }),
    );
  });

  it("shows the hub's words when a closed tender is refused", async () => {
    refusal = "accounting_tender_update: tender t1 closed on 2026-02-01T00:00:00Z and can no longer be changed";
    await showTender();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await replace("Title", "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("tender t1 closed on 2026-02-01T00:00:00Z and can no longer be changed")).toBeTruthy();
  });

  it("sends a quote with its amount as a number and its valid-until instant as recorded", async () => {
    await showTender();

    const buttons = await screen.findAllByRole("button", { name: "Edit" });
    await userEvent.click(buttons[buttons.length - 1]);
    await replace("Amount", "7900");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.quoteUpdate, { quoteID: "q1", supplier: "Sample Roofers", amount: 7900, note: "with scaffolding", valid_until: "2026-11-30T00:00:00Z" }),
    );
  });

  it("shows no Edit to a caller who holds accounting.view only", async () => {
    permissions = ["accounting.view"];
    await showTender();

    await screen.findByText("Sample Roofers");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(editButtons()).toHaveLength(0);
  });
});

describe("correcting a date from the edit forms", () => {
  it("shows the recorded due date as its day and sends a corrected due date as an instant", async () => {
    await showBill();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-01-15");
    setDay("Due date", "2026-02-15");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.billUpdate, { billID: "b2", payer: "Sample Garage", amount: 1500, due_at: "2026-02-15T00:00:00Z", narration: "January stall fee" }),
    );
  });

  it("shows the hub's words when a bill with a payment is given a new due date and the hub refuses", async () => {
    refusal = "accounting_bill_update: bill b2 already has a payment of 500, so its due date stays 2026-01-15";
    await showBill();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    setDay("Due date", "2026-03-01");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("bill b2 already has a payment of 500, so its due date stays 2026-01-15")).toBeTruthy();
  });

  it("sends a changed closing day to accounting_tender_update as an instant", async () => {
    await showTender();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    expect((screen.getByLabelText("Closing day") as HTMLInputElement).value).toBe("2026-12-01");
    setDay("Closing day", "2026-12-15");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.tenderUpdate, { tenderID: "t1", description: "Slate roof", title: "Roof repair", closes_at: "2026-12-15T00:00:00Z" }),
    );
  });

  it("sends an unchanged closing day exactly as recorded when only the description changes", async () => {
    tenders = [{ ...tenders[0], closes_at: "2026-12-01T09:30:00Z" }];
    await showTender();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await replace("Description", "Tile roof");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.tenderUpdate, { tenderID: "t1", title: "Roof repair", description: "Tile roof", closes_at: "2026-12-01T09:30:00Z" }),
    );
  });

  it("shows the hub's words when a closed tender is given a new closing day", async () => {
    refusal = "accounting_tender_update: tender t1 closed on 2026-02-01T00:00:00Z and can no longer be changed";
    await showTender();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    setDay("Closing day", "2026-12-20");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("tender t1 closed on 2026-02-01T00:00:00Z and can no longer be changed")).toBeTruthy();
    expect(called).toHaveBeenCalledWith("", tools.tenderUpdate, expect.objectContaining({ closes_at: "2026-12-20T00:00:00Z" }));
  });

  it("sends a corrected valid-until day of a quote as an instant", async () => {
    await showTender();

    const buttons = await screen.findAllByRole("button", { name: "Edit" });
    await userEvent.click(buttons[buttons.length - 1]);
    setDay("Valid until", "2026-12-10");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.quoteUpdate, { quoteID: "q1", supplier: "Sample Roofers", amount: 8200, note: "with scaffolding", valid_until: "2026-12-10T00:00:00Z" }),
    );
  });

  it("sends an unchanged quote valid-until exactly as recorded", async () => {
    quotes = [{ ...quotes[0], valid_until: "2026-11-30T17:00:00Z" }];
    await showTender();

    const buttons = await screen.findAllByRole("button", { name: "Edit" });
    await userEvent.click(buttons[buttons.length - 1]);
    await replace("Note", "scaffolding extra");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", tools.quoteUpdate, { quoteID: "q1", supplier: "Sample Roofers", amount: 8200, note: "scaffolding extra", valid_until: "2026-11-30T17:00:00Z" }),
    );
  });
});
