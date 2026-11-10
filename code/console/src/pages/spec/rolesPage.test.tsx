import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { RolesPage } from "./rolesPage";
import { answering, clearPages, clearShown, failing, installPage, renderSpec } from "./specHarness.test-helper";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

type Tools = Record<string, (args: Record<string, unknown>) => unknown>;

const answer = (tools: Tools = {}) =>
  call.mockImplementation(async (_hub, tool, args) => {
    const run = tools[tool];
    return (run ? run((args ?? {}) as Record<string, unknown>) : []) as never;
  });

const roleRows = [
  { id: "r1", name: "Coordinator", description: "Runs the group", kind: "human" },
  { id: "r2", name: "Helper bot", description: "", kind: "ai" },
  { id: "r3", name: "Auditor", description: "Reads the books", kind: "human" },
];

const detailRows = async (_hub: string, query: Record<string, string>) =>
  query.role ? [{ role: { description: "Runs the group" }, rules: [{ id: "u1", text: "May approve joins", code: "R-4" }, { id: "u2", text: "May invite" }], members: null }] : roleRows;

beforeEach(() => {
  clearPages();
  clearShown();
  call.mockReset();
  answer();
});

const open = (route = "/") => renderSpec(<RolesPage hubId="h1" />, route);

describe("the Roles page list", () => {
  it("lists the roles by name with a button to add one", async () => {
    installPage("roles", { rows: roleRows });
    open();

    await screen.findByText("Auditor");
    const names = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(names.indexOf("Auditor")).toBeLessThan(names.indexOf("Coordinator"));
    expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument();
  });

  it("narrows the roles to the search words, matching the description too", async () => {
    installPage("roles", { rows: roleRows });
    open();

    await screen.findByText("Auditor");
    await userEvent.type(screen.getByPlaceholderText("Search roles"), "books");

    expect(screen.getByText("Auditor")).toBeInTheDocument();
    expect(screen.queryByText("Coordinator")).not.toBeInTheDocument();
  });

  it("narrows the roles to the AI ones with the type filter", async () => {
    installPage("roles", { rows: roleRows });
    open();

    await screen.findByText("Auditor");
    await userEvent.selectOptions(screen.getByRole("combobox"), "AI role");

    expect(screen.getByText("Helper bot")).toBeInTheDocument();
    expect(screen.queryByText("Auditor")).not.toBeInTheDocument();
  });

  it("says nothing matches when the filter leaves no role", async () => {
    installPage("roles", { rows: roleRows });
    open();

    await screen.findByText("Auditor");
    await userEvent.type(screen.getByPlaceholderText("Search roles"), "zzz");

    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the rows are refused", async () => {
    installPage("roles", {
      rows: async () => {
        throw new Error("offline");
      },
    });
    open();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });

  it("lists the agents that are not linked to a role, each with a link to its model page", async () => {
    answer({ ai_list_roles: () => [{ id: "ag1", name: "Stray agent", agency_role_id: "" }, { id: "ag2", name: "Linked agent", agency_role_id: "r2" }] });
    installPage("roles", { rows: roleRows });
    open();

    const stray = await screen.findByRole("link", { name: /Stray agent/ });
    expect(stray.getAttribute("href")).toBe("/h/h1/agent-edit/ag1/model");
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.queryByText("Linked agent")).not.toBeInTheDocument();
  });

  it("still lists the roles when the agents cannot be read", async () => {
    answer({
      ai_list_roles: () => {
        throw new Error("down");
      },
    });
    installPage("roles", { rows: roleRows });
    open();

    expect(await screen.findByText("Auditor")).toBeInTheDocument();
    expect(screen.queryByText("Agents not linked to a role")).not.toBeInTheDocument();
  });
});

describe("a role's card on the list", () => {
  it("shows its description and type once opened, a human role as Human", async () => {
    installPage("roles", { rows: roleRows });
    open();

    await userEvent.click(await screen.findByText("Coordinator"));

    const card = screen.getByText("Coordinator").closest(".card") as HTMLElement;
    expect(within(card).getByText("Runs the group")).toBeInTheDocument();
    expect(within(card).getByText("Human")).toBeInTheDocument();
  });

  it("offers an AI role a link to configure it on the agents page", async () => {
    installPage("roles", { rows: roleRows });
    open();

    await userEvent.click(await screen.findByText("Helper bot"));

    const configure = screen.getByRole("link", { name: /Configure/ });
    expect(configure.getAttribute("href")).toBe("/h/h1/agents");
  });

  it("links to the role's own page with the id in the address", async () => {
    installPage("roles", { rows: roleRows });
    open();

    await screen.findByText("Auditor");
    const links = screen.getAllByRole("link", { name: "Edit" }).map((link) => link.getAttribute("href"));
    expect(links).toContain("/h/h1/roles?open=r1");
  });
});

describe("adding a role", () => {
  const begin = async (actions: Parameters<typeof installPage>[1]["actions"]) => {
    const rows = installPage("roles", { rows: roleRows, actions });
    open();
    await screen.findByText("Auditor");
    await userEvent.click(screen.getByRole("button", { name: "Add a role" }));
    await userEvent.type(screen.getByLabelText("Name *"), "Seed keeper");
    await userEvent.type(screen.getByLabelText("Description"), "Looks after seeds");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    return rows;
  };

  it("sends the name and description and lists the roles again when made at once", async () => {
    const roles = answering("done");
    const rows = await begin({ roles });

    await waitFor(() => expect(roles).toHaveBeenCalledWith("h1", { name: "Seed keeper", description: "Looks after seeds" }));
    await waitFor(() => expect(screen.queryByLabelText("Name *")).not.toBeInTheDocument());
    expect(rows.mock.calls.length).toBeGreaterThan(1);
  });

  it("says the change waits for approval when only proposed", async () => {
    await begin({ roles: answering("accepted") });

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
  });

  it("keeps the form with the failure line when refused", async () => {
    await begin({ roles: failing() });

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
  });
});

describe("one role opened", () => {
  const openRole = async (actions?: Parameters<typeof installPage>[1]["actions"]) => {
    installPage("roles", { rows: detailRows, actions });
    open("/?open=r1");
    await screen.findByText("What it may do");
  };

  it("shows the role's name, what it may do with each rule's code, and no agents when none is linked", async () => {
    await openRole();

    expect(screen.getByRole("heading", { name: "Coordinator" })).toBeInTheDocument();
    expect(screen.getByText("May approve joins")).toBeInTheDocument();
    expect(screen.getByText("R-4")).toBeInTheDocument();
    expect(screen.getByText("May invite")).toBeInTheDocument();
    expect(screen.getByText("Runs the group")).toBeInTheDocument();
  });

  it("links each agent that holds the role to its model page", async () => {
    answer({ ai_list_roles: () => [{ id: "ag9", name: "Seed helper", agency_role_id: "r1" }] });
    await openRole();

    const link = await screen.findByRole("link", { name: /Seed helper/ });
    expect(link.getAttribute("href")).toBe("/h/h1/agent-edit/ag9/model");
  });

  it("says there is nothing when the id is not a role of the hub", async () => {
    installPage("roles", { rows: roleRows });
    open("/?open=nobody");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("opens the edit form filled with the role and sends the changes with the role id", async () => {
    const role = answering("done");
    await openRole({ role });

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name *");
    expect(name).toHaveValue("Coordinator");
    await userEvent.clear(name);
    await userEvent.type(name, "Chair");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(role).toHaveBeenCalledWith("h1", expect.objectContaining({ name: "Chair", role_id: "r1" })));
    await waitFor(() => expect(screen.queryByLabelText("Name *")).not.toBeInTheDocument());
  });

  it("keeps the edit form with the failure line when the change is refused", async () => {
    await openRole({ role: failing() });

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
  });
});

describe("removing a role", () => {
  const ask = async () => {
    installPage("roles", { rows: detailRows });
    open("/?open=r1");
    await screen.findByText("What it may do");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
  };

  it("asks first, naming the role, and leaves it alone on Cancel", async () => {
    await ask();

    expect(screen.getByText("Remove the Coordinator role? Its links to objectives go with it.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/Its links to objectives go with it/)).not.toBeInTheDocument();
    expect(call.mock.calls.filter(([, tool]) => tool === "agency_delete_role")).toHaveLength(0);
  });

  it("deletes the role by its id and goes back to the list", async () => {
    answer({ agency_delete_role: () => ({}) });
    await ask();

    await userEvent.click(screen.getByRole("button", { name: "Remove role" }));

    await waitFor(() => expect(call).toHaveBeenCalledWith("h1", "agency_delete_role", { role_id: "r1" }));
    expect(await screen.findByRole("button", { name: "Add a role" })).toBeInTheDocument();
  });

  it("refuses to remove a role a test scenario still uses, naming the scenarios and linking each", async () => {
    answer({ agency_list_scenarios: () => [{ id: "s1", name: "Seed handover", actors: [{ role_id: "r1" }] }, { id: "s2", name: "Other", actors: [{ role_id: "r9" }] }] });
    await ask();

    await userEvent.click(screen.getByRole("button", { name: "Remove role" }));

    expect(await screen.findByText("The Coordinator role was not removed: 1 test scenarios use it. Take the Coordinator actor out of them first.")).toBeInTheDocument();
    expect(screen.getByText("Seed handover")).toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/h/h1/test?open=s1&tab=actors");
    expect(call.mock.calls.filter(([, tool]) => tool === "agency_delete_role")).toHaveLength(0);
  });

  it("names the scenarios the hub reports when it refuses the deletion itself", async () => {
    answer({
      agency_delete_role: () => {
        throw new McpError('role is still used by "Seed handover", "Late pickup"');
      },
    });
    await ask();

    await userEvent.click(screen.getByRole("button", { name: "Remove role" }));

    expect(await screen.findByText("The Coordinator role was not removed: 2 test scenarios use it. Take the Coordinator actor out of them first.")).toBeInTheDocument();
    expect(screen.getByText("Late pickup")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });

  it("says the change could not be sent when the deletion fails for another reason, keeping the question open", async () => {
    answer({
      agency_delete_role: () => {
        throw new Error("offline");
      },
    });
    await ask();

    await userEvent.click(screen.getByRole("button", { name: "Remove role" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove role" })).toBeEnabled();
  });
});
