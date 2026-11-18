import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { carriedChatAbout, carryChatAbout, forgetChatAbout } from "../../../chatAbout";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { TendersScreen } from "./TendersScreen";

let permissions: string[];

const tender = { id: "t2", budget_id: "b1", title: "Printer paper", description: "A4, 80 gsm", closes_at: "2026-05-01T00:00:00Z", quote_count: 2, lowest_amount: 900 };

const quotes = [
  { id: "q2", tender_id: "t2", supplier: "Beta Traders", amount: 900, valid_until: "2026-04-30T00:00:00Z" },
  { id: "q1", tender_id: "t2", supplier: "Acme Supplies", amount: 950 },
];

const answer = async (name: string) => {
  if (name === "accounting_tender_list") return { items: [tender] };
  if (name === "accounting_tender_read") return tender;
  if (name === "accounting_quote_list") return { items: quotes };
  if (name === "accounting_budget_read") return { id: "b1", name: "Road repairs" };
  if (name === "agency_get_my_roles") return { permissions };
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

function Where() {
  const here = useLocation();
  return <p data-testid="where">{`${here.pathname}${here.search}`}</p>;
}

const open = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/finance/procurement"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/procurement" element={<TendersScreen />} />
        <Route path="/a/:agencyId/menu/finance/budget" element={<Where />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Printer paper/ }));
  return within(document.querySelector(".wf-main .wf-content") as HTMLElement);
};

describe("the tender page is built like a resident", () => {
  it("titles the page with the tender, puts the status on one quiet line and draws no band", async () => {
    const pane = await open();
    expect(await pane.findByRole("heading", { level: 1, name: "Printer paper" })).toBeInTheDocument();
    expect(document.querySelector(".quiet-line")?.textContent).toContain("Quoted");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("holds the description, budget line and closing day as rows of one Tender card with Edit in its footer", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Tender" }));
    for (const label of ["Description", "Budget line", "Closes"]) expect(card.getByText(label)).toBeInTheDocument();
    expect(card.getByText("Road repairs")).toBeInTheDocument();
    expect(card.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(card.getByRole("button", { name: "Edit" }).closest("footer")).not.toBeNull();
  });

  it("lists the quotes as rows of a Quotes card with Add quote in its footer", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Quotes" }));
    expect(card.getByText("Beta Traders")).toBeInTheDocument();
    expect(card.getByText("Acme Supplies")).toBeInTheDocument();
    expect(card.getByText("Lowest")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Add quote" }).closest("footer")).not.toBeNull();
  });

  it("shows no act to a reader without accounting.manage", async () => {
    permissions = [];
    const pane = await open();
    await pane.findByRole("region", { name: "Tender" });
    expect(pane.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(pane.queryByRole("button", { name: "Add quote" })).toBeNull();
  });

  it("carries the tender to the chat", async () => {
    const pane = await open();
    await pane.findByRole("region", { name: "Tender" });
    carryChatAbout();
    expect(carriedChatAbout()).toMatchObject({ kind: "tender", id: "t2", name: "Printer paper" });
  });
});

describe("the quotes open one edit screen and the budget line opens its page", () => {
  const quotesCard = async () => within(await (await open()).findByRole("region", { name: "Quotes" }));

  it("lists each quote as a row that opens its edit screen, with no Edit bar inside the Quotes card", async () => {
    const card = await quotesCard();
    expect(card.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(card.getByRole("button", { name: /Beta Traders/ })).toBeInTheDocument();
    expect(card.getByRole("button", { name: /Acme Supplies/ })).toBeInTheDocument();
  });

  it("opens the edit screen with the quote's values, saves through accounting_quote_update and returns to the tender", async () => {
    const card = await quotesCard();
    await userEvent.click(card.getByRole("button", { name: /Beta Traders/ }));
    expect(await screen.findByLabelText("Supplier")).toHaveValue("Beta Traders");
    const amount = screen.getByLabelText("Amount");
    await userEvent.clear(amount);
    await userEvent.type(amount, "880");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "accounting_quote_update", expect.objectContaining({ quoteID: "q2", supplier: "Beta Traders", amount: 880 })));
    expect(await screen.findByRole("region", { name: "Quotes" })).toBeInTheDocument();
  });

  it("goes back to the tender from the quote edit screen without saving", async () => {
    const card = await quotesCard();
    await userEvent.click(card.getByRole("button", { name: /Acme Supplies/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("region", { name: "Quotes" })).toBeInTheDocument();
    expect(mcp.callTool).not.toHaveBeenCalledWith("", "accounting_quote_update", expect.anything());
  });

  it("opens the Add quote form from the footer and saves through accounting_quote_create", async () => {
    const card = await quotesCard();
    await userEvent.click(card.getByRole("button", { name: "Add quote" }));
    await userEvent.type(await screen.findByLabelText("Supplier"), "Gamma Supplies");
    await userEvent.type(screen.getByLabelText("Amount"), "700");
    await userEvent.click(screen.getByRole("button", { name: "Save quote" }));
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "accounting_quote_create", expect.objectContaining({ tenderID: "t2", supplier: "Gamma Supplies", amount: 700 })));
  });

  it("lets a reader without accounting.manage see the quotes but open nothing", async () => {
    permissions = [];
    const card = await quotesCard();
    expect(card.getByText("Beta Traders")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: /Beta Traders/ })).toBeNull();
  });

  it("opens the budget line page from the Budget line row", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Tender" }));
    await userEvent.click(card.getByRole("button", { name: /Road repairs/ }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/a/town/menu/finance/budget?line=b1");
  });
});
