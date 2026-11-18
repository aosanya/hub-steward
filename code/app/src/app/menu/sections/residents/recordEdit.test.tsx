import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const ownerId = "7d3c9a52-1b44-4f0e-9a37-5c1e8b2f6d10";

type Screen = {
  name: string;
  code: string;
  recordName: string;
  path: () => string;
  editPath: (id: string) => string;
  row: { id: string; answers: Record<string, string> };
  holder: string;
  title: string;
  changed: { prompt: string; was: string; to: string };
};

const screens: Screen[] = [
  {
    name: "Businesses",
    code: "RC-1",
    recordName: "Businesses",
    path: () => residentPaths.businesses.path(),
    editPath: (id) => residentPaths.businessEdit.path({ id }),
    row: { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", "Tax number": "10000000-1-01", Neighbourhood: "Malomsor", Status: "Active", Owner: ownerId } },
    holder: "Owner",
    title: "Edit business",
    changed: { prompt: "Kind of business", was: "Bakery", to: "Bakery and cafe" },
  },
  {
    name: "Informal traders",
    code: "RC-2",
    recordName: "Informal traders",
    path: () => residentPaths.informalTraders.path(),
    editPath: (id) => residentPaths.informalTraderEdit.path({ id }),
    row: { id: "t1", answers: { "Name or alias": "Marika's flower stand", "Kind of trader": "Stall holder at the market", "What is sold": "Flowers", Neighbourhood: "Óváros", Status: "Active", Holder: ownerId } },
    holder: "Holder",
    title: "Edit trader",
    changed: { prompt: "What is sold", was: "Flowers", to: "Flowers and honey" },
  },
];

let landed = "";

const Where = () => {
  const location = useLocation();
  landed = location.pathname + location.search;
  return null;
};

const hub = (one: Screen, mayAdd: boolean) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    if (name === "agency_list_live_records") return { items: [{ code: one.code, name: one.recordName, can_add_rows: mayAdd }] };
    if (name === "agency_list_live_record_rows" && (args as { record_code?: string }).record_code === one.code) return { items: [one.row] };
    if (name === "actor_get_actor") return { item: { id: ownerId, display_name: "Szabó Katalin" } };
    if (name === "actor_list_actors") return { items: [{ id: ownerId, display_name: "Szabó Katalin" }] };
    if (name === "agency_add_live_record_row") return { id: "new" };
    return { items: [] };
  });

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const title = (one: Screen) => Object.values(one.row.answers)[0];

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe.each(screens)("the $name record edit", (one) => {
  const openRecord = async () => {
    setWide(true);
    show(one.path());
    await userEvent.click(await screen.findByText(title(one), { selector: ".ttl" }));
    return document.querySelector(".wf .wf-main .wf-content") as HTMLElement;
  };

  it("puts an accent Edit act in the detail card footer for someone who may add rows", async () => {
    hub(one, true);
    const pane = await openRecord();
    const card = await within(pane).findByRole("region", { name: /detail$/ });
    const edit = await within(card).findByRole("button", { name: "Edit" });
    expect(edit).toHaveClass("sec-act");
    expect(card.querySelector(".sec-foot")).toContainElement(edit);
  });

  it("shows no Edit act to someone who may not add rows", async () => {
    hub(one, false);
    const pane = await openRecord();
    await within(pane).findByRole("region", { name: /detail$/ });
    expect(within(pane).queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens one edit screen that holds the saved answers", async () => {
    hub(one, true);
    const pane = await openRecord();
    await userEvent.click(await within(pane).findByRole("button", { name: "Edit" }));
    expect(landed).toContain(one.editPath(one.row.id));
    expect(await screen.findByRole("heading", { level: 1, name: one.title })).toBeInTheDocument();
    expect(await screen.findByDisplayValue(one.changed.was)).toBeInTheDocument();
  });

  it("saves a replacing row with the changed answer and returns to the record the replacing row made", async () => {
    const calls = hub(one, true);
    show(one.editPath(one.row.id));
    const field = await screen.findByDisplayValue(one.changed.was);
    await userEvent.clear(field);
    await userEvent.type(field, one.changed.to);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls).toHaveBeenCalledWith("", "agency_add_live_record_row", expect.objectContaining({ record_code: one.code, replaces: one.row.id, answers: expect.objectContaining({ [one.changed.prompt]: one.changed.to, [one.holder]: ownerId }) })));
    await waitFor(() => expect(landed).toContain("row=new"));
    expect(landed).toContain(one.path());
  });

  it("goes back to the record from the phone back arrow", async () => {
    hub(one, true);
    setWide(false);
    show(one.editPath(one.row.id));
    await screen.findByDisplayValue(one.changed.was);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(one.name, "i") }));
    expect(landed).toContain(one.path());
  });

  it("opens the resident from the owner or holder row", async () => {
    hub(one, false);
    const pane = await openRecord();
    const card = await within(pane).findByRole("region", { name: one.holder });
    await userEvent.click(await within(card).findByText("Szabó Katalin"));
    expect(landed).toBe(residentPaths.people.path({ person: ownerId }));
  });
});
