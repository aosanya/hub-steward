import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { carriedChatAbout, carryChatAbout, forgetChatAbout } from "../../../chatAbout";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { PaymentListScreen } from "./PaymentListScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let permissions: string[];

const owedBill = { id: "b1", payer: "Anna Sample", amount: 1500, settled: 300, outstanding: 1200, due_at: "2026-12-01T00:00:00Z", status: "open" };
const lateBill = { id: "b2", payer: "Csilla Sample", amount: 800, settled: 0, outstanding: 800, due_at: "2026-10-01T00:00:00Z", status: "overdue", days_overdue: 40 };
const earlierPayment = { id: "p1", kind: "bill", amount: 450, paid_at: "2026-11-02T09:00:00Z", paid_by: "u1", bill_id: "b0", payer: "Ben Sample", narration: "Bank transfer" };
const settledBill = { id: "b0", payer: "Ben Sample", amount: 450, settled: 450, outstanding: 0, due_at: "2026-10-20T00:00:00Z", status: "paid" };

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  permissions = ["accounting.read", "accounting.manage"];
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "accounting_bill_list") return { items: given.status === "open" ? [owedBill] : given.status === "overdue" ? [lateBill] : [] };
    if (name === "accounting_bill_read") return given.billID === "b0" ? settledBill : null;
    if (name === "accounting_payment_list") return { items: [earlierPayment] };
    if (name === "accounting_account_list") return { items: [{ id: "c1", category: "cash", type: "asset" }] };
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetChatAbout();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const openScreen = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/finance/payments"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/payments" element={<PaymentListScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const open = async (payer: string) => {
  openScreen();
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(payer) }));
  return within(document.querySelector(".wf-main .wf-content") as HTMLElement);
};

describe("the payments page is built like a resident", () => {
  it("draws no header band and shows the bottom bar", async () => {
    openScreen();
    await screen.findByRole("button", { name: /Anna Sample/ });
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("shows the total owed as a card above the list", async () => {
    openScreen();
    const card = within(await screen.findByRole("region", { name: "Owed" }));
    expect(card.getByText("Owed in total: 2,000 · 2 payers")).toBeInTheDocument();
  });

  it("titles an owed bill with the payer and puts the status and lateness on one quiet line", async () => {
    const pane = await open("Csilla Sample");
    expect(await pane.findByRole("heading", { level: 1, name: "Csilla Sample" })).toBeInTheDocument();
    expect(document.querySelector(".quiet-line")?.textContent).toContain("Late");
    expect(document.querySelector(".quiet-line")?.textContent).toContain("40 days late");
  });

  it("holds the owed bill as rows of a Bill detail card with Mark paid in its footer", async () => {
    const pane = await open("Anna Sample");
    const card = within(await pane.findByRole("region", { name: "Bill detail" }));
    for (const label of ["Outstanding", "Due"]) expect(card.getByText(label)).toBeInTheDocument();
    expect(card.getByText("2026-12-01")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Mark paid" }).closest("footer")).not.toBeNull();
  });

  it("holds a payment as rows of a Payment detail card with no act", async () => {
    const pane = await open("Ben Sample");
    expect(await pane.findByRole("heading", { level: 1, name: "Ben Sample" })).toBeInTheDocument();
    const card = within(await pane.findByRole("region", { name: "Payment detail" }));
    for (const label of ["Amount", "Paid on", "Narration"]) expect(card.getByText(label)).toBeInTheDocument();
    expect(card.getByText("Bank transfer")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("shows no Mark paid to a reader without accounting.manage", async () => {
    permissions = ["accounting.read"];
    const pane = await open("Anna Sample");
    await pane.findByRole("region", { name: "Bill detail" });
    expect(pane.queryByRole("button", { name: "Mark paid" })).toBeNull();
  });

  it("carries the owed bill to the chat", async () => {
    const pane = await open("Anna Sample");
    await pane.findByRole("region", { name: "Bill detail" });
    carryChatAbout();
    expect(carriedChatAbout()).toMatchObject({ kind: "bill", id: "b1", name: "Anna Sample" });
  });

  it("carries the bill a payment settled to the chat", async () => {
    const pane = await open("Ben Sample");
    await pane.findByRole("region", { name: "Payment detail" });
    carryChatAbout();
    expect(carriedChatAbout()).toMatchObject({ kind: "bill", id: "b0", name: "Ben Sample" });
  });
});
