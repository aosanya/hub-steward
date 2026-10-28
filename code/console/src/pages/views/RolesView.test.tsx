import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, proposals, renderView } from "../spec/usersTesting";
import { RolesView } from "./RolesView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const hubWithRoles = {
  agency_list_roles: {
    items: [
      { id: "r1", code: "R-1", name: "Group coordinator", kind: "human", description: "Runs the group." },
      { id: "r2", code: "R-2", name: "Farmer", description: "Grows crops and sells produce." },
      { id: "r3", code: "R-3", name: "Farmers' coordinator", kind: "ai" },
    ],
  },
  agency_get_role: (args: Record<string, unknown>) =>
    args.role_id === "r2" ? { id: "r2", name: "Farmer", description: "Grows crops and sells produce." } : { id: "r1", name: "Group coordinator" },
  agency_list_rules: { items: [{ id: "u1", code: "RU-1", text: "Asks for inputs through the group's form" }] },
  agency_list_objectives: { items: [{ id: "o1", code: "O-1" }, { id: "o2", code: "O-2" }, { id: "o3", code: "O-3" }] },
};

const showRoles = (replies: Parameters<typeof answering>[0] = hubWithRoles, search = "") => {
  answering(replies);
  return renderView("roles", RolesView, search);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));
const titles = () => Array.from(document.querySelectorAll(".card-toggle")).map((button) => button.textContent);
const opened = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name }));
  return within(screen.getByRole("button", { name }).closest(".card") as HTMLElement);
};

describe("the Roles page", () => {
  it("is titled Roles and offers Add a role", async () => {
    showRoles();

    expect(await screen.findByRole("heading", { level: 1, name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument();
  });

  it("lists every role as a collapsed card with its name, showing a human role as Human when opened", async () => {
    showRoles();

    await screen.findByText("Farmer");

    expect(cards()).toHaveLength(3);
    expect(within(cards()[0]).queryByText("Human")).not.toBeInTheDocument();
    const coordinator = await opened("Group coordinator");
    expect(coordinator.getByText("Human")).toHaveClass("tag", "mute");
  });

  it("shows an AI role with an AI role chip and a link to configure it on the Agents page", async () => {
    showRoles();

    await screen.findByText("Farmers' coordinator");

    const ai = await opened("Farmers' coordinator");
    expect(ai.getByText("AI role")).toHaveClass("tag", "warn");
    expect(ai.getByRole("link", { name: /Configure/ })).toHaveAttribute("href", "/h/h1/agents");
  });

  it("shows each role's description inside its card and nothing for a role without one", async () => {
    showRoles();

    await screen.findByText("Farmer");

    expect((await opened("Group coordinator")).getByText("Runs the group.")).toBeInTheDocument();
    expect((await opened("Farmer")).getByText("Grows crops and sells produce.")).toBeInTheDocument();
    expect((await opened("Farmers' coordinator")).queryByText("Description")).not.toBeInTheDocument();
  });

  it("does not ask for the role assignments any more", async () => {
    showRoles();

    await screen.findByText("Farmer");

    expect(callsTo("agency_list_role_assignments")).toEqual([]);
  });

  it("links every role to its own page with Edit", async () => {
    showRoles();

    await screen.findByText("Farmer");

    expect(within(cards()[0]).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/roles?open=r2");
  });

  it("says there is nothing yet and keeps the title and the add button when the agency has no role", async () => {
    showRoles({});

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says the page could not be loaded in the error style and keeps the add button when the roles cannot be read", async () => {
    showRoles({ ...hubWithRoles, agency_list_roles: new McpError("agency_list_roles: down") });

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});

describe("agents with no agency role", () => {
  const withAgents = (agents: Record<string, unknown>[]) => ({ ...hubWithRoles, ai_list_roles: agents });

  it("marks each agent that has no role linked as not linked and links it to its edit page", async () => {
    showRoles(withAgents([{ id: "a1", name: "Farmers' agent", agency_role_id: "r3" }, { id: "a2", name: "Matching agent" }]));

    const card = (await screen.findByRole("heading", { name: "Agents not linked to a role" })).closest("section") as HTMLElement;

    expect(within(card).getByRole("link", { name: /Matching agent/ })).toHaveAttribute("href", "/h/h1/agent-edit/a2/model");
    expect(within(card).getByText("Not linked")).toHaveClass("tag", "warn");
    expect(within(card).queryByText("Farmers' agent")).not.toBeInTheDocument();
  });

  it("shows no such card when every agent is linked", async () => {
    showRoles(withAgents([{ id: "a1", name: "Farmers' agent", agency_role_id: "r3" }]));

    await screen.findByText("Farmer");

    expect(screen.queryByText("Agents not linked to a role")).not.toBeInTheDocument();
  });

  it("still lists the roles when the agents cannot be read", async () => {
    showRoles({ ...hubWithRoles, ai_list_roles: new McpError("ai_list_roles: down") });

    expect(await screen.findByText("Farmer")).toBeInTheDocument();
    expect(screen.queryByText("Not linked")).not.toBeInTheDocument();
  });
});

describe("narrowing the roles", () => {
  it("offers a search box and a type filter in front of the table", async () => {
    showRoles();

    await screen.findByText("Farmer");

    expect(screen.getByRole("searchbox", { name: "Search roles" })).toBeInTheDocument();
    const types = screen.getByRole("combobox", { name: "All types" });
    expect(within(types).getAllByRole("option").map((option) => option.textContent)).toEqual(["All types", "Human", "AI role"]);
  });

  it("keeps the roles whose name has what was typed, whatever the case, without asking the tools again", async () => {
    showRoles();
    const user = userEvent.setup();
    await screen.findByText("Farmer");
    const asked = callsTo("agency_list_roles").length;

    await user.type(screen.getByRole("searchbox", { name: "Search roles" }), "COORD");

    expect(titles()).toEqual(["Farmers' coordinator", "Group coordinator"]);
    expect(callsTo("agency_list_roles")).toHaveLength(asked);
  });

  it("keeps only the AI roles when AI role is picked and only the human ones when Human is", async () => {
    showRoles();
    const user = userEvent.setup();
    await screen.findByText("Farmer");

    await user.selectOptions(screen.getByRole("combobox", { name: "All types" }), "AI role");
    expect(titles()).toEqual(["Farmers' coordinator"]);

    await user.selectOptions(screen.getByRole("combobox", { name: "All types" }), "Human");
    expect(titles()).toEqual(["Farmer", "Group coordinator"]);
  });
});

describe("sorting and filtering the roles", () => {
  it("lists the roles in the order of their names", async () => {
    showRoles();
    await screen.findByText("Farmer");

    expect(titles()).toEqual(["Farmer", "Farmers' coordinator", "Group coordinator"]);
  });

  it("keeps the roles whose name or description has the words typed", async () => {
    showRoles();
    const user = userEvent.setup();
    await screen.findByText("Farmer");

    await user.type(screen.getByRole("searchbox", { name: "Search roles" }), "crops");

    expect(titles()).toEqual(["Farmer"]);
  });
});

describe("one role open", () => {
  it("is titled by the role, offers Edit and shows a Role card with what it is and what it may do", async () => {
    showRoles(hubWithRoles, "?open=r2");

    expect(await screen.findByRole("heading", { level: 1, name: "Farmer" })).toBeInTheDocument();
    const card = (await screen.findByRole("heading", { name: "Role" })).closest("section") as HTMLElement;
    expect(within(card).getByText("Grows crops and sells produce.")).toHaveClass("note");
    expect(within(card).getByText("Type").nextElementSibling).toHaveTextContent("Human");
    expect(within(card).getByText("What it may do").nextElementSibling).toHaveTextContent("Asks for inputs through the group's form RU-1");
    expect(within(card).queryByText("Objectives")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("asks for that role and its rules, not its assignments", async () => {
    showRoles(hubWithRoles, "?open=r2");

    await screen.findByRole("heading", { name: "Role" });

    expect(callsTo("agency_get_role")).toEqual([{ role_id: "r2" }]);
    expect(callsTo("agency_list_rules")).toEqual([{ role_id: "r2" }]);
    expect(callsTo("agency_list_role_assignments")).toEqual([]);
  });

  it("shows a dash for a role with no rules, and no note without a description", async () => {
    showRoles(
      {
        ...hubWithRoles,
        agency_list_rules: { items: [] },
        agency_get_role: { id: "r1", name: "Group coordinator" },
      },
      "?open=r1",
    );

    const card = (await screen.findByRole("heading", { name: "Role" })).closest("section") as HTMLElement;

    expect(within(card).getByText("What it may do").nextElementSibling).toHaveTextContent("—");
    expect(card.querySelector(".note")).toBeNull();
  });

  it("offers Edit instead of Add a role, and no filters", async () => {
    showRoles(hubWithRoles, "?open=r2");

    await screen.findByRole("heading", { name: "Role" });

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("says there is nothing here for a role the agency does not have", async () => {
    showRoles(hubWithRoles, "?open=nobody");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Roles" })).toBeInTheDocument();
  });

  it("says the page could not be loaded when the role cannot be read", async () => {
    showRoles({ ...hubWithRoles, agency_get_role: new McpError("agency_get_role: down") }, "?open=r2");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
  });
});

describe("the agents of one role", () => {
  const withAgents = {
    ...hubWithRoles,
    ai_list_roles: {
      items: [
        { id: "a1", name: "Farmers' agent", agency_role_id: "r1" },
        { id: "a2", name: "Suppliers' agent", agency_role_id: "r1" },
        { id: "a3", name: "Matching agent", agency_role_id: "r3" },
      ],
    },
  };

  it("lists the agents that work for the role, each linking to its edit page", async () => {
    showRoles(withAgents, "?open=r1");

    const card = (await screen.findByRole("heading", { name: "Role" })).closest("section") as HTMLElement;
    const agents = within(within(card).getByText("Agents").nextElementSibling as HTMLElement);

    expect(agents.getByRole("link", { name: /Farmers' agent/ })).toHaveAttribute("href", "/h/h1/agent-edit/a1/model");
    expect(agents.getByRole("link", { name: /Suppliers' agent/ })).toHaveAttribute("href", "/h/h1/agent-edit/a2/model");
    expect(agents.queryByRole("link", { name: /Matching agent/ })).not.toBeInTheDocument();
  });

  it("sends Configure of an AI role with one agent to that agent's edit page", async () => {
    showRoles(withAgents, "?open=r3");

    const card = (await screen.findByRole("heading", { name: "Role" })).closest("section") as HTMLElement;

    expect(within(within(card).getByText("Type").nextElementSibling as HTMLElement).getByRole("link", { name: /Configure/ })).toHaveAttribute(
      "href",
      "/h/h1/agent-edit/a3/model",
    );
  });

  it("keeps Configure on the Agents page for an AI role with no agent yet and shows a dash for agents", async () => {
    showRoles(hubWithRoles, "?open=r3");

    const card = (await screen.findByRole("heading", { name: "Role" })).closest("section") as HTMLElement;

    expect(within(within(card).getByText("Type").nextElementSibling as HTMLElement).getByRole("link", { name: /Configure/ })).toHaveAttribute(
      "href",
      "/h/h1/agents",
    );
    expect(within(card).getByText("Agents").nextElementSibling).toHaveTextContent("—");
  });

  it("still shows the role when the agents cannot be read", async () => {
    showRoles({ ...withAgents, ai_list_roles: new McpError("ai_list_roles: down") }, "?open=r1");

    const card = (await screen.findByRole("heading", { name: "Role" })).closest("section") as HTMLElement;

    expect(within(card).getByText("Agents").nextElementSibling).toHaveTextContent("—");
  });

  it("offers no members table, because no tool lists the people who hold a role", async () => {
    showRoles(withAgents, "?open=r1");

    await screen.findByRole("heading", { name: "Role" });

    expect(screen.queryByRole("heading", { name: "Members" })).not.toBeInTheDocument();
    expect(callsTo("actor_list_members")).toEqual([]);
  });
});

describe("adding a role", () => {
  const openForm = async () => {
    showRoles();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add a role" }));
    await screen.findByText("agency_create_role");
    return user;
  };

  it("opens a form object for the role creation tool with a name and a description", async () => {
    await openForm();

    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("creates the role with its name and description straight away and closes the form", async () => {
    const user = await openForm();

    await user.type(screen.getByLabelText("Name *"), "Seed keeper");
    await user.type(screen.getByLabelText("Description"), "Looks after seeds");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(callsTo("agency_create_role")).toHaveLength(1));
    expect(callsTo("agency_create_role")[0]).toMatchObject({ name: "Seed keeper", description: "Looks after seeds" });
    expect(proposals()).toEqual([]);
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });

  it("asks for the name and proposes nothing when it is left empty", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required");
    expect(proposals()).toEqual([]);
  });

  it("counts a name of spaces as missing", async () => {
    const user = await openForm();

    await user.type(screen.getByLabelText("Name *"), "   ");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required");
    expect(proposals()).toEqual([]);
  });

  it("says the change could not be sent and keeps what was typed when the create is refused", async () => {
    showRoles({ ...hubWithRoles, agency_create_role: new McpError("agency_create_role: boom") });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add a role" }));
    await user.type(await screen.findByLabelText("Name *"), "Seed keeper");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
    expect(screen.getByLabelText("Name *")).toHaveValue("Seed keeper");
  });

  it("closes without proposing anything when cancelled", async () => {
    const user = await openForm();
    await user.type(screen.getByLabelText("Name *"), "Seed keeper");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("agency_create_role")).not.toBeInTheDocument();
    expect(proposals()).toEqual([]);
  });
});
