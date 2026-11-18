import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let mayAdd: boolean;

const lists = [
  { screen: "Businesses", path: () => residentPaths.businesses.path(), code: "RC-1", recordName: "Businesses", add: "Add business", row: { id: "b1", answers: { "Trading name": "Malomsor Bakery", "Kind of business": "Bakery", Neighbourhood: "Malomsor" } }, title: "Malomsor Bakery" },
  { screen: "Informal traders", path: () => residentPaths.informalTraders.path(), code: "RC-2", recordName: "Informal traders", add: "Add trader", row: { id: "t1", answers: { "Name or alias": "Marika's flower stand", "Kind of trader": "Street seller", Neighbourhood: "Óváros" } }, title: "Marika's flower stand" },
];

const hub = (list: (typeof lists)[number], rows: unknown[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_list_live_records") return { items: [{ code: list.code, name: list.recordName, can_add_rows: mayAdd }] };
    if (tool === "agency_list_live_record_rows") return { items: rows };
    return { items: [] };
  });

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("town");
  mayAdd = true;
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe.each(lists)("the $screen list", (list) => {
  it("carries the full-width Add button above Search for a person who may add rows", async () => {
    hub(list, [list.row]);
    show(list.path());
    await screen.findByText(list.title);
    const button = await screen.findByRole("button", { name: list.add });
    expect(button.compareDocumentPosition(await screen.findByLabelText("Search")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("link", { name: list.add })).toBeNull();
  });

  it("shows no Add button to a person who may not add rows", async () => {
    mayAdd = false;
    hub(list, [list.row]);
    show(list.path());
    await screen.findByText(list.title);
    expect(screen.queryByRole("button", { name: list.add })).toBeNull();
  });
});
