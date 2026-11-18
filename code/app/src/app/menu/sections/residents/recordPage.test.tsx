import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const ownerId = "7d3c9a52-1b44-4f0e-9a37-5c1e8b2f6d10";

type Screen = { name: string; code: string; path: () => string; row: { id: string; answers: Record<string, string> }; detail: string; holder: string };

const screens: Screen[] = [
  {
    name: "Businesses",
    code: "RC-1",
    path: () => residentPaths.businesses.path(),
    row: { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Neighbourhood: "Malomsor", Status: "Active", Owner: ownerId } },
    detail: "Business detail",
    holder: "Owner",
  },
  {
    name: "Informal traders",
    code: "RC-2",
    path: () => residentPaths.informalTraders.path(),
    row: { id: "t1", answers: { "Name or alias": "Marika's flower stand", "Kind of trader": "Stall holder at the market", "What is sold": "Flowers", Neighbourhood: "Óváros", Status: "Active", Holder: ownerId } },
    detail: "Trader detail",
    holder: "Holder",
  },
];

const callsFor = (code: string, row: unknown) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "agency_list_live_record_rows" && (args as { record_code?: string }).record_code === code) return { items: [row] };
    if (name === "actor_get_actor") return { item: { id: ownerId, display_name: "Szabó Katalin" } };
    return { items: [] };
  });

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const title = (row: { answers: Record<string, string> }) => Object.values(row.answers)[0];

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe.each(screens)("the $name record page", ({ code, path, row, detail, holder }) => {
  const open = async () => {
    setWide(true);
    callsFor(code, row);
    show(path());
    await userEvent.click(await screen.findByText(title(row), { selector: ".ttl" }));
    return document.querySelector(".wf .wf-main .wf-content") as HTMLElement;
  };

  it("has the record's name as the page title and no header band", async () => {
    const pane = await open();
    expect(await within(pane).findByRole("heading", { level: 1, name: title(row) })).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
    expect(within(pane).getByText("Active · " + row.answers.Neighbourhood)).toBeInTheDocument();
  });

  it("holds the answers as plain rows in a card named for the record", async () => {
    const pane = await open();
    const card = await within(pane).findByRole("region", { name: detail });
    Object.entries(row.answers)
      .filter(([prompt]) => prompt !== holder)
      .forEach(([prompt, answer]) => {
        expect(within(card).getByText(prompt)).toBeInTheDocument();
        expect(within(card).getAllByText(answer).length).toBeGreaterThan(0);
      });
    expect(card.querySelector(".lead")).toBeNull();
  });

  it("shows the owner or holder as a resident row, never the id", async () => {
    const pane = await open();
    const card = await within(pane).findByRole("region", { name: holder });
    expect(await within(card).findByText("Szabó Katalin")).toBeInTheDocument();
    expect(card.querySelector(".lead")).not.toBeNull();
    expect(within(pane).queryByText(ownerId)).toBeNull();
  });

  it("keeps the bottom bar", async () => {
    await open();
    expect(screen.getByRole("link", { name: /chat/i })).toBeInTheDocument();
  });
});
