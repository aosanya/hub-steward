import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { carriedChatAbout, carryChatAbout, forgetChatAbout } from "../../../chatAbout";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BillsScreen } from "./BillsScreen";

let permissions: string[];

const bill = { id: "b2", payer: "Sample Garage", amount: 1500, settled: 500, outstanding: 1000, due_at: "2026-01-15T00:00:00Z", status: "overdue", days_overdue: 40, narration: "March stall fee" };

const payments = [
  { id: "p1", kind: "bill", amount: 300, paid_at: "2026-01-20T00:00:00Z", narration: "First part", bill_id: "b2" },
  { id: "p2", kind: "bill", amount: 200, paid_at: "2026-02-10T00:00:00Z", narration: "Second part", bill_id: "b2", method: "bank transfer", paid_by: "u1" },
];

const answer = async (name: string) => {
  if (name === "accounting_bill_list") return { items: [bill] };
  if (name === "accounting_bill_read") return bill;
  if (name === "accounting_payment_list") return { items: payments };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_get_actor") return { id: "u1", display_name: "Farkas Zoltán" };
  if (name === "accounting_account_list") return { items: [{ id: "c1", category: "cash", type: "asset" }] };
  return { items: [] };
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  permissions = ["accounting.manage"];
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetChatAbout();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const open = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/finance/revenue-and-billing"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/revenue-and-billing" element={<BillsScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample Garage/ }));
  return within(document.querySelector(".wf-main .wf-content") as HTMLElement);
};

describe("the bill page is built like a resident", () => {
  it("titles the page with the payer, puts the status on one quiet line and draws no band", async () => {
    const pane = await open();
    expect(await pane.findByRole("heading", { level: 1, name: "Sample Garage" })).toBeInTheDocument();
    expect(document.querySelector(".quiet-line")?.textContent).toContain("Late");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("holds the amounts as rows of one Bill detail card with Edit in its footer", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Bill detail" }));
    for (const label of ["Amount", "Settled", "Outstanding", "Due", "Narration"]) expect(card.getByText(label)).toBeInTheDocument();
    expect(card.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(card.getByRole("button", { name: "Edit" }).closest("footer")).not.toBeNull();
  });

  it("lists the payments as rows of a Payments card with Add payment in its footer", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Payments" }));
    expect(await card.findByText("200 · 2026-02-10 · Bank transfer · Recorded by Farkas Zoltán · Second part")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Add payment" }).closest("footer")).not.toBeNull();
    expect(card.queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("names Unnamed person as the one who recorded a payment that names nobody", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Payments" }));
    expect(await card.findByText("300 · 2026-01-20 · Recorded by Unnamed person · First part")).toBeInTheDocument();
  });

  it("opens the Add payment sheet from the bill and sends the payment with how it was paid", async () => {
    const pane = await open();
    await userEvent.click(await pane.findByRole("button", { name: "Add payment" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Add payment" }));
    await userEvent.click(sheet.getByRole("button", { name: "Card" }));
    await userEvent.click(sheet.getByRole("button", { name: "Save" }));
    const sent = vi.mocked(mcp.callTool).mock.calls.find(([, name]) => name === "accounting_payment_mark_paid");
    expect(sent?.[2]).toMatchObject({ billID: "b2", cash_account_id: "c1", amount: 1000, method: "card" });
  });

  it("shows neither act to a reader without accounting.manage", async () => {
    permissions = [];
    const pane = await open();
    await pane.findByRole("region", { name: "Bill detail" });
    expect(pane.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(pane.queryByRole("button", { name: "Add payment" })).toBeNull();
  });

  it("carries the bill to the chat", async () => {
    const pane = await open();
    await pane.findByRole("region", { name: "Bill detail" });
    carryChatAbout();
    expect(carriedChatAbout()).toMatchObject({ kind: "bill", id: "b2", name: "Sample Garage" });
  });
});
