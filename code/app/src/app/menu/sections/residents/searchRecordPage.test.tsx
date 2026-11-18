import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const ownerId = "7d3c9a52-1b44-4f0e-9a37-5c1e8b2f6d10";

type Kind = {
  name: string;
  code: string;
  recordName: string;
  word: string;
  holder: string;
  row: { id: string; answers: Record<string, string> };
  heading: string;
  quiet: string;
  detail: string;
  rowOnly: string;
  editPath: string;
};

const kinds: Kind[] = [
  {
    name: "business",
    code: "RC-1",
    recordName: "Businesses",
    word: "Bakery",
    holder: "Owner",
    row: { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Neighbourhood: "Malomsor", Status: "Active", Owner: ownerId } },
    heading: "Malomsor Bakery",
    quiet: "Active · Malomsor",
    detail: "Business detail",
    rowOnly: "Tax number",
    editPath: residentPaths.businessEdit.path({ id: "b1" }),
  },
  {
    name: "informal trader",
    code: "RC-2",
    recordName: "Informal traders",
    word: "Flowers",
    holder: "Holder",
    row: { id: "t1", answers: { "Name or alias": "Marika's flower stand", "Kind of trader": "Stall holder at the market", "What is sold": "Flowers", Neighbourhood: "Óváros", Status: "Active", Holder: ownerId } },
    heading: "Marika's flower stand",
    quiet: "Active · Óváros",
    detail: "Trader detail",
    rowOnly: "Kind of trader",
    editPath: residentPaths.informalTraderEdit.path({ id: "t1" }),
  },
];

let landed = "";

const Where = () => {
  const location = useLocation();
  landed = location.pathname + location.search;
  return null;
};

const hub = (one: Kind, mayAdd: boolean) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "agency_list_live_records") return { items: [{ code: one.code, name: one.recordName, can_add_rows: mayAdd }] };
    if (name === "agency_list_live_record_rows") return { items: (args as { record_code?: string }).record_code === one.code ? [one.row] : [] };
    if (name === "actor_get_actor") return { item: { id: ownerId, display_name: "Szabó Katalin" } };
    if (name === "actor_list_actors") return { items: [{ id: ownerId, display_name: "Szabó Katalin" }] };
    return { items: [] };
  });

const show = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/residents/search", state: { from: { path: "/a/town/menu/residents", title: "People" } } }]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe.each(kinds)("a $name opened from the combined search", (one) => {
  const openFromSearch = async () => {
    setWide(true);
    show();
    await userEvent.type(await screen.findByRole("searchbox", { name: "Search" }), one.word);
    await userEvent.click(await screen.findByText(one.heading, { selector: ".ttl" }));
    return document.querySelector(".wf .wf-main .wf-content") as HTMLElement;
  };

  it("shows the name as the page title with its quiet line, as the register screen does", async () => {
    hub(one, false);
    const pane = await openFromSearch();
    expect(await within(pane).findByRole("heading", { level: 1, name: one.heading })).toBeInTheDocument();
    expect(within(pane).getByText(one.quiet)).toBeInTheDocument();
  });

  it("shows one detail card that holds the answers once, with no second plain list of them", async () => {
    hub(one, false);
    const pane = await openFromSearch();
    const card = await within(pane).findByRole("region", { name: new RegExp(`${one.detail}$`) });
    expect(within(card).getByText(one.rowOnly)).toBeInTheDocument();
    expect(within(pane).getAllByText(one.rowOnly)).toHaveLength(1);
  });

  it("puts an accent Edit act in the detail card footer for someone who may add rows", async () => {
    hub(one, true);
    const pane = await openFromSearch();
    const card = await within(pane).findByRole("region", { name: new RegExp(`${one.detail}$`) });
    const edit = await within(card).findByRole("button", { name: "Edit" });
    expect(edit).toHaveClass("sec-act");
    expect(card.querySelector(".sec-foot")).toContainElement(edit);
    await userEvent.click(edit);
    expect(landed).toBe(one.editPath);
  });

  it("shows no Edit act to someone who may not add rows", async () => {
    hub(one, false);
    const pane = await openFromSearch();
    await within(pane).findByRole("region", { name: new RegExp(`${one.detail}$`) });
    expect(within(pane).queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens the resident from the owner or holder card", async () => {
    hub(one, false);
    const pane = await openFromSearch();
    const card = await within(pane).findByRole("region", { name: one.holder });
    await userEvent.click(await within(card).findByText("Szabó Katalin"));
    expect(landed).toBe(residentPaths.people.path({ person: ownerId }));
  });
});

describe("a business opened from the combined search", () => {
  it("shows the Licences card the Businesses screen shows", async () => {
    const one = kinds[0];
    hub(one, false);
    setWide(true);
    show();
    await userEvent.type(await screen.findByRole("searchbox", { name: "Search" }), one.word);
    await userEvent.click(await screen.findByText(one.heading, { selector: ".ttl" }));
    const pane = document.querySelector(".wf .wf-main .wf-content") as HTMLElement;
    expect(await within(pane).findByRole("region", { name: /Licences/ })).toBeInTheDocument();
  });
});
