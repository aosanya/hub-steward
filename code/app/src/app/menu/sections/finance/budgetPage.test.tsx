import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { carriedChatAbout, carryChatAbout, forgetChatAbout } from "../../../chatAbout";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { BudgetScreen } from "./BudgetScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let permissions: string[];

const line = { id: "b1", name: "Sample Road Repairs", department: "Public Works", account_id: "ac1", period_start: "2026-01-01", period_end: "2026-02-01", planned: 1000, spent: 250 };

const answer = async (name: string) => {
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "accounting_budget_list") return { items: [line] };
  if (name === "accounting_budget_read") return line;
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

const open = async (start = "/a/town/menu/finance/budget") => {
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/a/:agencyId/menu/finance/budget" element={<BudgetScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  if (!start.includes("?")) await userEvent.click(await screen.findByRole("button", { name: /Sample Road Repairs/ }));
  return within(document.querySelector(".wf-main .wf-content") as HTMLElement);
};

describe("the budget line page is built like a resident", () => {
  it("titles the page with the line, puts the period and share spent on one quiet line and draws no band", async () => {
    const pane = await open();
    expect(await pane.findByRole("heading", { level: 1, name: "Sample Road Repairs" })).toBeInTheDocument();
    expect(document.querySelector(".quiet-line")?.textContent).toBe("2026-01-01 to 2026-01-31 · 25% spent");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("holds the figures as rows of one Budget line card with Edit in its footer", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Budget line" }));
    for (const label of ["Department", "Planned", "Spent", "Remaining", "Share spent"]) expect(card.getByText(label)).toBeInTheDocument();
    expect(card.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(card.getByRole("button", { name: "Edit" }).closest("footer")).not.toBeNull();
  });

  it("shows no Edit to a reader without accounting.manage", async () => {
    permissions = [];
    const pane = await open();
    await pane.findByRole("region", { name: "Budget line" });
    expect(pane.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("carries the budget line to the chat", async () => {
    const pane = await open();
    await pane.findByRole("region", { name: "Budget line" });
    carryChatAbout();
    expect(carriedChatAbout()).toMatchObject({ kind: "budget", id: "b1", name: "Sample Road Repairs" });
  });
});

describe("a budget line opens from a link", () => {
  it("opens the line named by ?line= without a click", async () => {
    const pane = await open("/a/town/menu/finance/budget?line=b1");
    expect(await pane.findByRole("heading", { level: 1, name: "Sample Road Repairs" })).toBeInTheDocument();
  });
});
