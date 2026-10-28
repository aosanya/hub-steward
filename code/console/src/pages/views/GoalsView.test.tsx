import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, proposals, renderPage } from "../spec/profileTesting";
import { GoalsView } from "./GoalsView";

vi.mock("../../wakala/mcp");

const goals = [
  { id: "g1", code: "G-1", title: "Farmers buy inputs together", description: "One order for the whole group." },
  { id: "g2", code: "G-2", title: "Farmers find a buyer for their produce", description: "" },
];

const objectives = [
  { id: "o1", code: "O-1", title: "Gather the farmers' needs into one order", description: "Collect each need.", goal_id: "g1" },
  { id: "o2", code: "O-2", title: "Get the supplier's answer to the farmers", goal_id: "g1" },
  { id: "o3", code: "O-3", title: "Match produce to a buyer", goal_id: "g2" },
];

const roles = [
  { id: "r1", name: "Farmers' coordinator", kind: "ai" },
  { id: "r2", name: "Group coordinator", kind: "human" },
  { id: "r3", name: "Supplier", kind: "human" },
];

const links = [
  { id: "l1", workflow_id: "w1", objective_id: "o1" },
  { id: "l2", workflow_id: "w2", objective_id: "o1" },
  { id: "l3", workflow_id: "w2", objective_id: "o2" },
];

const workflows = [
  { id: "w1", code: "W-1", name: "Group order" },
  { id: "w2", code: "W-2", name: "Cancel an order" },
];

const steps = [
  { id: "s1", code: "WI-1", title: "Start the order", workflow_id: "w1", ordinality: 1 },
  { id: "s2", code: "WI-2", title: "Tell the supplier", workflow_id: "w2", ordinality: 1 },
  { id: "s3", code: "WI-3", title: "Done elsewhere", workflow_id: "w-other", ordinality: 1 },
];

const seatsByStep: Record<string, unknown[]> = {
  s1: [
    { role_id: "r1", label: "responsible" },
    { role_id: "r2", label: "accountable" },
  ],
  s2: [
    { role_id: "r3", label: "informed" },
    { role_id: "r3", label: "consulted" },
  ],
  s3: [{ role_id: "r2", label: "responsible" }],
};

const byId = (list: Record<string, unknown>[], key: string) => (args: Record<string, unknown>) =>
  list.find((item) => item.id === args[key]) ??
  (() => {
    throw new Error("not found");
  })();

const replies = (more: Record<string, unknown> = {}) => ({
  agency_list_goals: { items: goals },
  agency_list_objectives: { items: objectives },
  agency_get_goal: byId(goals, "goal_id"),
  agency_get_objective: byId(objectives, "objective_id"),
  agency_list_roles: { items: roles },
  agency_list_workflow_objectives: { items: links },
  agency_list_workflows: { items: workflows },
  agency_list_work_items: { items: steps },
  agency_list_role_assignments_for_work_item: (args: Record<string, unknown>) => ({ items: seatsByStep[String(args.work_item_id)] ?? [] }),
  agency_propose_write: { status: "pending" },
  ...more,
});

const open = async (search = "", more: Record<string, unknown> = {}) => {
  answerWith(replies(more));
  renderPage(<GoalsView />, "goals", search);
};

const tableRows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

const rowsOf = () => tableRows(screen.getByRole("table"));

const goalHeadings = () => screen.getAllByRole("button", { name: /^G-/ }).map((button) => button.textContent);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the goals list", () => {
  it("shows each goal as a card with its code, the number of objectives under it and a link to edit it", async () => {
    const user = userEvent.setup();
    await open();

    expect(await screen.findByRole("heading", { name: "Goals", level: 1 })).toBeInTheDocument();
    await screen.findByRole("button", { name: "G-1 · Farmers buy inputs together" });
    expect(goalHeadings()).toEqual(["G-1 · Farmers buy inputs together", "G-2 · Farmers find a buyer for their produce"]);
    await user.click(screen.getByRole("button", { name: "G-1 · Farmers buy inputs together" }));
    expect(screen.getByText("Objectives").nextElementSibling).toHaveTextContent("2");
    expect(screen.getAllByRole("link", { name: "Edit" })[0]).toHaveAttribute("href", "/h/h1/goals?goal=g1");
  });

  it("lists the goals by title", async () => {
    await open("", {
      agency_list_goals: {
        items: [
          { id: "g2", code: "G-2", title: "Farmers find a buyer for their produce" },
          { id: "g1", code: "G-1", title: "Farmers buy inputs together" },
        ],
      },
    });
    await screen.findAllByRole("button", { name: /^G-/ });

    expect(goalHeadings()).toEqual(["G-1 · Farmers buy inputs together", "G-2 · Farmers find a buyer for their produce"]);
  });

  it("offers Add a goal in the title row as a link to the form", async () => {
    await open();

    expect(await screen.findByRole("link", { name: "Add a goal" })).toHaveAttribute("href", "/h/h1/goals?add=goal");
  });

  it("narrows the goals to those whose title or code has the words typed", async () => {
    const user = userEvent.setup();
    await open();
    await screen.findByRole("button", { name: /^G-1/ });

    await user.type(screen.getByRole("searchbox", { name: "Search goals" }), "buyer");
    expect(goalHeadings()).toEqual(["G-2 · Farmers find a buyer for their produce"]);

    await user.clear(screen.getByRole("searchbox", { name: "Search goals" }));
    await user.type(screen.getByRole("searchbox", { name: "Search goals" }), "g-1");
    expect(goalHeadings()).toEqual(["G-1 · Farmers buy inputs together"]);
  });

  it("says there is nothing here and keeps the title and the Add a goal link when there are no goals", async () => {
    await open("", { agency_list_goals: { items: [] }, agency_list_objectives: { items: [] } });

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Goals", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a goal" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("says the page could not be loaded in the error style and keeps the Add a goal link when the goals cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("offline"));
    renderPage(<GoalsView />, "goals");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("link", { name: "Add a goal" })).toBeInTheDocument();
  });

  it("opens a goal when its Edit link is followed", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await screen.findAllByRole("link", { name: "Edit" }))[0]);

    expect(await screen.findByRole("heading", { name: "Farmers buy inputs together", level: 1 })).toBeInTheDocument();
  });
});

describe("one goal", () => {
  it("shows the goal's code, what it is for, how many objectives it has and each objective with its code", async () => {
    await open("?goal=g1");

    expect(await screen.findByRole("heading", { name: "Farmers buy inputs together", level: 1 })).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "Goal G-1", level: 2 }).closest("section") as HTMLElement;
    expect(within(card).getByText("One order for the whole group.")).toBeInTheDocument();
    expect(within(card).getByText("Objectives").nextElementSibling).toHaveTextContent("2");
    await screen.findByRole("table");
    expect(rowsOf()).toEqual([
      ["Gather the farmers' needs into one orderO-1", "Open"],
      ["Get the supplier's answer to the farmersO-2", "Open"],
    ]);
  });

  it("shows only the objective and a link to open it, with nobody named as responsible", async () => {
    await open("?goal=g1");

    await screen.findByRole("table");

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Objective", ""]);
    expect(callsOf("agency_list_role_assignments_for_work_item")).toEqual([]);
  });

  it("offers Add an objective as a link to the form with this goal chosen", async () => {
    await open("?goal=g1");

    expect(await screen.findByRole("link", { name: "Add an objective" })).toHaveAttribute("href", "/h/h1/goals?goal=g1&add=objective");
  });

  it("says nothing here when the goal has no objectives", async () => {
    await open("?goal=g2", { agency_list_objectives: { items: [] } });

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Farmers find a buyer for their produce", level: 1 })).toBeInTheDocument();
  });

  it("says the page could not be loaded when the goal is unknown", async () => {
    await open("?goal=missing");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "Goals", level: 1 })).toBeInTheDocument();
  });

  it("opens an objective when its title is followed", async () => {
    const user = userEvent.setup();
    await open("?goal=g1");

    await user.click(await screen.findByRole("link", { name: "Gather the farmers' needs into one order" }));

    expect(await screen.findByRole("heading", { name: "Objective O-1", level: 1 })).toBeInTheDocument();
  });
});

describe("one objective", () => {
  it("shows the objective, what it is for and the goal it serves with a link back to it", async () => {
    await open("?goal=g1&objective=o1");

    expect(await screen.findByRole("heading", { name: "Objective O-1", level: 1 })).toBeInTheDocument();
    const card = screen
      .getByRole("heading", { name: "Gather the farmers' needs into one order", level: 2 })
      .closest("section") as HTMLElement;
    expect(within(card).getByText("Collect each need.")).toBeInTheDocument();
    expect(await within(card).findByRole("link", { name: "G-1 · Farmers buy inputs together" })).toHaveAttribute(
      "href",
      "/h/h1/goals?goal=g1",
    );
  });

  it("lists the workflows that serve the objective with their steps and every objective each one serves", async () => {
    await open("?goal=g1&objective=o1");

    await screen.findAllByRole("table");
    const [workflowsTable] = screen.getAllByRole("table");
    expect(screen.getByRole("heading", { name: "Workflows", level: 2 })).toBeInTheDocument();
    expect(within(workflowsTable).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Workflow", "Steps", "Objectives", ""]);
    expect(tableRows(workflowsTable)).toEqual([
      ["Group orderW-1", "1", "O-1", "Open"],
      ["Cancel an orderW-2", "1", "O-1O-2", "Open"],
    ]);
    expect(within(workflowsTable).getByRole("link", { name: "O-2" })).toHaveAttribute("href", "/h/h1/objectives?objective=o2");
  });

  it("lists the steps of those workflows with each role and its labels, an AI role carrying no initials", async () => {
    await open("?goal=g1&objective=o1");

    await screen.findAllByRole("table");
    const stepsTable = screen.getAllByRole("table")[1];
    expect(screen.getByRole("heading", { name: "Steps", level: 2 })).toBeInTheDocument();
    expect(within(stepsTable).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Step", "Workflow", "Roles", ""]);
    expect(tableRows(stepsTable)).toEqual([
      ["Start the orderWI-1", "Group order", "Farmers' coordinatorRGCGroup coordinatorA", "Open"],
      ["Tell the supplierWI-2", "Cancel an order", "SSupplierC I", "Open"],
    ]);
    expect(within(stepsTable).getByRole("link", { name: "Start the order" })).toHaveAttribute("href", "/h/h1/objectives?step=s1");
  });

  it("links each role to the roles page", async () => {
    await open("?goal=g1&objective=o1");

    expect(await screen.findByRole("link", { name: "Supplier" })).toHaveAttribute("href", "/h/h1/roles");
  });

  it("reads the objective, the workflows, the steps, their roles and the role list once each", async () => {
    await open("?goal=g1&objective=o1");
    await screen.findAllByRole("table");

    expect(callsOf("agency_get_objective")).toEqual([{ objective_id: "o1" }]);
    expect(callsOf("agency_list_workflow_objectives")).toEqual([{}]);
    expect(callsOf("agency_list_workflows")).toHaveLength(1);
    expect(callsOf("agency_list_work_items")).toHaveLength(1);
    expect(callsOf("agency_list_role_assignments_for_work_item")).toEqual([{ work_item_id: "s1" }, { work_item_id: "s2" }]);
    expect(callsOf("agency_list_roles")).toHaveLength(1);
  });

  it("leaves out a role the role list no longer holds", async () => {
    await open("?goal=g1&objective=o1", { agency_list_roles: { items: [roles[1]] } });

    await screen.findAllByRole("table");
    expect(tableRows(screen.getAllByRole("table")[1]).map((row) => row[2])).toEqual(["GCGroup coordinatorA", "No roles on this step yet."]);
  });

  it("still shows the objective when the goal it serves cannot be read", async () => {
    await open("?objective=o1", {
      agency_get_goal: () => {
        throw new Error("offline");
      },
    });

    expect(await screen.findByRole("heading", { name: "Objective O-1", level: 1 })).toBeInTheDocument();
    await screen.findAllByRole("table");
    expect(screen.queryByRole("link", { name: /G-1/ })).not.toBeInTheDocument();
  });

  it("says the objective is not tied to a workflow and has no steps when no workflow serves it", async () => {
    await open("?goal=g1&objective=o1", { agency_list_workflow_objectives: { items: [] } });

    expect(await screen.findByText("Not tied to a workflow")).toBeInTheDocument();
    expect(screen.getByText("No steps yet.")).toBeInTheDocument();
  });

  it("keeps the objective and says the workflows could not be loaded when they cannot be read", async () => {
    await open("?goal=g1&objective=o1", {
      agency_list_workflows: () => {
        throw new Error("down");
      },
    });

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "Objective O-1", level: 1 })).toBeInTheDocument();
  });

  it("says the page could not be loaded when the objective cannot be read", async () => {
    await open("?objective=missing");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
  });
});

describe("adding a goal", () => {
  const openForm = async () => {
    const user = userEvent.setup();
    await open("?add=goal");
    await screen.findByRole("form", { name: "New goal" });
    return user;
  };

  it("opens a form titled Add a goal with a name, a description, Save, Cancel and the note", async () => {
    await openForm();

    expect(screen.getByRole("heading", { name: "Add a goal", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByText("Nothing is recorded until you press Save.")).toBeInTheDocument();
  });

  it("asks for approval to add the goal, then shows the list with a note that it waits for approval", async () => {
    const user = await openForm();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Open a seed library");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Share seeds");

    await user.click(screen.getByRole("button", { name: "Save" }));

    const note = await screen.findByText("Waiting for approval");
    expect(note).toHaveAttribute("role", "status");
    expect(note).not.toHaveClass("error");
    expect(await screen.findByRole("button", { name: /^G-1/ })).toBeInTheDocument();
    expect(proposals()).toEqual([
      {
        kind: "agency_create_goal",
        summary: "Add the goal Open a seed library",
        payload: { title: "Open a seed library", description: "Share seeds" },
      },
    ]);
  });

  it("asks for a name and sends nothing when the name is empty or only spaces", async () => {
    const user = await openForm();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "   ");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Name");
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("says the change could not be sent and keeps the form and what was typed when the proposal fails", async () => {
    const user = userEvent.setup();
    await open("?add=goal", {
      agency_propose_write: () => {
        throw new Error("offline");
      },
    });
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "Open a seed library");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Open a seed library");
  });

  it("returns to the list without sending anything when cancelled", async () => {
    const user = await openForm();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Open a seed library");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Goals", level: 1 })).toBeInTheDocument();
    expect(callsOf("agency_propose_write")).toEqual([]);
  });
});

describe("adding an objective", () => {
  const goalOptions = () =>
    [...screen.getByRole("combobox", { name: "Goal" }).querySelectorAll("option")].map((option) => [option.value, option.textContent]);

  const workflowOptions = () =>
    [...screen.getByRole("combobox", { name: "Workflow" }).querySelectorAll("option")].map((option) => [option.value, option.textContent]);

  const openForm = async (search = "?add=objective&goal=g1") => {
    const user = userEvent.setup();
    await open(search);
    await screen.findByRole("form", { name: "New objective" });
    await vi.waitFor(() => expect(workflowOptions()).toHaveLength(workflows.length));
    return user;
  };

  it("opens a form titled Add an objective with the name, the goal, the description, the workflow and the note", async () => {
    await openForm();

    expect(screen.getByRole("heading", { name: "Add an objective", level: 1 })).toBeInTheDocument();
    expect(workflowOptions()).toEqual([
      ["w1", "Group order"],
      ["w2", "Cancel an order"],
    ]);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("placeholder", "What the group wants to achieve");
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByText("Nothing is recorded until you press Save.")).toBeInTheDocument();
  });

  it("lists the goals of the hub by title and starts with the goal the form was opened from", async () => {
    await openForm("?add=objective&goal=g2");

    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));
    expect(goalOptions()).toEqual([
      ["g1", "Farmers buy inputs together"],
      ["g2", "Farmers find a buyer for their produce"],
    ]);
    expect(screen.getByRole("combobox", { name: "Goal" })).toHaveValue("g2");
  });

  it("starts with the first goal when it was opened from no goal", async () => {
    await openForm("?add=objective");

    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: "Goal" })).toHaveValue("g1"));
  });

  it("asks for approval to add the objective under its goal, then shows that goal with a note that it waits for approval", async () => {
    const user = await openForm();
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Record each farmer's payment");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Mark each payment");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Waiting for approval")).toHaveAttribute("role", "status");
    expect(await screen.findByRole("heading", { name: "Farmers buy inputs together", level: 1 })).toBeInTheDocument();
    expect(proposals()).toEqual([
      {
        kind: "agency_create_objective",
        summary: "Add the objective Record each farmer's payment, served by Group order",
        payload: {
          goal_id: "g1",
          title: "Record each farmer's payment",
          description: "Mark each payment",
          workflow: { tool: "agency_link_workflow_objective", workflow_id: "w1" },
        },
      },
    ]);
  });

  it("links the objective to the workflow chosen in the form", async () => {
    const user = await openForm();
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Stop an order");
    await user.selectOptions(screen.getByRole("combobox", { name: "Workflow" }), "w2");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Waiting for approval");
    expect(proposals()[0].payload).toMatchObject({ workflow: { tool: "agency_link_workflow_objective", workflow_id: "w2" } });
    expect(JSON.stringify(proposals())).not.toContain("agency_set_raci");
  });

  it("asks for a workflow and sends nothing when the agency has none", async () => {
    const user = userEvent.setup();
    await open("?add=objective&goal=g1", { agency_list_workflows: { items: [] } });
    await screen.findByRole("form", { name: "New objective" });
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Stop an order");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Workflow");
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("adds the objective under the goal chosen in the form", async () => {
    const user = await openForm();
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));
    await user.selectOptions(screen.getByRole("combobox", { name: "Goal" }), "g2");
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Find a second buyer");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Waiting for approval");
    expect(proposals()[0].payload).toMatchObject({ goal_id: "g2", title: "Find a second buyer" });
  });

  it("offers no responsible role, because a seat belongs to a step", async () => {
    await openForm();
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));

    expect(screen.queryByRole("combobox", { name: "Responsible role" })).not.toBeInTheDocument();
  });

  it("asks for a name and sends nothing when the name is missing", async () => {
    const user = await openForm();
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Name");
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("asks for a goal and a name when the hub has no goals", async () => {
    const user = userEvent.setup();
    await open("?add=objective", { agency_list_goals: { items: [] }, agency_list_objectives: { items: [] } });
    await screen.findByRole("form", { name: "New objective" });
    await vi.waitFor(() => expect(workflowOptions()).toHaveLength(workflows.length));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Goal, Name");
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("says the change could not be sent and keeps the form when the proposal fails", async () => {
    const user = userEvent.setup();
    await open("?add=objective&goal=g1", {
      agency_propose_write: () => {
        throw new Error("offline");
      },
    });
    await screen.findByRole("form", { name: "New objective" });
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Find a second buyer");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Find a second buyer");
  });

  it("returns to the goal without sending anything when cancelled", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Farmers buy inputs together", level: 1 })).toBeInTheDocument();
    expect(callsOf("agency_propose_write")).toEqual([]);
  });
});
