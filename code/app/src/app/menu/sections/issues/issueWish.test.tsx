import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { IssueScreen } from "./index";

type Wish = { id: string; title: string; raised_by: number; me_too: number };

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let wishes: Wish[];
let groupRefusal: string;
let listFails: boolean;
let issue: { id: string; title: string; status: string; department: string; boardItemId: string };

const groupedIssue = { id: "i1", title: "Broken streetlight", status: "open", department: "Roads", boardItemId: "b1" };
const ungroupedIssue = { ...groupedIssue, boardItemId: "" };

const bump = (id: string, by: number) => {
  wishes = wishes.map((wish) => (wish.id === id ? { ...wish, raised_by: wish.raised_by + by } : wish));
};

beforeEach(() => {
  openAgency("town");
  permissions = ["board.manage"];
  groupRefusal = "";
  listFails = false;
  issue = groupedIssue;
  wishes = [
    { id: "b1", title: "Lamps out on Fenyo utca", raised_by: 2, me_too: 0 },
    { id: "b2", title: "Pothole on Kossuth ter", raised_by: 1, me_too: 0 },
  ];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, string>;
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "forms_catalog_reply_list") return { items: [] };
    if (name === "forms_catalog_board_item_read") return { id: "b1", outcome: "" };
    if (name === "forms_catalog_raised_item_reassign" || name === "forms_catalog_board_item_set_outcome") return {};
    if (name === "forms_catalog_board_item_list") {
      if (listFails) throw new mcp.McpError("forms_catalog_board_item_list: unavailable");
      return { items: wishes };
    }
    if (name === "forms_catalog_board_item_put") {
      const made = { id: "b3", title: given.title, raised_by: 0, me_too: 0 };
      wishes = [...wishes, made];
      return made;
    }
    if (name === "forms_catalog_raised_item_group") {
      if (groupRefusal) throw new mcp.McpError(groupRefusal);
      bump(given.board_item_id, 1);
      return {};
    }
    if (name === "forms_catalog_raised_item_ungroup") {
      bump("b1", -1);
      return {};
    }
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openIssue = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/issues/all/i1", state: { issue } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/all/:id" element={<IssueScreen />} />
      </Routes>
    </MemoryRouter>,
  );

const wishRow = async () => {
  const card = await screen.findByRole("region", { name: "Wish" });
  return card.querySelector(".row") as HTMLElement;
};

const listReads = () => called.mock.calls.filter((call) => call[1] === "forms_catalog_board_item_list");

describe("grouping an issue under a wish from its screen", () => {
  it("shows a caller with board.manage the wish a grouped issue belongs to and how many raised it", async () => {
    openIssue();

    const row = await wishRow();

    expect(within(row).getByText("Lamps out on Fenyo utca")).toBeInTheDocument();
    expect(within(row).getByText("raised by 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ungroup" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to wish" })).toBeNull();
  });

  it("ungroups the issue, drops the Wish row and offers Add to wish", async () => {
    openIssue();
    await wishRow();

    await userEvent.click(screen.getByRole("button", { name: "Ungroup" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_ungroup", { raisedItemID: "i1" }));
    expect(await screen.findByRole("button", { name: "Add to wish" })).toBeInTheDocument();
    expect(screen.queryByText("Wish")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ungroup" })).toBeNull();
  });

  it("lists the existing wishes for an ungrouped issue and shows the picked one with its raised-by count read again", async () => {
    issue = ungroupedIssue;
    openIssue();

    await userEvent.click(await screen.findByRole("button", { name: "Add to wish" }));
    const choices = await screen.findByRole("group", { name: "Add to wish" });
    expect(within(choices).getByRole("button", { name: "Lamps out on Fenyo utca" })).toBeInTheDocument();
    expect(within(choices).getByRole("button", { name: "Pothole on Kossuth ter" })).toBeInTheDocument();
    expect(within(choices).getByLabelText("New wish")).toBeInTheDocument();
    expect(within(choices).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect((within(choices).getByRole("button", { name: "Start a new wish" }) as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(within(choices).getByRole("button", { name: "Pothole on Kossuth ter" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_group", { raisedItemID: "i1", board_item_id: "b2" }));
    const row = await wishRow();
    expect(await within(row).findByText("raised by 2")).toBeInTheDocument();
    expect(within(row).getByText("Pothole on Kossuth ter")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Add to wish" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ungroup" })).toBeInTheDocument();
  });

  it("closes the choice on Cancel without grouping anything", async () => {
    issue = ungroupedIssue;
    openIssue();

    await userEvent.click(await screen.findByRole("button", { name: "Add to wish" }));
    await screen.findByRole("group", { name: "Add to wish" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: "Add to wish" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to wish" })).toBeInTheDocument();
    expect(called).not.toHaveBeenCalledWith("", "forms_catalog_raised_item_group", expect.anything());
  });

  it("starts a new wish from a typed title, groups the issue under the id the hub made and shows raised by 1", async () => {
    issue = ungroupedIssue;
    openIssue();

    await userEvent.click(await screen.findByRole("button", { name: "Add to wish" }));
    const choices = await screen.findByRole("group", { name: "Add to wish" });
    await userEvent.type(within(choices).getByLabelText("New wish"), "Streetlights out on Fenyo utca");
    await userEvent.click(within(choices).getByRole("button", { name: "Start a new wish" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_board_item_put", { title: "Streetlights out on Fenyo utca" }));
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_group", { raisedItemID: "i1", board_item_id: "b3" }));
    const row = await wishRow();
    expect(await within(row).findByText("raised by 1")).toBeInTheDocument();
    expect(within(row).getByText("Streetlights out on Fenyo utca")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Add to wish" })).toBeNull();
  });

  it("shows the hub's words when it refuses the group and leaves the issue without a Wish row", async () => {
    issue = ungroupedIssue;
    groupRefusal = "forms_catalog_raised_item_group: only a publishable report can be grouped";
    openIssue();

    await userEvent.click(await screen.findByRole("button", { name: "Add to wish" }));
    const choices = await screen.findByRole("group", { name: "Add to wish" });
    await userEvent.click(within(choices).getByRole("button", { name: "Pothole on Kossuth ter" }));

    expect(await screen.findByText("only a publishable report can be grouped")).toBeInTheDocument();
    expect(screen.queryByText("Wish")).toBeNull();
  });

  it("shows no Wish row, Add to wish or Ungroup to a caller without board.manage and never reads the wishes", async () => {
    openIssue();
    await wishRow();
    cleanup();
    called.mockClear();

    permissions = ["board_item.reply"];
    openIssue();
    await screen.findByText("Roads");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByText("Wish")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to wish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ungroup" })).toBeNull();
    expect(listReads()).toHaveLength(0);
  });

  it("shows no Wish row and keeps the screen when the wishes cannot be read for a grouped issue", async () => {
    listFails = true;
    openIssue();

    await waitFor(() => expect(listReads().length).toBeGreaterThan(0));
    await screen.findByText("Roads");

    expect(screen.queryByText("Wish")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ungroup" })).toBeNull();
    expect(screen.getByText("Broken streetlight")).toBeInTheDocument();
  });
});
