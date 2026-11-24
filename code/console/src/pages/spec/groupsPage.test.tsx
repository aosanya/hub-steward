import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listDisabledGroups, setGroupDisabled } from "../../data/disabledGroups";
import { callTool } from "../../wakala/mcp";
import { GroupsPage } from "./groupsPage";
import { answering, clearPages, clearShown, failing, installPage, renderSpec, shown } from "./specHarness.test-helper";
import { actionItem, actionNames, chooseAction } from "../../ui/pageHeader.test-support";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

vi.mock("../../data/disabledGroups", () => ({ listDisabledGroups: vi.fn(), setGroupDisabled: vi.fn() }));

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(async () => ({})),
}));

const groupRows = [
  { id: "g1", group: "Siaya farmers", members: 12, mode: "open", ai_role: "Helper" },
  { id: "g2", group: "Boda riders", members: 3, mode: "confirmed", ai_role: "" },
  { id: "g3", group: "Supplier", members: 0, mode: "", ai_role: "" },
];

beforeEach(() => {
  clearPages();
  clearShown();
  vi.mocked(callTool).mockClear();
  vi.mocked(listDisabledGroups).mockReset().mockResolvedValue([]);
  vi.mocked(setGroupDisabled).mockReset().mockResolvedValue(undefined);
});

const open = (route = "/") => renderSpec(<GroupsPage hubId="h1" />, route);

describe("the Groups page list", () => {
  it("lists the groups by name with a button to create one", async () => {
    installPage("groups", { rows: groupRows });
    open();

    await screen.findByText("Boda riders");
    const names = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(names.indexOf("Boda riders")).toBeLessThan(names.indexOf("Siaya farmers"));
    expect(await actionItem("Create a group")).toBeInTheDocument();
  });

  it("narrows the groups to the search words, matching the AI role too", async () => {
    installPage("groups", { rows: groupRows });
    open();

    await screen.findByText("Boda riders");
    await userEvent.type(screen.getByPlaceholderText("Search groups"), "helper");

    expect(screen.getByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.queryByText("Boda riders")).not.toBeInTheDocument();
  });

  it("says there is nothing yet when no group is listed", async () => {
    installPage("groups", { rows: [] });
    open();

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the rows are refused", async () => {
    installPage("groups", {
      rows: async () => {
        throw new Error("offline");
      },
    });
    open();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});

describe("a group's card on the list", () => {
  it("shows members, how people join and the AI role once opened", async () => {
    installPage("groups", { rows: groupRows });
    open();

    await userEvent.click(await screen.findByText("Siaya farmers"));

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Helper")).toBeInTheDocument();
  });

  it("says approval is needed for a confirmed group and shows a dash for a group with no join mode", async () => {
    installPage("groups", { rows: groupRows });
    open();

    await userEvent.click(await screen.findByText("Boda riders"));
    expect(screen.getByText("Approval needed")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Supplier"));
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("links to the group's own page with the id in the address", async () => {
    installPage("groups", { rows: groupRows });
    open();

    await screen.findByText("Siaya farmers");
    const links = screen.getAllByRole("link", { name: "Edit" });
    expect(links.map((link) => link.getAttribute("href"))).toContain("/h/h1/groups?open=g1");
  });
});

describe("creating a group", () => {
  it("sends the name and closes the form when the group was made at once", async () => {
    const create = answering("done");
    const rows = installPage("groups", { rows: groupRows, actions: { create } });
    open();

    await screen.findByText("Siaya farmers");
    await chooseAction("Create a group");
    await userEvent.type(screen.getByLabelText("Name *"), "Maize growers");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith("h1", { name: "Maize growers" }));
    await waitFor(() => expect(screen.queryByLabelText("Name *")).not.toBeInTheDocument());
    expect(rows.mock.calls.length).toBeGreaterThan(1);
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });

  it("says the change waits for approval when the group was only proposed", async () => {
    const create = answering("accepted");
    const rows = installPage("groups", { rows: groupRows, actions: { create } });
    open();

    await screen.findByText("Siaya farmers");
    await chooseAction("Create a group");
    await userEvent.type(screen.getByLabelText("Name *"), "Maize growers");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(rows).toHaveBeenCalledTimes(1);
  });

  it("keeps the form open with the failure line when the hub refuses", async () => {
    installPage("groups", { rows: groupRows, actions: { create: failing() } });
    open();

    await screen.findByText("Siaya farmers");
    await chooseAction("Create a group");
    await userEvent.type(screen.getByLabelText("Name *"), "Maize growers");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
  });

  it("asks for the name before sending anything", async () => {
    const create = answering("done");
    installPage("groups", { rows: groupRows, actions: { create } });
    open();

    await screen.findByText("Siaya farmers");
    await chooseAction("Create a group");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Required: name")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("closes the form on Cancel without sending", async () => {
    const create = answering("done");
    installPage("groups", { rows: groupRows, actions: { create } });
    open();

    await screen.findByText("Siaya farmers");
    await chooseAction("Create a group");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Name *")).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("one group opened", () => {
  const members = [{ id: "a1", code: "M-1", name: "Amina", groups: "Siaya farmers" }];

  const rowsFor = async (_hub: string, query: Record<string, string>) => {
    if (query.card) return [groupRows[0]];
    if (query.group) return members as never[];
    return groupRows;
  };

  it("shows the group's name as the title, its card and how many members it has", async () => {
    installPage("groups", { rows: rowsFor });
    installPage("users", { rows: rowsFor });
    open("/?open=g1");

    expect(await screen.findByText("Group")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Helper")).toBeInTheDocument();
  });

  it("says there is nothing when the id is not a group of the hub", async () => {
    installPage("groups", { rows: groupRows });
    open("/?open=nobody");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("offers no create button while one group is open", async () => {
    installPage("groups", { rows: rowsFor });
    installPage("users", { rows: rowsFor });
    open("/?open=g1");

    await screen.findByText("Group");
    expect(await actionNames()).not.toContain("Create a group");
  });

  it("refuses a join mode the group already has without sending it", async () => {
    const joinMode = answering("done");
    installPage("groups", { rows: rowsFor, actions: { joinMode } });
    installPage("users", { rows: rowsFor });
    open("/?open=g1");

    await userEvent.click(await screen.findByRole("button", { name: "Change join mode" }));
    await userEvent.click(screen.getByLabelText("Open"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The group already works this way.")).toBeInTheDocument();
    expect(joinMode).not.toHaveBeenCalled();
  });

  it("sends the new join mode with the group's id and name", async () => {
    const joinMode = answering("done");
    installPage("groups", { rows: rowsFor, actions: { joinMode } });
    installPage("users", { rows: rowsFor });
    open("/?open=g1");

    await userEvent.click(await screen.findByRole("button", { name: "Change join mode" }));
    await userEvent.click(screen.getByLabelText("Approval needed"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(joinMode).toHaveBeenCalledWith("h1", { id: "g1", group_name: "Siaya farmers", join_mode: "confirmed" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument());
  });

  it("says the change waits for approval when the join mode was only proposed", async () => {
    installPage("groups", { rows: rowsFor, actions: { joinMode: answering("accepted") } });
    installPage("users", { rows: rowsFor });
    open("/?open=g1");

    await userEvent.click(await screen.findByRole("button", { name: "Change join mode" }));
    await userEvent.click(screen.getByLabelText("Approval needed"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
  });

  it("shows the failure line and keeps the form when the join mode is refused", async () => {
    installPage("groups", { rows: rowsFor, actions: { joinMode: failing() } });
    installPage("users", { rows: rowsFor });
    open("/?open=g1");

    await userEvent.click(await screen.findByRole("button", { name: "Change join mode" }));
    await userEvent.click(screen.getByLabelText("Approval needed"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    const form = (await screen.findByText("The change could not be sent.")).closest("form") as HTMLElement;
    expect(within(form).getByLabelText("Approval needed")).toBeInTheDocument();
    expect(shown).toEqual([]);
  });
});

describe("a disabled group", () => {
  const rowsFor = async (_hub: string, query: Record<string, string>) => {
    if (query.card) return [groupRows[0]];
    if (query.group) return [];
    return groupRows;
  };

  const openGroup = async (id: string) => {
    installPage("groups", { rows: rowsFor });
    installPage("users", { rows: rowsFor });
    open(`/?open=${id}`);
    return screen.findByRole("switch", { name: "Group enabled" });
  };

  it("marks a disabled group on the list and an enabled one as enabled, from GET disabled-groups", async () => {
    vi.mocked(listDisabledGroups).mockResolvedValue(["g2"]);
    installPage("groups", { rows: groupRows });
    open();

    await userEvent.click(await screen.findByText("Boda riders"));
    await userEvent.click(screen.getByText("Siaya farmers"));

    expect(listDisabledGroups).toHaveBeenCalledWith("h1");
    expect(screen.getAllByText("Disabled")).toHaveLength(1);
    expect(screen.getAllByText("Enabled")).toHaveLength(1);
  });

  it("still lists the groups when the disabled groups cannot be read", async () => {
    vi.mocked(listDisabledGroups).mockRejectedValue(new Error("not found"));
    installPage("groups", { rows: groupRows });
    open();

    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
  });

  it("shows the switch on for an enabled group", async () => {
    expect(await openGroup("g1")).toBeChecked();
  });

  it("shows the switch off for a disabled group", async () => {
    vi.mocked(listDisabledGroups).mockResolvedValue(["g2"]);
    expect(await openGroup("g2")).not.toBeChecked();
  });

  it("calls disable when the switch goes off and shows the state read again from the hub", async () => {
    vi.mocked(listDisabledGroups).mockResolvedValueOnce([]).mockResolvedValue(["g1"]);
    const toggle = await openGroup("g1");

    await userEvent.click(toggle);

    await waitFor(() => expect(setGroupDisabled).toHaveBeenCalledWith("h1", "g1", true));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Group enabled" })).not.toBeChecked());
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(vi.mocked(listDisabledGroups).mock.calls.length).toBeGreaterThan(1);
  });

  it("calls enable when the switch goes on", async () => {
    vi.mocked(listDisabledGroups).mockResolvedValueOnce(["g1"]).mockResolvedValue([]);
    const toggle = await openGroup("g1");
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() => expect(setGroupDisabled).toHaveBeenCalledWith("h1", "g1", false));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Group enabled" })).toBeChecked());
  });

  it("shows the refusal and leaves the switch where it was when the route refuses", async () => {
    vi.mocked(setGroupDisabled).mockRejectedValue(new Error("forbidden"));
    const toggle = await openGroup("g1");

    await userEvent.click(toggle);

    await waitFor(() => expect(shown).toEqual(["bad:The group was not changed. Only a group administrator may disable or enable a group."]));
    expect(screen.getByRole("switch", { name: "Group enabled" })).toBeChecked();
  });
});
