import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionRun } from "../../data/types";
import type { ToolInfo } from "../../wakala/mcp";
import { offeredTools } from "./toolSchemas";
import { answering, clearPages, failing, installPage, pages, renderSpecPage, type PageSetup } from "./testing";

vi.mock("../../data/registry", () => import("./fakeRegistry"));
const offered: ToolInfo[] = [];

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listTools: async () => offered,
}));

beforeEach(() => {
  clearPages();
  offered.splice(0, offered.length, ...offeredTools);
});

type User = ReturnType<typeof userEvent.setup>;

type Case = {
  name: string;
  page: string;
  pages: Record<string, PageSetup>;
  open: string;
  title: string;
  fill: (user: User) => Promise<void>;
  action: string;
  values: Record<string, unknown>;
};

const titleColumn = [{ key: "title", label: "Title" }];

const pageOf = (title: string, primary: string, rows: PageSetup["rows"] = []): PageSetup => ({
  title,
  primary,
  columns: titleColumn,
  rows,
});

const groupsPicker = pageOf("Groups", "", [
  { id: "g-1", group: "Riders" },
  { id: "g-2", group: "Farmers" },
]);

const goalsWithOne = pageOf("Goals", "Add a goal", [{ id: "g-9", title: "Seed library" }]);

const generalWithLanguages = pageOf("General", "Save changes", [
  { joining: "Open to join", default_language: "en", theme: "Dark", languages: ["en", "hu"] },
]);

const type = (user: User, label: string, text: string) => user.type(screen.getByLabelText(label), text);
const pick = (user: User, label: string, option: string) => user.selectOptions(screen.getByLabelText(label), option);

const cases: Case[] = [
  {
    name: "inviting a user",
    page: "users",
    pages: { users: pageOf("Users", "Invite a user"), groups: groupsPicker },
    open: "Invite a user",
    title: "Invite a user",
    fill: async (user) => {
      await pick(user, "Group *", "Farmers");
      await type(user, "Member code", "M-77");
      await type(user, "Person", "a-5");
      await type(user, "Name", "Amina");
    },
    action: "users",
    values: { group_id: "g-2", actor_code: "M-77", actor_id: "a-5", name: "Amina" },
  },
  {
    name: "adding a goal",
    page: "goals",
    pages: { goals: pageOf("Goals", "Add a goal") },
    open: "Add a goal",
    title: "Add a goal",
    fill: async (user) => {
      await type(user, "Title *", "Open a seed library");
      await type(user, "Description", "Share seeds");
    },
    action: "goals",
    values: { title: "Open a seed library", description: "Share seeds" },
  },
  {
    name: "adding an objective",
    page: "goals",
    pages: { goals: goalsWithOne },
    open: "Add an objective",
    title: "Add an objective",
    fill: async (user) => {
      await pick(user, "Goal *", "Seed library");
      await type(user, "Title *", "Collect seeds");
    },
    action: "objectives",
    values: { goal_id: "g-9", title: "Collect seeds", description: "" },
  },
  {
    name: "adding a role",
    page: "roles",
    pages: { roles: pageOf("Roles", "Add a role") },
    open: "Add a role",
    title: "Add a role",
    fill: async (user) => {
      await type(user, "Name *", "Seed keeper");
      await type(user, "Description", "Looks after seeds");
    },
    action: "roles",
    values: { name: "Seed keeper", description: "Looks after seeds" },
  },
  {
    name: "changing the profile",
    page: "profile",
    pages: { profile: pageOf("Profile", "Save changes") },
    open: "Save changes",
    title: "Save changes",
    fill: async (user) => {
      await type(user, "Name *", "Siaya Farmers");
      await type(user, "Description", "Grow together");
    },
    action: "profile",
    values: { name: "Siaya Farmers", description: "Grow together" },
  },
  {
    name: "renaming the hub",
    page: "profile",
    pages: { profile: pageOf("Profile", "Save changes") },
    open: "Rename the hub",
    title: "Rename the hub",
    fill: async (user) => {
      await type(user, "Name *", "Siaya Hub");
    },
    action: "hubname",
    values: { name: "Siaya Hub" },
  },
  {
    name: "changing how people join",
    page: "general",
    pages: { general: generalWithLanguages },
    open: "Save changes",
    title: "Save changes",
    fill: async (user) => {
      await pick(user, "Joining *", "confirmed");
    },
    action: "general",
    values: { join_mode: "confirmed" },
  },
  {
    name: "setting the default language",
    page: "general",
    pages: { general: generalWithLanguages },
    open: "Default language",
    title: "Default language",
    fill: async (user) => {
      await pick(user, "Language *", "hu");
    },
    action: "language",
    values: { language: "hu" },
  },
  {
    name: "adding a document",
    page: "documents",
    pages: { documents: pageOf("Documents", "Upload a document") },
    open: "Upload a document",
    title: "Upload a document",
    fill: async (user) => {
      await type(user, "Title *", "Seed guide");
      await type(user, "Language", "en");
      await type(user, "Text *", "Plant after the rains.");
    },
    action: "documents",
    values: { title: "Seed guide", language: "en", text: "Plant after the rains." },
  },
];

const everyAction = (run: ActionRun) => Object.fromEntries(cases.map((c) => [c.action, run]));

const install = (c: Case, run: ActionRun) => {
  for (const [id, setup] of Object.entries(c.pages)) {
    installPage(id, id === c.page ? { ...setup, actions: { [c.action]: run } } : setup);
  }
};

const openForm = async (c: Case, run: ActionRun) => {
  install(c, run);
  renderSpecPage(c.page);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: c.open }));
  await screen.findByRole("heading", { name: c.title, level: 2 });
  return user;
};

describe("an action form", () => {
  it.each(cases)("$name opens a form titled by its button, with Submit and Cancel", async (c) => {
    await openForm(c, answering("accepted"));

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it.each(cases)("$name runs its action for the hub with the filled fields", async (c) => {
    const run = answering("accepted");
    const user = await openForm(c, run);
    await c.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Waiting for approval");
    expect(run.mock.calls).toEqual([["h1", c.values]]);
  });

  it.each(cases)("$name says it waits for approval and closes the form", async (c) => {
    const user = await openForm(c, answering("accepted"));
    await c.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    const note = await screen.findByText("Waiting for approval");
    expect(note).toHaveAttribute("role", "status");
    expect(note).not.toHaveClass("error");
    expect(screen.queryByRole("heading", { name: c.title, level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it.each(cases)("$name closes the form without a note when the change is made at once", async (c) => {
    const run = answering("done");
    const user = await openForm(c, run);
    await c.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await vi.waitFor(() => expect(screen.queryByRole("heading", { name: c.title, level: 2 })).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(run.mock.calls).toEqual([["h1", c.values]]);
  });

  it.each(cases)("$name says the change could not be sent and keeps the form open when the action fails", async (c) => {
    const run = failing();
    const user = await openForm(c, run);
    await c.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    const note = await screen.findByText("The change could not be sent.");
    expect(note).toHaveClass("error");
    expect(note).toHaveAttribute("role", "status");
    expect(screen.getByRole("heading", { name: c.title, level: 2 })).toBeInTheDocument();
    expect(run.mock.calls).toEqual([["h1", c.values]]);
  });

  it.each(cases)("$name closes without running anything when cancelled", async (c) => {
    const run = answering("accepted");
    const user = await openForm(c, run);
    await c.fill(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("heading", { name: c.title, level: 2 })).not.toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("an action form whose change does not go through", () => {
  const roles = cases[3];

  it("counts a page without that action as not sent", async () => {
    installPage("roles", { ...roles.pages.roles, actions: {} });
    renderSpecPage("roles");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add a role" }));
    await roles.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
  });

  it("keeps what was typed", async () => {
    const user = await openForm(roles, failing());
    await roles.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The change could not be sent.")).toHaveClass("error");
    expect(screen.getByLabelText("Name *")).toHaveValue("Seed keeper");
  });

  it("can be sent again after a failure", async () => {
    const run = vi.fn<ActionRun>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("accepted");
    const user = await openForm(roles, run);
    await roles.fill(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("The change could not be sent.");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("an action form that changes the list at once", () => {
  it("lists the rows again once the form has closed", async () => {
    const roles = cases[3];
    const user = await openForm(roles, answering("done"));
    await roles.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await vi.waitFor(() => expect(pages.roles.rows).toHaveBeenCalledTimes(2));
  });

  it("does not list the rows again when the change only waits for approval", async () => {
    const roles = cases[3];
    const user = await openForm(roles, answering("accepted"));
    await roles.fill(user);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Waiting for approval");
    expect(pages.roles.rows).toHaveBeenCalledTimes(1);
  });
});

describe("an action form submitted before the required fields are filled", () => {
  const required: { name: string; page: string; pages: Record<string, PageSetup>; open: string; message: string }[] = [
    {
      name: "inviting a user into no group",
      page: "users",
      pages: { users: pageOf("Users", "Invite a user"), groups: pageOf("Groups", "") },
      open: "Invite a user",
      message: "Required: group_id",
    },
    {
      name: "inviting a user when the groups cannot be loaded",
      page: "users",
      pages: {
        users: pageOf("Users", "Invite a user"),
        groups: {
          ...pageOf("Groups", ""),
          rows: async () => {
            throw new Error("offline");
          },
        },
      },
      open: "Invite a user",
      message: "Required: group_id",
    },
    {
      name: "inviting a user when the console has no groups page",
      page: "users",
      pages: { users: pageOf("Users", "Invite a user") },
      open: "Invite a user",
      message: "Required: group_id",
    },
    { name: "adding a goal", page: "goals", pages: { goals: pageOf("Goals", "Add a goal") }, open: "Add a goal", message: "Required: title" },
    { name: "adding an objective", page: "goals", pages: { goals: goalsWithOne }, open: "Add an objective", message: "Required: title" },
    {
      name: "adding an objective when there is no goal",
      page: "goals",
      pages: { goals: pageOf("Goals", "Add a goal") },
      open: "Add an objective",
      message: "Required: goal_id, title",
    },
    { name: "adding a role", page: "roles", pages: { roles: pageOf("Roles", "Add a role") }, open: "Add a role", message: "Required: name" },
    { name: "changing the profile", page: "profile", pages: { profile: pageOf("Profile", "Save changes") }, open: "Save changes", message: "Required: name" },
    { name: "renaming the hub", page: "profile", pages: { profile: pageOf("Profile", "Save changes") }, open: "Rename the hub", message: "Required: name" },
    {
      name: "setting a language when none is offered",
      page: "general",
      pages: { general: pageOf("General", "Save changes", [{ languages: [] }]) },
      open: "Default language",
      message: "Required: language",
    },
    {
      name: "adding a document",
      page: "documents",
      pages: { documents: pageOf("Documents", "Upload a document") },
      open: "Upload a document",
      message: "Required: title, text",
    },
  ];

  it.each(required)("$name asks for the missing fields and runs nothing", async ({ page, pages: setups, open, message }) => {
    const run = answering("accepted");
    for (const [id, setup] of Object.entries(setups)) {
      installPage(id, id === page ? { ...setup, actions: everyAction(run) } : setup);
    }
    renderSpecPage(page);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: open }));

    await user.click(await screen.findByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(run).not.toHaveBeenCalled();
  });

  it("counts a title of spaces as missing", async () => {
    const run = answering("accepted");
    installPage("goals", { ...pageOf("Goals", "Add a goal"), actions: { goals: run } });
    renderSpecPage("goals");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add a goal" }));
    await user.type(await screen.findByLabelText("Title *"), "   ");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: title");
    expect(run).not.toHaveBeenCalled();
  });
});

describe("the choices an action form offers", () => {
  it("lists the groups of the hub by name for an invitation", async () => {
    await openForm(cases[0], answering("accepted"));

    const options = screen.getByLabelText("Group *").querySelectorAll("option");

    expect([...options].map((option) => [option.value, option.textContent])).toEqual([
      ["g-1", "Riders"],
      ["g-2", "Farmers"],
    ]);
  });

  it("invites into the first group when none is picked", async () => {
    const run = answering("accepted");
    const user = await openForm(cases[0], run);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Waiting for approval");
    expect(run.mock.calls[0][1]).toEqual({ group_id: "g-1", actor_code: "", actor_id: "", name: "" });
  });

  it("lists the goals of the hub by title for an objective", async () => {
    await openForm(cases[2], answering("accepted"));

    const options = screen.getByLabelText("Goal *").querySelectorAll("option");

    expect([...options].map((option) => [option.value, option.textContent])).toEqual([["g-9", "Seed library"]]);
  });

  it("lists the open and the confirmed way of joining", async () => {
    await openForm(cases[6], answering("accepted"));

    const options = screen.getByLabelText("Joining *").querySelectorAll("option");

    expect([...options].map((option) => option.value)).toEqual(["open", "confirmed"]);
  });

  it("joins openly when no way of joining is picked", async () => {
    const run = answering("accepted");
    const user = await openForm(cases[6], run);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Waiting for approval");
    expect(run.mock.calls[0][1]).toEqual({ join_mode: "open" });
  });

  it("lists the languages the hub offers", async () => {
    await openForm(cases[7], answering("accepted"));

    const options = screen.getByLabelText("Language *").querySelectorAll("option");

    expect([...options].map((option) => option.value)).toEqual(["en", "hu"]);
  });

  it("asks the other page for its rows for the open hub", async () => {
    await openForm(cases[0], answering("accepted"));

    expect(pages.groups.rows).toHaveBeenCalledWith("h1", {});
  });
});

const formButtons = () =>
  screen
    .getAllByRole("button")
    .map((button) => button.textContent)
    .filter((text) => text !== "enhance.button");

describe("the buttons that open action forms", () => {
  it("shows one button for the form and no other on a page without a secondary form", async () => {
    installPage("roles", pageOf("Roles", "Add a role"));
    renderSpecPage("roles");

    await screen.findByRole("heading", { name: "Roles" });

    expect(formButtons()).toEqual(["Add a role"]);
  });

  it.each([
    ["general", "Save changes", "Default language"],
    ["profile", "Save changes", "Rename the hub"],
    ["goals", "Add a goal", "Add an objective"],
  ])("shows the main and the secondary button on the %s page", async (page, primary, secondary) => {
    installPage(page, pageOf("Page", primary));
    renderSpecPage(page);

    await screen.findByRole("heading", { name: "Page" });

    expect(formButtons()).toEqual([primary, secondary]);
  });

  it("replaces the open form when the other button is pressed", async () => {
    installPage("profile", pageOf("Profile", "Save changes"));
    renderSpecPage("profile");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await user.type(await screen.findByLabelText("Description"), "Grow together");

    await user.click(screen.getByRole("button", { name: "Rename the hub" }));

    expect(await screen.findByRole("heading", { name: "Rename the hub", level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Save changes", level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });

  it("clears the earlier outcome when another form is opened", async () => {
    installPage("profile", { ...pageOf("Profile", "Save changes"), actions: { hubname: answering("accepted") } });
    renderSpecPage("profile");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Rename the hub" }));
    await user.type(await screen.findByLabelText("Name *"), "Siaya Hub");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Waiting for approval");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { name: "Save changes", level: 2 });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("an action form drawn from the tool's input schema", () => {
  it("shows the schema's fields only, not the ones the console or the server fills", async () => {
    await openForm(cases[0], answering("accepted"));

    expect(screen.queryByLabelText("expires_at")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("instance_id")).not.toBeInTheDocument();
  });

  it("marks a field required when the tool requires it", async () => {
    await openForm(cases[1], answering("accepted"));

    expect(screen.getByLabelText("Title *")).toBeRequired();
    expect(screen.getByLabelText("Description")).not.toBeRequired();
  });

  it("says the form could not be loaded when the hub's tools do not offer the one it sends", async () => {
    offered.splice(0, offered.length);
    installPage("roles", { ...pageOf("Roles", "Add a role"), actions: { roles: answering("accepted") } });
    renderSpecPage("roles");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Add a role" }));

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("still draws a form that has no tool to send, from its own list of fields", async () => {
    offered.splice(0, offered.length);
    await openForm(cases[8], answering("accepted"));

    expect(screen.getByLabelText("Text *")).toBeInTheDocument();
  });
});
