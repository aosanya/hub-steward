import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { carriedChatAbout, carryChatAbout, forgetChatAbout } from "../../../chatAbout";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { NeighbourhoodSpendingScreen } from "./NeighbourhoodSpendingScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const totals = [
  { value: "Kertváros", total: 1820000, entries: 1 },
  { value: "Malomsor", total: 4200000, entries: 2 },
];

const entriesOfMalomsor = [
  { id: "e2", occurred_at: "2026-03-02T09:00:00Z", amount: 3000000, narration: "Pothole repair, spring round", account: "repairs" },
  { id: "e1", occurred_at: "2026-01-10T09:00:00Z", amount: 1200000, narration: "Winter gritting", account: "repairs" },
];

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "accounting_dimension_totals") return { key: "neighbourhood", account_type: "expense", totals };
    if (name === "accounting_dimension_entries") return { entries: entriesOfMalomsor };
    return { items: [] };
  });
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
    <MemoryRouter initialEntries={["/a/town/menu/finance/spending-by-neighbourhood"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/spending-by-neighbourhood" element={<NeighbourhoodSpendingScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Malomsor/ }));
  return within(document.querySelector(".wf-main .wf-content") as HTMLElement);
};

describe("the neighbourhood page is built like a resident", () => {
  it("titles the page with the neighbourhood, puts what was spent and the entries on one quiet line and draws no band", async () => {
    const pane = await open();
    expect(await pane.findByRole("heading", { level: 1, name: "Malomsor" })).toBeInTheDocument();
    expect(document.querySelector(".quiet-line")?.textContent).toBe("Spent 4,200,000 · 2 entries");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("holds what was spent and the entries as plain rows of one Spending card with no footer", async () => {
    const pane = await open();
    const region = await pane.findByRole("region", { name: "Spending" });
    const card = within(region);
    expect(card.getByText("Spent")).toBeInTheDocument();
    expect(card.getByText("4,200,000")).toBeInTheDocument();
    expect(card.getByText("Entries").closest(".row")?.textContent).toContain("2");
    expect(region.querySelector("footer")).toBeNull();
  });

  it("says one entry, not 1 entries", async () => {
    render(
      <MemoryRouter initialEntries={["/a/town/menu/finance/spending-by-neighbourhood"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/finance/spending-by-neighbourhood" element={<NeighbourhoodSpendingScreen />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Kertváros/ }));
    await screen.findByRole("heading", { level: 1, name: "Kertváros" });
    expect(document.querySelector(".quiet-line")?.textContent).toBe("Spent 1,820,000 · 1 entry");
  });

  it("carries the neighbourhood to the chat", async () => {
    const pane = await open();
    await pane.findByRole("region", { name: "Spending" });
    carryChatAbout();
    expect(carriedChatAbout()).toMatchObject({ kind: "neighbourhood", id: "Malomsor", name: "Malomsor" });
  });

  it("lists the entries of the opened neighbourhood, newest first, each with what it was for, its day and its amount", async () => {
    const pane = await open();
    const region = await pane.findByRole("region", { name: "Entries" });
    const rows = Array.from(region.querySelectorAll(".row"));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Pothole repair, spring round");
    expect(rows[0].textContent).toContain("2026-03-02 · 3,000,000");
    expect(rows[1].textContent).toContain("Winter gritting");
    expect(mcp.callTool).toHaveBeenCalledWith("", "accounting_dimension_entries", { key: "neighbourhood", value: "Malomsor", account_type: "expense" });
  });

  it("shows a shared entry with its share of the whole, so the rows add up to what was spent", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
      if (name === "accounting_dimension_totals") return { key: "neighbourhood", account_type: "expense", totals: [{ value: "Malomsor", total: 4600000, entries: 3 }] };
      if (name === "accounting_dimension_entries") {
        return {
          entries: [
            { id: "e3", occurred_at: "2026-01-15T09:00:00Z", amount: 400000, whole: 1000000, share_percent: 40, narration: "Resurfacing of Fő utca", account: "repairs" },
            ...entriesOfMalomsor,
          ],
        };
      }
      return { items: [] };
    });
    const pane = await open();
    const region = await pane.findByRole("region", { name: "Entries" });
    const rows = Array.from(region.querySelectorAll(".row"));
    expect(rows[0].textContent).toContain("Resurfacing of Fő utca");
    expect(rows[0].textContent).toContain("2026-01-15 · 40% of 1,000,000 · 400,000");
    expect(rows[1].textContent).not.toContain("% of");
  });

  it("draws no Entries card for the row of spending with no neighbourhood", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
      if (name === "accounting_dimension_totals") return { key: "neighbourhood", account_type: "expense", totals: [], without: { total: 7400000, entries: 2 } };
      return { items: [] };
    });
    render(
      <MemoryRouter initialEntries={["/a/town/menu/finance/spending-by-neighbourhood"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/finance/spending-by-neighbourhood" element={<NeighbourhoodSpendingScreen />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /No neighbourhood/ }));
    await screen.findByRole("heading", { level: 1, name: "No neighbourhood" });
    expect(screen.queryByRole("region", { name: "Entries" })).toBeNull();
  });
});
