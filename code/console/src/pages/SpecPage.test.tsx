import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answering, clearPages, failing, installPage, pages, renderSpecPage } from "./spec/testing";

vi.mock("../data/registry", () => import("./spec/fakeRegistry"));
vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listTools: async () => (await import("./spec/toolSchemas")).offeredTools,
}));

beforeEach(() => {
  clearPages();
});

const userColumns = [
  { key: "name", label: "Person" },
  { key: "role", label: "Role" },
];

describe("a page the console knows", () => {
  it("shows the page title, its columns and one line per row", async () => {
    installPage("users", {
      title: "Users",
      primary: "Invite a user",
      columns: userColumns,
      rows: [
        { id: "u1", name: "Amina", role: "Rider" },
        { id: "u2", name: "Juma", role: "Farmer" },
      ],
    });
    renderSpecPage("users");

    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Person" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Amina" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("shows a missing cell as blank and a number as itself", async () => {
    installPage("groups", {
      title: "Groups",
      primary: "Create a group",
      columns: [
        { key: "group", label: "Group" },
        { key: "members", label: "Members" },
        { key: "ai_role", label: "AI role" },
      ],
      rows: [{ id: "g1", group: "Riders", members: 12 }],
    });
    renderSpecPage("groups");

    expect(await screen.findByRole("cell", { name: "12" })).toBeInTheDocument();
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell").slice(0, 3);
    expect(cells.map((cell) => cell.textContent)).toEqual(["Riders", "12", ""]);
  });

  it("asks the page for the rows of the open hub, once", async () => {
    const rows = installPage("users", { title: "Users", primary: "Invite a user", columns: userColumns });
    renderSpecPage("users");

    await screen.findByRole("heading", { name: "Users" });

    expect(rows.mock.calls).toEqual([["h1", {}]]);
  });

  it("asks only for the open alerts", async () => {
    const rows = installPage("alerts", { title: "Alerts", columns: [{ key: "alert", label: "Alert" }] });
    renderSpecPage("alerts");

    await screen.findByRole("heading", { name: "Alerts" });

    expect(rows.mock.calls).toEqual([["h1", { state: "open", room: "room-m" }]]);
  });

  it("asks Operations for the hub's managers' room but not for open rows", async () => {
    const rows = installPage("operations", { title: "Operations", columns: [{ key: "area", label: "Area" }] });
    renderSpecPage("operations");

    await screen.findByRole("heading", { name: "Operations" });

    expect(rows).toHaveBeenCalledWith("h1", { room: "room-m" });
    expect(rows.mock.calls.filter(([, query]) => "state" in query)).toEqual([]);
  });
});

describe("a page with nothing to list", () => {
  it("says there is nothing yet and keeps the title and the primary button", async () => {
    installPage("roles", { title: "Roles", primary: "Add a role", columns: [{ key: "name", label: "Role" }], rows: [] });
    renderSpecPage("roles");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("a page whose rows cannot be loaded", () => {
  const failingRoles = () =>
    installPage("roles", {
      title: "Roles",
      primary: "Add a role",
      columns: [{ key: "name", label: "Role" }],
      rows: async () => {
        throw new Error("offline");
      },
    });

  it("says the page could not be loaded in the error style and keeps the primary button", async () => {
    failingRoles();
    renderSpecPage("roles");

    const failed = await screen.findByText("The page could not be loaded.");

    expect(failed).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument();
  });

  it("does not say the page is planned or empty", async () => {
    failingRoles();
    renderSpecPage("roles");

    await screen.findByText("The page could not be loaded.");

    expect(screen.queryByText("This page is planned.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet.")).not.toBeInTheDocument();
  });
});

describe("a page that is only planned", () => {
  it("shows the menu name and that the page is planned when the console has no module for the page", async () => {
    renderSpecPage("alerts");

    expect(await screen.findByText("This page is planned.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();
  });

  it("shows the same when the module of the page has no spec yet and asks it for no rows", async () => {
    const rows = vi.fn(async () => []);
    pages.alerts = { spec: { id: "", title: "", primary: "", tools: [], columns: [] }, rows };
    renderSpecPage("alerts");

    expect(await screen.findByText("This page is planned.")).toBeInTheDocument();
    expect(rows).not.toHaveBeenCalled();
  });

  it("shows the same for a page name that every object happens to carry", async () => {
    renderSpecPage("constructor");

    expect(await screen.findByText("This page is planned.")).toBeInTheDocument();
  });

  it("shows no primary button on a planned page", async () => {
    renderSpecPage("alerts");

    await screen.findByText("This page is planned.");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("the Agents page", () => {
  const installAgents = () =>
    installPage("agents", {
      title: "Agents",
      primary: "Add an agent",
      columns: [
        { key: "name", label: "Agent" },
        { key: "model", label: "Model" },
      ],
      rows: [
        { id: "r-1", name: "Farmers' coordinator", model: "Sonnet 5.5", edit: "agent-edit" },
        { id: "r-2", name: "Dispatcher", model: "Choose a model" },
      ],
    });

  it("offers no button to add an agent", async () => {
    installAgents();
    renderSpecPage("agents");

    await screen.findByText("Farmers' coordinator");

    expect(screen.queryByRole("button", { name: "Add an agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("links an agent that can be edited to its model page", async () => {
    installAgents();
    renderSpecPage("agents");

    const link = await screen.findByRole("link", { name: "Edit" });

    expect(link).toHaveAttribute("href", "/h/h1/agent-edit/r-1/model");
    expect(screen.getAllByRole("link", { name: "Edit" })).toHaveLength(1);
  });

  it("opens the agent's edit page when the link is followed", async () => {
    installAgents();
    renderSpecPage("agents");

    await userEvent.setup().click(await screen.findByRole("link", { name: "Edit" }));

    expect(await screen.findByText("Agent edit page")).toBeInTheDocument();
  });

  it("builds the link from the edit target and the id the row carries", async () => {
    installPage("agents", {
      title: "Agents",
      columns: [{ key: "name", label: "Agent" }],
      rows: [{ id: "role 7", name: "Watcher", edit: "agent-edit" }],
    });
    renderSpecPage("agents");

    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/agent-edit/role%207/model");
  });
});

describe("the Groups page join toggle", () => {
  const groupColumns = [
    { key: "group", label: "Group" },
    { key: "join_mode", label: "Join mode" },
  ];
  const installGroups = (joinMode = answering("accepted"), rows = [
    { id: "g-1", group: "Riders", join_mode: "Open" },
    { id: "g-2", group: "Farmers", join_mode: "Approval required" },
  ]) => {
    installPage("groups", { title: "Groups", primary: "Create a group", columns: groupColumns, rows, actions: { joinMode } });
    return joinMode;
  };

  it("offers to require approval on an open group and to open an approval group to anyone", async () => {
    installGroups();
    renderSpecPage("groups");

    await screen.findByText("Riders");
    const [riders, farmers] = screen.getAllByRole("row").slice(1);

    expect(within(riders).getByRole("button", { name: "Require approval" })).toBeInTheDocument();
    expect(within(farmers).getByRole("button", { name: "Open to anyone" })).toBeInTheDocument();
  });

  it("offers no button to create a group, as no form is drawn for it", async () => {
    installGroups();
    renderSpecPage("groups");

    await screen.findByText("Riders");

    expect(screen.queryByRole("button", { name: "Create a group" })).not.toBeInTheDocument();
  });

  it("proposes approval for an open group and says it waits for approval", async () => {
    const joinMode = installGroups();
    renderSpecPage("groups");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Require approval" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveClass("error");
    expect(joinMode.mock.calls).toEqual([["h1", { id: "g-1", group_name: "Riders", join_mode: "confirmed" }]]);
  });

  it("proposes opening a group that needs approval", async () => {
    const joinMode = installGroups();
    renderSpecPage("groups");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Open to anyone" }));

    await screen.findByText("Waiting for approval");
    expect(joinMode.mock.calls).toEqual([["h1", { id: "g-2", group_name: "Farmers", join_mode: "open" }]]);
  });

  it("says the change could not be sent in the error style when the change is refused", async () => {
    installGroups(failing());
    renderSpecPage("groups");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Require approval" }));

    const note = await screen.findByText("The change could not be sent.");
    expect(note).toHaveClass("error");
    expect(note).toHaveAttribute("role", "status");
  });

  it("says the change could not be sent when the groups page has no join action", async () => {
    installPage("groups", {
      title: "Groups",
      columns: groupColumns,
      rows: [{ id: "g-1", group: "Riders", join_mode: "Open" }],
    });
    renderSpecPage("groups");

    await userEvent.setup().click(await screen.findByRole("button", { name: "Require approval" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
  });

  it("says nothing and lists the groups again when the change was made at once", async () => {
    const joinMode = installGroups(answering("done"));
    renderSpecPage("groups");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Require approval" }));

    await vi.waitFor(() => expect(pages.groups.rows).toHaveBeenCalledTimes(2));

    expect(joinMode).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows the new join mode after a change made at once", async () => {
    let mode = "Open";
    const joinMode = vi.fn(async () => {
      mode = "Approval required";
      return "done" as const;
    });
    installGroups(joinMode, undefined);
    pages.groups.rows = async () => [{ id: "g-1", group: "Riders", join_mode: mode }];
    renderSpecPage("groups");

    await userEvent.setup().click(await screen.findByRole("button", { name: "Require approval" }));

    expect(await screen.findByRole("button", { name: "Open to anyone" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Require approval" })).not.toBeInTheDocument();
  });

  it("sends one proposal however many times the button is pressed while it is on its way", async () => {
    let release: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    const joinMode = vi.fn(async () => {
      await answered;
      return "accepted" as const;
    });
    installGroups(joinMode);
    renderSpecPage("groups");
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Require approval" });

    await user.click(button);
    await user.click(button);

    expect(button).toBeDisabled();
    release();
    await screen.findByText("Waiting for approval");
    expect(joinMode).toHaveBeenCalledTimes(1);
    expect(button).toBeEnabled();
  });

  it("passes the group id exactly as the row carries it", async () => {
    const joinMode = installGroups(answering("accepted"), [{ id: "g/1", group: "Riders", join_mode: "Open" }]);
    renderSpecPage("groups");

    await userEvent.setup().click(await screen.findByRole("button", { name: "Require approval" }));

    await screen.findByText("Waiting for approval");
    expect(joinMode.mock.calls[0][1]).toEqual({ id: "g/1", group_name: "Riders", join_mode: "confirmed" });
  });
});

describe("moving from one page to another", () => {
  it("loads the other page and closes the form that was open", async () => {
    installPage("goals", { title: "Goals", primary: "Add a goal", columns: [{ key: "title", label: "Goal" }] });
    installPage("roles", { title: "Roles", primary: "Add a role", columns: [{ key: "name", label: "Role" }] });
    renderSpecPage("goals");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add a goal" }));
    await screen.findByRole("heading", { name: "Add a goal", level: 2 });

    await user.click(screen.getByRole("link", { name: "Go to roles" }));

    expect(await screen.findByRole("heading", { name: "Roles", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add a goal" })).not.toBeInTheDocument();
  });
});
