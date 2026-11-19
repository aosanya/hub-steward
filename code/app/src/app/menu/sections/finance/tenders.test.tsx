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

const manager = { permissions: ["accounting.manage"] };

const lines = [
  { id: "b1", name: "Road repairs", department: "Works" },
  { id: "b2", name: "Street lighting", department: "Works" },
];

const living = (roles: unknown, start: { tenders: Record<string, unknown>[]; quotes: Record<string, unknown[]> }) => {
  const world = { tenders: start.tenders.map((tender) => ({ ...tender })), quotes: { ...start.quotes } };
  const quoteCountOf = (id: string) => (world.quotes[id] ?? []).length;
  const lowestOf = (id: string) => Math.min(...(world.quotes[id] ?? []).map((quote) => Number((quote as { amount: number }).amount)));
  const view = (tender: Record<string, unknown>) => ({ ...tender, quote_count: quoteCountOf(String(tender.id)), lowest_amount: quoteCountOf(String(tender.id)) ? lowestOf(String(tender.id)) : 0 });
  const created: Record<string, unknown>[] = [];
  const reply: Record<string, (args: Args) => unknown> = {
    agency_get_my_roles: () => roles,
    accounting_budget_list: () => ({ items: lines }),
    accounting_budget_read: (args) => lines.find((line) => line.id === args?.budgetID) ?? {},
    accounting_tender_list: () => ({ items: world.tenders.map(view) }),
    accounting_tender_read: (args) => view(world.tenders.find((tender) => tender.id === args?.tenderID) ?? {}),
    accounting_quote_list: (args) => ({ items: [...(world.quotes[String(args?.tenderID)] ?? [])].sort((a, b) => Number((a as { amount: number }).amount) - Number((b as { amount: number }).amount)) }),
    accounting_tender_create: (args) => {
      const tender = { id: `t${world.tenders.length + 1}`, ...args };
      world.tenders.push(tender);
      world.quotes[String(tender.id)] = [];
      created.push(tender);
      return tender;
    },
    accounting_quote_create: (args) => {
      const quote = { id: `q${Math.random()}`, ...args, tender_id: args?.tenderID };
      world.quotes[String(args?.tenderID)] = [...(world.quotes[String(args?.tenderID)] ?? []), quote];
      return quote;
    },
  };
  return { reply, created };
};

const fill = async (label: string, value: string) => {
  const box = screen.getByLabelText(label);
  await userEvent.clear(box);
  await userEvent.type(box, value);
};

const paneRowTitles = () => Array.from(pane().querySelectorAll(".rows .row .ttl")).map((title) => title.textContent);

const addQuote = async (supplier: string, amount: string) => {
  await userEvent.click(screen.getByRole("button", { name: "Add quote" }));
  await fill("Supplier", supplier);
  await fill("Amount", amount);
  await userEvent.click(screen.getByRole("button", { name: "Save quote" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Save quote" })).toBeNull());
};

describe("Open tender and Add quote", () => {
  it("a manager opens a tender on a budget line and finds it in the list", async () => {
    const { reply, created } = living(manager, { tenders: tenders.slice(0, 1), quotes: { t1: [] } });
    open(reply);
    await screen.findByText("Plastic chairs");

    await userEvent.click(await screen.findByRole("button", { name: "Open tender" }));
    await userEvent.click(await screen.findByLabelText("Budget line"));
    expect(await screen.findByRole("dialog", { name: "Budget line" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("option", { name: /Street lighting/ }));
    await fill("Title", "LED lamps");
    await fill("Description", "Forty lamps for the ring road");
    await fill("Closes on", "2026-06-01");
    await userEvent.click(screen.getByRole("button", { name: "Save tender" }));

    expect(await screen.findByText("LED lamps")).toBeInTheDocument();
    expect(created).toEqual([{ id: "t2", budget_id: "b2", title: "LED lamps", description: "Forty lamps for the ring road", closes_at: "2026-06-01T00:00:00Z" }]);
    expect(screen.getAllByText("Waiting for quote")).toHaveLength(2);
  });

  it("adding two quotes lists both as rows, marks the lowest and changes the chip to Quoted", async () => {
    const { reply } = living(manager, { tenders: tenders.slice(0, 1), quotes: { t1: [] } });
    const called = open(reply);
    await userEvent.click(await screen.findByRole("button", { name: /Plastic chairs/ }));
    await waitFor(() => expect(pane().textContent).toContain("Waiting for quote"));

    await addQuote("Acme Supplies", "950");
    await waitFor(() => expect(paneRowTitles()).toContain("Acme Supplies"));
    await addQuote("Beta Traders", "900");

    await waitFor(() => expect(paneRowTitles()).toContain("Beta Traders"));
    expect(paneRowTitles().filter((title) => title === "Acme Supplies" || title === "Beta Traders")).toEqual(["Beta Traders", "Acme Supplies"]);
    const beta = Array.from(pane().querySelectorAll(".row")).find((row) => row.textContent?.includes("Beta Traders")) as HTMLElement;
    const acme = Array.from(pane().querySelectorAll(".row")).find((row) => row.textContent?.includes("Acme Supplies")) as HTMLElement;
    expect(beta.textContent).toContain("Lowest");
    expect(acme.textContent).not.toContain("Lowest");
    expect(pane().textContent).toContain("Quoted");
    expect(pane().textContent).not.toContain("Waiting for quote");
    expect(screen.getByRole("button", { name: /Plastic chairs/ }).textContent).toContain("Quoted");
    expect(called.mock.calls.filter(([, tool]) => tool === "accounting_quote_create").map(([, , args]) => args)).toEqual([
      { tenderID: "t1", supplier: "Acme Supplies", amount: 950 },
      { tenderID: "t1", supplier: "Beta Traders", amount: 900 },
    ]);
  });

  it("shows a tender with its description, its budget line and no comma-joined quotes line", async () => {
    const { reply } = living(manager, {
      tenders: [{ ...tenders[1], description: "A4, 80 gsm" }],
      quotes: quotesOf,
    });
    open(reply);
    await userEvent.click(await screen.findByRole("button", { name: /Printer paper/ }));

    await waitFor(() => expect(paneRowTitles()).toContain("Acme Supplies"));
    expect(paneRowTitles()).toEqual(expect.arrayContaining(["Description", "Budget line"]));
    expect(pane().textContent).toContain("A4, 80 gsm");
    expect(pane().textContent).toContain("Road repairs");
    expect(pane().textContent).not.toContain("Acme Supplies 950, Beta");
  });

  it("a caller without accounting.manage sees neither Open tender nor Add quote", async () => {
    const { reply } = living({ permissions: ["accounting.view"] }, { tenders, quotes: quotesOf });
    open(reply);
    await userEvent.click(await screen.findByRole("button", { name: /Printer paper/ }));
    await waitFor(() => expect(pane().textContent).toContain("Beta Traders"));

    expect(screen.queryByRole("button", { name: "Open tender" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add quote" })).toBeNull();
  });

  it("the empty card carries the Open tender button for a manager", async () => {
    const { reply } = living(manager, { tenders: [], quotes: {} });
    open(reply);

    expect(await screen.findByText("No tenders yet.")).toBeInTheDocument();
    expect(await screen.findAllByRole("button", { name: "Open tender" })).toHaveLength(1);
  });
});
