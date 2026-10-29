import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { WorkflowsView } from "./WorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const step = (id: string, workflow: string, objective: string, title: string, more: Record<string, unknown> = {}) => ({
  id,
  workflow_id: workflow,
  objective_id: objective,
  title,
  ...more,
});

const hubWithWorkflows = {
  agency_list_workflows: {
    items: [
      { id: "w1", code: "W-1", name: "Group order", description: "Farmers buy together in a group order" },
      { id: "w2", code: "W-2", name: "Hire it", description: "" },
    ],
  },
  agency_get_workflow: (args: Record<string, unknown>) =>
    args.workflow_id === "w2"
      ? { id: "w2", code: "W-2", name: "Hire it" }
      : { id: "w1", code: "W-1", name: "Group order", description: "Farmers buy together in a group order", version: 2, orders_under_way: 1, order_versions: [1] },
  agency_list_work_items: {
    items: [
      step("i1", "w1", "o1", "Start", {
        ordinality: 1,
        description: "The coordinator starts the order",
        kind: "fill_form",
        role_id: "r1",
        form_name: "Group order form",
        questions: [{ prompt: "Select the supplier", answer_type: "single_choice", options_from: "Supplier" }, { prompt: "Enter the bulk price" }],
      }),
      step("i2", "w1", "o1", "Send the invitation", {
        ordinality: 2,
        kind: "send_form",
        recipient_role_id: "r2",
        form_name: "Invitation",
        questions: [{ prompt: "Join this order?" }],
      }),
      step("i3", "w1", "o2", "Answer", { ordinality: 3, kind: "yes_no", role_id: "r2", sent_step_id: "i2" }),
      step("i4", "w2", "o3", "Ask the shops"),
    ],
  },
  agency_list_pickers: {
    actors: [
      { id: "r1", name: "Group coordinator", kind: "role" },
      { id: "r2", name: "Farmer", kind: "role" },
    ],
    answer_types: ["free_text"],
  },
  agency_list_records: { items: [{ id: "rec1", workflow_id: "w1", name: "Payments" }] },
  taskmanager_workflow_run_list_under_way: { items: [{ id: "run1", name: "Order 1", workflow_code: "W-1", workflow_version: 1 }] },
  agency_list_workflow_objectives: (args: Record<string, unknown>) => ({
    items: [
      { id: "l1", workflow_id: "w1", objective_id: "o1" },
      { id: "l2", workflow_id: "w1", objective_id: "o2" },
      { id: "l3", workflow_id: "w2", objective_id: "o3" },
    ].filter((link) => !args.workflow_id || link.workflow_id === args.workflow_id),
  }),
  agency_list_objectives: {
    items: [
      { id: "o1", code: "O-1", title: "Gather the needs" },
      { id: "o2", code: "O-2", title: "Get the supplier's answer" },
      { id: "o3", code: "O-3", title: "Find a buyer" },
    ],
  },
};

const showWorkflows = (replies: Parameters<typeof answering>[0] = hubWithWorkflows, search = "") => {
  answering(replies);
  return renderView("workflows", WorkflowsView, search);
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

describe("the Workflows page", () => {
  it("is titled Workflows and offers Add a workflow and Add a cancel workflow", async () => {
    showWorkflows();

    expect(await screen.findByRole("heading", { level: 1, name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a workflow" })).toHaveAttribute("href", "/h/h1/workflow-edit/new/workflow");
    expect(screen.getByRole("link", { name: "Add a cancel workflow" })).toHaveAttribute("href", "/h/h1/workflow-edit/new/workflow?cancel=1");
  });

  it("shows every workflow as a card with its name, what it is for, its code and its step count", async () => {
    showWorkflows();

    await screen.findByText("Group order");

    expect(cards()).toHaveLength(2);
    const first = within(cards()[0]);
    expect(first.getByRole("link", { name: "Group order" })).toHaveAttribute("href", "/h/h1/workflows?open=w1");
    expect(first.getByText("Farmers buy together in a group order")).toBeInTheDocument();
    expect(first.getByText("W-1")).toHaveClass("tag", "mute");
    expect(first.getByText("Steps").nextElementSibling).toHaveTextContent("3");
    expect(within(cards()[1]).getByText("Steps").nextElementSibling).toHaveTextContent("1");
  });

  it("names the objectives linked to the workflow by their codes, linking to Goals", async () => {
    showWorkflows();

    await screen.findByText("Group order");

    const objectives = within(cards()[0]).getByText("Objectives").nextElementSibling as HTMLElement;
    expect(
      within(objectives)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["O-1", "O-2"]);
    expect(within(objectives).getAllByRole("link")[0]).toHaveAttribute("href", "/h/h1/goals");
  });

  it("lists the workflows in name order", async () => {
    showWorkflows({
      ...hubWithWorkflows,
      agency_list_workflows: { items: [{ id: "w2", code: "W-2", name: "Zeta", description: "" }, { id: "w1", code: "W-1", name: "Alpha", description: "" }] },
    });

    await screen.findByText("Alpha");

    expect(cards().map((card) => card.querySelector(".cell-name")?.textContent)).toEqual(["Alpha", "Zeta"]);
  });

  it("filters the workflows by what is typed in the search box", async () => {
    showWorkflows();

    await screen.findByText("Group order");
    await userEvent.type(screen.getByRole("searchbox"), "hire");

    expect(cards().map((card) => card.querySelector(".cell-name")?.textContent)).toEqual(["Hire it"]);
  });

  it("shows the title of each linked objective beside its code", async () => {
    showWorkflows();

    await screen.findByText("Group order");

    const objectives = within(cards()[0]).getByText("Objectives").nextElementSibling as HTMLElement;
    expect(objectives).toHaveTextContent("O-1Gather the needsO-2Get the supplier's answer");
  });

  it("shows the objective ids when their codes cannot be read", async () => {
    showWorkflows({ ...hubWithWorkflows, agency_list_objectives: new McpError("agency_list_objectives: down") });

    await screen.findByText("Group order");

    const objectives = within(cards()[1]).getByText("Objectives").nextElementSibling as HTMLElement;
    expect(within(objectives).getByRole("link")).toHaveTextContent("o3");
  });

  it("says a workflow with no linked objective cannot be published until it has one", async () => {
    showWorkflows({ ...hubWithWorkflows, agency_list_workflow_objectives: { items: [] }, agency_list_work_items: { items: [] } });

    await screen.findByText("Group order");

    expect(within(cards()[0]).getByText("Objectives").nextElementSibling).toHaveTextContent("No objective yet. It cannot be published until it has one.");
    expect(within(cards()[0]).getByText("Steps").nextElementSibling).toHaveTextContent("0");
  });

  it("says there is nothing yet and keeps the title and the add buttons when the agency has no workflow", async () => {
    showWorkflows({});

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a workflow" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a cancel workflow" })).toBeInTheDocument();
  });

  it("says the page could not be loaded in the error style when the workflows cannot be read", async () => {
    showWorkflows({ ...hubWithWorkflows, agency_list_workflows: new McpError("agency_list_workflows: down") });

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("link", { name: "Add a workflow" })).toBeInTheDocument();
  });
});

describe("one workflow open", () => {
  it("is titled by the workflow and shows a Workflow card with its objectives and no boxed description", async () => {
    showWorkflows(hubWithWorkflows, "?open=w1");

    expect(await screen.findByRole("heading", { level: 1, name: "Group order" })).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "Workflow" }).closest("section") as HTMLElement;
    expect(within(card).queryByText("Farmers buy together in a group order")).not.toBeInTheDocument();
    expect(within(within(card).getByText("Objectives").nextElementSibling as HTMLElement).getAllByRole("link").map((link) => link.textContent)).toEqual(["O-1", "O-2"]);
  });

  it("shows each step as a numbered card in the order served, with its kind, actor, action and questions", async () => {
    showWorkflows(hubWithWorkflows, "?open=w1");

    const first = (await screen.findByRole("heading", { name: "1 · Start" })).closest("section") as HTMLElement;

    expect(within(first).getByText("Description").nextElementSibling).toHaveTextContent("The coordinator starts the order");
    expect(within(first).getByText("Kind").nextElementSibling).toHaveTextContent("Fill a form");
    expect(within(first).getByText("Actor").nextElementSibling).toHaveTextContent("Group coordinator");
    expect(within(first).getByText("Action").nextElementSibling).toHaveTextContent("Fills the Group order form");
    expect(within(first).getByText("Questions").nextElementSibling).toHaveTextContent("Select the supplier (Supplier), Enter the bulk price");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Workflow",
      "Steps",
      "1 · Start",
      "2 · Send the invitation",
      "3 · Answer",
    ]);
  });

  it("shows who a form is sent to and which sent form a yes or no answers", async () => {
    showWorkflows(hubWithWorkflows, "?open=w1");

    const second = (await screen.findByRole("heading", { name: "2 · Send the invitation" })).closest("section") as HTMLElement;
    const third = screen.getByRole("heading", { name: "3 · Answer" }).closest("section") as HTMLElement;

    expect(within(second).getByText("Sends to").nextElementSibling).toHaveTextContent("Farmer");
    expect(within(second).getByText("Description").nextElementSibling).toHaveTextContent("—");
    expect(within(third).getByText("Answers the form sent in").nextElementSibling).toHaveTextContent("Send the invitation");
  });

  it("shows the orders under way and the records on the workflow card", async () => {
    showWorkflows(hubWithWorkflows, "?open=w1");

    const card = (await screen.findByRole("heading", { name: "Workflow" })).closest("section") as HTMLElement;

    await within(card).findByText("1, started on version 1, finishes on version 1");
    expect(within(card).getByText("Records").nextElementSibling).toHaveTextContent("Payments");
  });

  it("asks for that workflow by id", async () => {
    showWorkflows(hubWithWorkflows, "?open=w1");

    await screen.findByRole("heading", { name: "Workflow" });

    expect(new Set(callsTo("agency_get_workflow").map((args) => args.workflow_id))).toEqual(new Set(["w1"]));
  });

  it("says a workflow with no step has nothing here and offers Edit", async () => {
    showWorkflows({ ...hubWithWorkflows, agency_list_work_items: { items: [] } }, "?open=w2");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/h/h1/workflow-edit/w2/workflow");
    expect(screen.queryByRole("link", { name: "Add a workflow" })).not.toBeInTheDocument();
  });

  it("says there is nothing here for a workflow the agency does not have", async () => {
    showWorkflows({ ...hubWithWorkflows, agency_get_workflow: null }, "?open=nobody");

    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Workflows" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("says the page could not be loaded when the workflow cannot be read", async () => {
    showWorkflows({ ...hubWithWorkflows, agency_get_workflow: new McpError("agency_get_workflow: down") }, "?open=w1");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
  });

  describe("the Workflows page, in use and version", () => {
    const inUse = {
      agency_list_workflows: {
        items: [
          { id: "w1", code: "W-1", name: "Group order", description: "", in_use: true, orders_under_way: 2, order_versions: [1, 2], version: 2 },
          { id: "w2", code: "W-2", name: "Hire it", description: "", in_use: false, orders_under_way: 0, version: 0 },
        ],
      },
      agency_list_default_workflows: {
        items: [{ code: "cancel", name: "Cancel", description: "At once", default: true, in_use: false, orders_under_way: 0, version: 0 }],
      },
    };

    it("marks the workflow an order is under way on as In use and the other one not", async () => {
      showWorkflows({ ...hubWithWorkflows, ...inUse });

      await screen.findByText("Group order");

      expect(within(cards()[0]).getByText("In use")).toHaveClass("tag", "ok");
      expect(within(cards()[1]).queryByText("In use")).not.toBeInTheDocument();
    });

    it("shows the version published on each card, and a dash before the first publish", async () => {
      showWorkflows({ ...hubWithWorkflows, ...inUse });

      await screen.findByText("Group order");

      expect(within(cards()[0]).getByText("Version").nextElementSibling).toHaveTextContent("2");
      expect(within(cards()[1]).getByText("Version").nextElementSibling).toHaveTextContent("—");
    });

    it("lists the built-in Cancel last, marked as a default, with Edit that asks for a cancel workflow and no Remove", async () => {
      showWorkflows({ ...hubWithWorkflows, ...inUse });

      await screen.findByText("Group order");

      expect(cards()).toHaveLength(3);
      const cancel = within(cards()[2]);
      expect(cancel.getByText("Cancel")).toBeInTheDocument();
      expect(cancel.getByText("At once")).toBeInTheDocument();
      expect(cancel.getByText("Built-in default")).toHaveClass("tag");
      expect(cancel.queryByRole("link", { name: "Cancel" })).not.toBeInTheDocument();
      await userEvent.setup().click(cancel.getByRole("button", { name: "Actions" }));
      expect(cancel.getByRole("menuitem", { name: "Edit" })).toHaveAttribute("href", "/h/h1/workflow-edit/new/workflow?cancel=1");
      expect(cancel.queryByRole("menuitem", { name: "Remove" })).not.toBeInTheDocument();
    });

    it("leaves the built-in Cancel out once the agency has a cancel workflow of its own", async () => {
      showWorkflows({
        ...hubWithWorkflows,
        ...inUse,
        agency_list_workflows: { items: [{ id: "w9", code: "cancel", name: "Cancel an order", description: "" }] },
      });

      await screen.findByText("Cancel an order");

      expect(cards()).toHaveLength(1);
      expect(screen.queryByText("Built-in default")).not.toBeInTheDocument();
    });

    it("still shows the agency's own workflows when the default list cannot be read", async () => {
      showWorkflows({ ...hubWithWorkflows, agency_list_default_workflows: new McpError("agency_list_default_workflows: down") });

      await screen.findByText("Group order");

      expect(cards()).toHaveLength(2);
    });

    it("names the roles that act in the workflow's steps in order, The agency for a step the agency takes", async () => {
      showWorkflows({ ...hubWithWorkflows, ...inUse });

      await screen.findByText("Group order");

      expect(within(cards()[0]).getByText("Roles").nextElementSibling).toHaveTextContent("Group coordinator, The agency, Farmer");
      expect(within(cards()[1]).getByText("Roles").nextElementSibling).toHaveTextContent("The agency");
    });

    it("shows a dash for the roles of a workflow with no steps, and when the roles cannot be read", async () => {
      showWorkflows({ ...hubWithWorkflows, agency_list_work_items: { items: [] }, agency_list_pickers: new McpError("agency_list_pickers: down") });

      await screen.findByText("Group order");

      expect(within(cards()[0]).getByText("Roles").nextElementSibling).toHaveTextContent("—");
    });

    it("says in one line under the orders that a publish reaches members within 30 seconds, on the landing only", async () => {
      showWorkflows({ ...hubWithWorkflows, ...inUse });

      expect(await screen.findByText("A publish reaches members within 30 seconds.")).toBeInTheDocument();
    });

    it("leaves that line off a workflow's own page", async () => {
      showWorkflows(hubWithWorkflows, "?open=w1");

      await screen.findByText("1 · Start");

      expect(screen.queryByText("A publish reaches members within 30 seconds.")).not.toBeInTheDocument();
    });

    it("shows the version published on the workflow's page", async () => {
      showWorkflows({ ...hubWithWorkflows, agency_get_workflow: { id: "w1", code: "W-1", name: "Group order", description: "x", version: 3 } }, "?open=w1");

      await screen.findByText("1 · Start");

      expect(screen.getByText("Version").nextElementSibling).toHaveTextContent("3");
    });
  });
});
