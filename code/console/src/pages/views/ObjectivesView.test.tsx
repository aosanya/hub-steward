import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import {
  answerWith,
  callsOf,
  proposals,
  renderPage,
} from "../spec/profileTesting";
import { ObjectivesView } from "./ObjectivesView";

vi.mock("../../data/features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

vi.mock("../../wakala/mcp");

const goals = [
  { id: "g1", code: "G-1", title: "Suppliers post their prices" },
  { id: "g2", code: "G-2", title: "Farmers buy alone or together" },
];

const objectives = [
  {
    id: "o1",
    code: "O-1",
    title: "Suppliers post ordinary and bulk prices",
    description: "Prices stay current.",
    goal_id: "g1",
  },
  {
    id: "o3",
    code: "O-3",
    title: "Farmers buy together in a group order",
    description: "One order for the group.",
    goal_id: "g2",
  },
];

const roles = [
  { id: "r1", name: "Group coordinator", kind: "human" },
  { id: "r2", name: "Farmers' agent", kind: "ai" },
];

const workflows = [
  { id: "w1", code: "W-1", name: "Group order" },
  { id: "w2", code: "W-2", name: "Cancel an order" },
];

const workItems = [
  { id: "i1", code: "WI-1", title: "Start the order", workflow_id: "w1", ordinality: 1 },
  { id: "i2", code: "WI-2", title: "Farmers join", workflow_id: "w1", ordinality: 2 },
  { id: "i3", code: "WI-3", title: "Tell the farmers", workflow_id: "w2", ordinality: 1 },
];

const rolesByStep: Record<string, unknown[]> = {
  i1: [
    { role_id: "r1", label: "accountable" },
    { role_id: "r1", label: "responsible" },
    { role_id: "r2", label: "consulted" },
  ],
  i2: [{ role_id: "r2", label: "responsible" }],
};

const workflowObjectives = [
  { id: "l1", workflow_id: "w1", objective_id: "o3" },
  { id: "l2", workflow_id: "w2", objective_id: "o3" },
  { id: "l3", workflow_id: "w2", objective_id: "o1" },
];

const measures = [
  {
    id: "m3",
    objective_id: "o3",
    name: "Bags in the open group order",
    current: 16,
    target: 20,
    unit: "bags",
    status: "On track",
  },
];

const byId =
  (list: Record<string, unknown>[], key: string) =>
  (args: Record<string, unknown>) =>
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
  agency_list_role_assignments_for_work_item: (
    args: Record<string, unknown>,
  ) => ({ items: rolesByStep[String(args.work_item_id)] ?? [] }),
  agency_list_workflow_objectives: { items: workflowObjectives },
  agency_list_workflows: { items: workflows },
  agency_list_work_items: { items: workItems },
  agency_list_measures: { items: measures },
  agency_propose_write: { status: "pending" },
  ...more,
});

const open = async (search = "", more: Record<string, unknown> = {}) => {
  answerWith(replies(more));
  renderPage(<ObjectivesView />, "objectives", search);
};

const cardOf = async (title: string) => {
  const heading = await screen.findByRole("heading", { name: title, level: 2 });
  return within(heading.closest("section") as HTMLElement);
};

const expanded = async (title: string) => {
  const heading = await screen.findByRole("heading", { name: title, level: 2 });
  const toggle = within(heading).getByRole("button");
  if (toggle.getAttribute("aria-expanded") === "false")
    await userEvent.setup().click(toggle);
  return within(heading.closest("section") as HTMLElement);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the objectives list", () => {
  it("loads every card collapsed, with only its title and Edit link showing, and opens or closes one when its title is pressed", async () => {
    const user = userEvent.setup();
    await open();
    const heading = await screen.findByRole("heading", {
      name: "O-3 · Farmers buy together in a group order",
      level: 2,
    });
    const toggle = within(heading).getByRole("button");
    const card = within(heading.closest("section") as HTMLElement);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      card.queryByRole("link", { name: "W-1 · Group order" }),
    ).not.toBeInTheDocument();
    expect(card.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByText("No measure yet")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      card.getByRole("link", { name: "W-1 · Group order" }),
    ).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      card.queryByRole("link", { name: "W-1 · Group order" }),
    ).not.toBeInTheDocument();
  });

  it("shows each objective as a card with its goal and the workflows that deliver it, each with its code and its number of steps", async () => {
    await open();

    expect(
      await screen.findByRole("heading", { name: "Objectives", level: 1 }),
    ).toBeInTheDocument();
    const first = await expanded(
      "O-1 · Suppliers post ordinary and bulk prices",
    );
    expect(
      first.getByRole("link", { name: "G-1 · Suppliers post their prices" }),
    ).toHaveAttribute("href", "/h/h1/goals?goal=g1");
    expect(
      first.getByRole("link", { name: "W-2 · Cancel an order" }),
    ).toHaveAttribute("href", "/h/h1/workflows?open=w2");
    expect(first.queryByText("W-1 · Group order")).not.toBeInTheDocument();
    expect(first.getByText(/Steps: 1/)).toBeInTheDocument();

    const second = await expanded(
      "O-3 · Farmers buy together in a group order",
    );
    expect(
      second.getByRole("link", { name: "W-1 · Group order" }),
    ).toHaveAttribute("href", "/h/h1/workflows?open=w1");
    expect(second.getByText(/Steps: 2/)).toBeInTheDocument();
    expect(
      second.getByRole("link", { name: "W-2 · Cancel an order" }),
    ).toBeInTheDocument();
  });

  it("says an objective is not tied to a workflow when no workflow serves it, and shows no responsible role", async () => {
    await open("", {
      agency_list_workflow_objectives: { items: [] },
    });

    const card = await expanded(
      "O-1 · Suppliers post ordinary and bulk prices",
    );
    expect(card.getByText("Not tied to a workflow")).toBeInTheDocument();
    expect(card.queryByText("Responsible")).not.toBeInTheDocument();
    expect(callsOf("agency_list_role_assignments_for_work_item")).toEqual([]);
  });

  it("shows the measure of an objective as it stands now against its target, from the measures tool", async () => {
    await open();

    const card = await expanded("O-3 · Farmers buy together in a group order");
    expect(
      await card.findByText("Bags in the open group order"),
    ).toBeInTheDocument();
    expect(card.getByText("16 / 20 bags")).toBeInTheDocument();
    expect(card.getByText("On track")).toBeInTheDocument();
    expect(
      (
        await expanded("O-1 · Suppliers post ordinary and bulk prices")
      ).getByText("No measure yet"),
    ).toBeInTheDocument();
  });

  it("still lists the objectives when the measures cannot be read", async () => {
    await open("", {
      agency_list_measures: () => {
        throw new Error("no such tool");
      },
    });

    await expanded("O-1 · Suppliers post ordinary and bulk prices");
    await expanded("O-3 · Farmers buy together in a group order");
    expect(screen.getAllByText("No measure yet")).toHaveLength(2);
  });

  it("offers Add an objective in the title row as a link to the form and Edit on each card", async () => {
    await open();

    expect(
      await screen.findByRole("link", { name: "Add an objective" }),
    ).toHaveAttribute("href", "/h/h1/objectives?add=objective");
    await screen.findByRole("heading", {
      name: "O-1 · Suppliers post ordinary and bulk prices",
      level: 2,
    });
    const links = screen.getAllByRole("link", { name: "Edit" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/h/h1/objectives?objective=o3",
      "/h/h1/objectives?objective=o1",
    ]);
  });

  it("lists the objectives by title", async () => {
    await open();

    const titles = await screen.findAllByRole("heading", { level: 2 });
    expect(titles.map((title) => title.textContent)).toEqual([
      "O-3 · Farmers buy together in a group order",
      "O-1 · Suppliers post ordinary and bulk prices",
    ]);
  });

  it("narrows the objectives to those whose title or code has the words typed", async () => {
    const user = userEvent.setup();
    await open();
    await screen.findAllByRole("heading", { level: 2 });

    await user.type(screen.getByRole("searchbox", { name: "Search objectives" }), "bulk");
    expect(screen.getAllByRole("heading", { level: 2 }).map((title) => title.textContent)).toEqual(["O-1 · Suppliers post ordinary and bulk prices"]);

    await user.clear(screen.getByRole("searchbox", { name: "Search objectives" }));
    await user.type(screen.getByRole("searchbox", { name: "Search objectives" }), "o-3");
    expect(screen.getAllByRole("heading", { level: 2 }).map((title) => title.textContent)).toEqual(["O-3 · Farmers buy together in a group order"]);
  });

  it("says there is nothing here and keeps the title and the Add an objective link when there are no objectives", async () => {
    await open("", { agency_list_objectives: { items: [] } });

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Objectives", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add an objective" }),
    ).toBeInTheDocument();
  });

  it("says the page could not be loaded in the error style when the objectives cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("offline"));
    renderPage(<ObjectivesView />, "objectives");

    expect(
      await screen.findByText("The page could not be loaded."),
    ).toHaveClass("error");
    expect(
      screen.getByRole("link", { name: "Add an objective" }),
    ).toBeInTheDocument();
  });
});

const tableRows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

describe("one objective with its workflows and steps", () => {
  it("lists the workflows that deliver the objective with their number of steps and every objective each one serves", async () => {
    await open("?objective=o3");

    await screen.findAllByRole("table");
    const table = screen.getAllByRole("table")[0];
    expect(tableRows(table)).toEqual([
      ["Group orderW-1", "2", "O-3", "Open"],
      ["Cancel an orderW-2", "1", "O-3O-1", "Open"],
    ]);
    expect(
      within(table).getByRole("link", { name: "Group order" }),
    ).toHaveAttribute("href", "/h/h1/workflows?open=w1");
    expect(within(table).getByRole("link", { name: "O-1" })).toHaveAttribute(
      "href",
      "/h/h1/objectives?objective=o1",
    );
    expect(
      within(table)
        .getAllByRole("link", { name: "Open" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/h/h1/workflows?open=w1", "/h/h1/workflows?open=w2"]);
    expect(callsOf("agency_list_workflow_objectives")[0]).toEqual({});
  });

  it("lists the steps of those workflows in order, each with its roles and their labels, an agent carrying no initials", async () => {
    await open("?objective=o3");

    await screen.findAllByRole("table");
    const table = screen.getAllByRole("table")[1];
    expect(tableRows(table)).toEqual([
      [
        "Start the orderWI-1",
        "Group order",
        "GCGroup coordinatorR AFarmers' agentC",
        "Open",
      ],
      ["Farmers joinWI-2", "Group order", "Farmers' agentR", "Open"],
      [
        "Tell the farmersWI-3",
        "Cancel an order",
        "No roles on this step yet.",
        "Open",
      ],
    ]);
    expect(
      within(table).getByRole("link", { name: "Start the order" }),
    ).toHaveAttribute("href", "/h/h1/objectives?step=i1");
    expect(
      within(table)
        .getAllByRole("link", { name: "Open" })
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/h/h1/objectives?step=i1",
      "/h/h1/objectives?step=i2",
      "/h/h1/objectives?step=i3",
    ]);
  });

  it("says the objective is not tied to a workflow when none serves it", async () => {
    await open("?objective=o3", {
      agency_list_workflow_objectives: { items: [] },
    });

    expect(
      await screen.findByText("Not tied to a workflow"),
    ).toBeInTheDocument();
    expect(screen.getByText("No steps yet.")).toBeInTheDocument();
  });
});

describe("one objective with its measure", () => {
  it("shows the objective with its workflows and steps, then the measure with now, target and status", async () => {
    await open("?objective=o3");

    expect(
      await screen.findByRole("heading", { name: "Objective O-3", level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("table")).toHaveLength(2);
    const card = await cardOf("Measure");
    expect(card.getByText("Bags in the open group order")).toBeInTheDocument();
    expect(card.getByText("16 / 20 bags")).toBeInTheDocument();
    expect(card.getByText("On track")).toBeInTheDocument();
    expect(callsOf("agency_list_measures")[0]).toMatchObject({
      objective_id: "o3",
    });
  });

  it("lists the name, the target, the unit and the status of each measure on its own line", async () => {
    await open("?objective=o3");

    const card = await cardOf("Measure");
    const labels = (await card.findAllByRole("term")).map(
      (term) => term.textContent,
    );
    expect(labels).toEqual([
      "Measure",
      "Now / target",
      "Target",
      "Unit",
      "Status",
    ]);
    const values = card
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(values).toEqual([
      "Bags in the open group order",
      "16 / 20 bags",
      "20",
      "bags",
      "On track",
    ]);
  });

  it("says there is no measure yet for an objective without one", async () => {
    await open("?objective=o1");

    const card = await cardOf("Measure");
    expect(card.getByText("No measure yet")).toBeInTheDocument();
  });

  it("still shows the objective when the measures cannot be read", async () => {
    await open("?objective=o1", {
      agency_list_measures: () => {
        throw new Error("no such tool");
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Objective O-1", level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No measure yet")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the objective is unknown", async () => {
    await open("?objective=missing");

    expect(
      await screen.findByText("The page could not be loaded."),
    ).toHaveClass("error");
  });

  it("asks for approval to set the measure with its target and unit, then says it waits for approval", async () => {
    const user = userEvent.setup();
    await open("?objective=o1");
    await screen.findByRole("form", { name: "Set the measure" });

    await user.type(
      screen.getByRole("textbox", { name: "Measure" }),
      "Suppliers with a posted price",
    );
    await user.type(screen.getByRole("textbox", { name: "Target" }), "2");
    await user.type(screen.getByRole("textbox", { name: "Unit" }), "suppliers");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Waiting for approval")).toHaveAttribute(
      "role",
      "status",
    );
    expect(proposals()).toEqual([
      {
        kind: "agency_set_measure",
        summary:
          "Set the measure of O-1: Suppliers with a posted price, target 2 suppliers",
        payload: {
          objective_id: "o1",
          name: "Suppliers with a posted price",
          target: "2",
          unit: "suppliers",
        },
      },
    ]);
  });

  it("leaves the unit out of the proposal when none is typed", async () => {
    const user = userEvent.setup();
    await open("?objective=o1");
    await screen.findByRole("form", { name: "Set the measure" });
    await user.type(
      screen.getByRole("textbox", { name: "Measure" }),
      "Share of orders paid",
    );
    await user.type(screen.getByRole("textbox", { name: "Target" }), "95%");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Waiting for approval");
    expect(proposals()[0].payload).toEqual({
      objective_id: "o1",
      name: "Share of orders paid",
      target: "95%",
    });
  });

  it("asks for the measure name before sending anything", async () => {
    const user = userEvent.setup();
    await open("?objective=o1");
    await screen.findByRole("form", { name: "Set the measure" });
    await user.type(screen.getByRole("textbox", { name: "Target" }), "2");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Required: Measure",
    );
    expect(proposals()).toEqual([]);
  });

  it("asks for the target before sending anything", async () => {
    const user = userEvent.setup();
    await open("?objective=o1");
    await screen.findByRole("form", { name: "Set the measure" });
    await user.type(
      screen.getByRole("textbox", { name: "Measure" }),
      "Suppliers with a posted price",
    );
    await user.type(screen.getByRole("textbox", { name: "Unit" }), "suppliers");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Required: Target",
    );
    expect(proposals()).toEqual([]);
  });

  it("treats a name or target of only spaces as empty", async () => {
    const user = userEvent.setup();
    await open("?objective=o1");
    await screen.findByRole("form", { name: "Set the measure" });
    await user.type(screen.getByRole("textbox", { name: "Measure" }), "   ");
    await user.type(screen.getByRole("textbox", { name: "Target" }), "   ");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Required: Measure",
    );
    expect(proposals()).toEqual([]);
  });

  it("says the change could not be sent when the proposal is refused", async () => {
    const user = userEvent.setup();
    await open("?objective=o1", {
      agency_propose_write: () => {
        throw new Error("refused");
      },
    });
    await screen.findByRole("form", { name: "Set the measure" });
    await user.type(
      screen.getByRole("textbox", { name: "Measure" }),
      "Suppliers with a posted price",
    );
    await user.type(screen.getByRole("textbox", { name: "Target" }), "2");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The change could not be sent.",
    );
  });
});

describe("adding an objective", () => {
  const goalOptions = () =>
    [
      ...screen
        .getByRole("combobox", { name: "Goal" })
        .querySelectorAll("option"),
    ].map((option) => [option.value, option.textContent]);

  const openForm = async (search = "?add=objective") => {
    const user = userEvent.setup();
    await open(search);
    await screen.findByRole("form", { name: "New objective" });
    await vi.waitFor(() => expect(goalOptions()).toHaveLength(2));
    return user;
  };

  it("opens a form with the name, the goal, the measure, its target and the workflow", async () => {
    await openForm();

    expect(
      screen.getByRole("heading", { name: "Add an objective", level: 1 }),
    ).toBeInTheDocument();
    expect(goalOptions()).toEqual([
      ["g1", "Suppliers post their prices"],
      ["g2", "Farmers buy alone or together"],
    ]);
    expect(screen.getByRole("textbox", { name: "Measure" })).toHaveAttribute(
      "placeholder",
      "What is counted",
    );
    expect(screen.getByRole("textbox", { name: "Target" })).toHaveAttribute(
      "placeholder",
      "A number and its unit",
    );
    expect(
      screen.getByRole("combobox", { name: "Workflow" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Responsible role" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Nothing is recorded until you press Save."),
    ).toBeInTheDocument();
  });

  it("asks for approval to add the objective with its workflow and its measure, then shows the list with a note", async () => {
    const user = await openForm();
    await vi.waitFor(() =>
      expect(
        screen
          .getByRole("combobox", { name: "Workflow" })
          .querySelectorAll("option"),
      ).toHaveLength(workflows.length),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Goal" }),
      "g2",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Record each farmer's payment",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Measure" }),
      "Farmers marked paid",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Target" }),
      "8 farmers",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Workflow" }),
      "w2",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Waiting for approval")).toHaveAttribute(
      "role",
      "status",
    );
    expect(
      await screen.findByRole("heading", { name: "Objectives", level: 1 }),
    ).toBeInTheDocument();
    expect(proposals()).toEqual([
      {
        kind: "agency_create_objective",
        summary:
          "Add the objective Record each farmer's payment, served by Cancel an order, measured by Farmers marked paid",
        payload: {
          goal_id: "g2",
          title: "Record each farmer's payment",
          description: "",
          workflow: {
            tool: "agency_link_workflow_objective",
            workflow_id: "w2",
          },
          measure: {
            tool: "agency_set_measure",
            name: "Farmers marked paid",
            target: "8 farmers",
          },
        },
      },
    ]);
  });

  it("leaves the measure out of the proposal when none is typed", async () => {
    const user = await openForm();
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Find a second buyer",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Waiting for approval");
    expect(proposals()[0].payload).toEqual({
      goal_id: "g1",
      title: "Find a second buyer",
      description: "",
      workflow: {
        tool: "agency_link_workflow_objective",
        workflow_id: "w1",
      },
    });
  });

  it("asks for the name before sending anything", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Required: Name",
    );
    expect(proposals()).toEqual([]);
  });

  it("asks for the target when a measure is typed without one, and sends nothing", async () => {
    const user = await openForm();
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Record each farmer's payment",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Measure" }),
      "Farmers marked paid",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Required: Target",
    );
    expect(proposals()).toEqual([]);
  });

  it("returns to the list when Cancel is pressed", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("heading", { name: "Objectives", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "New objective" }),
    ).not.toBeInTheDocument();
  });
});
