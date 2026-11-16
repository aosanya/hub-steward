import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { TendersScreen } from "./TendersScreen";

type Args = Record<string, unknown> | undefined;

const tenders = [
  { id: "t1", budget_id: "b1", title: "Plastic chairs", closes_at: "2026-04-01T00:00:00Z", quote_count: 0, lowest_amount: 0 },
  { id: "t2", budget_id: "b1", title: "Printer paper", closes_at: "2026-05-01T00:00:00Z", quote_count: 2, lowest_amount: 900 },
];

const quotesOf: Record<string, unknown[]> = {
  t1: [],
  t2: [
    { id: "q1", tender_id: "t2", supplier: "Acme Supplies", amount: 950 },
    { id: "q2", tender_id: "t2", supplier: "Beta Traders", amount: 900 },
  ],
};

const answers: Record<string, (args: Args) => unknown> = {
  accounting_tender_list: () => ({ items: tenders }),
  accounting_tender_read: (args) => tenders.find((tender) => tender.id === args?.tenderID) ?? {},
  accounting_quote_list: (args) => ({ items: quotesOf[String(args?.tenderID)] ?? [] }),
};

const origin = { path: "/a/town/menu/finance", title: "Finance" };

const pane = () => document.querySelector(".mw-detail") as HTMLElement;

const open = (tool: Record<string, (args: Args) => unknown> = answers) => {
  const called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => (tool[name] ? tool[name](args as Args) : { items: [] }));
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/finance/procurement", state: { from: origin } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/procurement" element={<TendersScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  return called;
};

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Tenders list", () => {
  it("reads Waiting for quote for a tender with no quotes and Quoted for one with quotes", async () => {
    open();

    expect(await screen.findByText("Plastic chairs")).toBeInTheDocument();
    expect(screen.getByText("Printer paper")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting for quote")).toHaveLength(1);
    expect(screen.getAllByText("Quoted")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Procurement" })).toBeInTheDocument();
  });

  it("lists the quotes of a tender beside the list when its row is pressed, asking by tenderID", async () => {
    const called = open();
    await userEvent.click(await screen.findByRole("button", { name: /Printer paper/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Acme Supplies"));
    expect(pane().textContent).toContain("950");
    expect(pane().textContent).toContain("Beta Traders");
    expect(pane().textContent).toContain("900");
    const asked = called.mock.calls.filter(([, tool]) => tool === "accounting_quote_list").map(([, , args]) => args);
    expect(asked).toContainEqual({ tenderID: "t2" });
    expect(called.mock.calls.map(([, tool]) => tool)).toContain("accounting_tender_read");
  });

  it("shows a tender with no quotes as Waiting for quote in its detail", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Plastic chairs/ }));

    await waitFor(() => expect(pane()).not.toBeNull());
    await waitFor(() => expect(pane().textContent).toContain("Waiting for quote"));
    expect(pane().textContent).not.toContain("Acme Supplies");
  });

  it("says so when the hub lists no tenders", async () => {
    open({ ...answers, accounting_tender_list: () => ({ items: [] }) });

    expect(await screen.findByText(/No tenders/i)).toBeInTheDocument();
  });
});
