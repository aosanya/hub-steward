import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import {
  answerWith,
  callsOf,
  renderPage,
} from "../spec/profileTesting";
import { ObjectiveAdd } from "./ObjectiveAdd";

vi.mock("../../data/features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

vi.mock("../../wakala/mcp");

const goals = [
  { id: "g1", code: "G-1", title: "Suppliers post their prices" },
  { id: "g2", code: "G-2", title: "Farmers buy alone or together" },
];

const workflows = [
  { id: "w1", name: "Buy now" },
  { id: "w2", name: "Group order" },
];

const open = async (more: Record<string, unknown> = {}) => {
  answerWith({
    agency_list_goals: { items: goals },
    agency_list_objectives: { items: [] },
    agency_list_workflows: { items: workflows },
    agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
    agency_create_objective: { id: "o1" },
    agency_link_workflow_objective: {},
    agency_set_measure: {},
    ...more,
  });
  renderPage(<ObjectiveAdd hubId="h1" />, "objectives");
  await screen.findByRole("form", { name: "New objective" });
  await vi.waitFor(() =>
    expect(
      screen
        .getByRole("combobox", { name: "Workflow" })
        .querySelectorAll("option"),
    ).toHaveLength(workflows.length),
  );
  return userEvent.setup();
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the add-objective form", () => {
  it("offers the workflows of the agency in place of a responsible role", async () => {
    await open();

    expect(
      [
        ...screen
          .getByRole("combobox", { name: "Workflow" })
          .querySelectorAll("option"),
      ].map((option) => [option.value, option.textContent]),
    ).toEqual([
      ["w1", "Buy now"],
      ["w2", "Group order"],
    ]);
    expect(
      screen.queryByRole("combobox", { name: "Responsible role" }),
    ).not.toBeInTheDocument();
    expect(callsOf("agency_list_roles")).toEqual([]);
  });

  it("writes the objective to the draft linked to the chosen workflow and never sets a RACI", async () => {
    const user = await open();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Goal" }),
      "g2",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Record each farmer's payment",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Workflow" }),
      "w2",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(callsOf("agency_link_workflow_objective")).toHaveLength(1),
    );
    expect(callsOf("agency_create_objective")).toEqual([
      {
        draft_id: "d1",
        goal_id: "g2",
        title: "Record each farmer's payment",
        description: "",
      },
    ]);
    expect(callsOf("agency_link_workflow_objective")).toEqual([
      { draft_id: "d1", objective_id: "o1", workflow_id: "w2" },
    ]);
    expect(callsOf("agency_propose_write")).toEqual([]);
    expect(callsOf("agency_set_raci")).toEqual([]);
  });

  it("links the first workflow when none is picked and sets the measure on the new objective", async () => {
    const user = await open();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Sell more");
    await user.type(
      screen.getByRole("textbox", { name: "Measure" }),
      "Orders sold",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Target" }),
      "20 orders",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(callsOf("agency_set_measure")).toHaveLength(1));
    expect(callsOf("agency_link_workflow_objective")).toEqual([
      { draft_id: "d1", objective_id: "o1", workflow_id: "w1" },
    ]);
    expect(callsOf("agency_set_measure")).toEqual([
      { objective_id: "o1", name: "Orders sold", target: "20 orders" },
    ]);
  });

  it("asks for a workflow and sends nothing when the agency has none", async () => {
    const user = userEvent.setup();
    answerWith({
      agency_list_goals: { items: goals },
      agency_list_objectives: { items: [] },
      agency_list_workflows: { items: [] },
    });
    renderPage(<ObjectiveAdd hubId="h1" />, "objectives");
    await screen.findByRole("form", { name: "New objective" });
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Sell more");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Required: Workflow")).toBeInTheDocument();
    expect(callsOf("agency_create_objective")).toEqual([]);
  });
});
