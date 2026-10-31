import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import {
  answerWith,
  callsOf,
  proposals,
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
    agency_propose_write: { status: "pending" },
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

  it("proposes the objective linked to the chosen workflow and never sets a RACI", async () => {
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

    await vi.waitFor(() => expect(proposals()).toHaveLength(1));
    expect(proposals()).toEqual([
      {
        kind: "agency_create_objective",
        summary:
          "Add the objective Record each farmer's payment, served by Group order",
        payload: {
          goal_id: "g2",
          title: "Record each farmer's payment",
          description: "",
          workflow: {
            tool: "agency_link_workflow_objective",
            workflow_id: "w2",
          },
        },
      },
    ]);
    expect(JSON.stringify(proposals())).not.toContain("agency_set_raci");
  });

  it("links the first workflow when none is picked and carries the measure along", async () => {
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

    await vi.waitFor(() => expect(proposals()).toHaveLength(1));
    expect(proposals()).toEqual([
      {
        kind: "agency_create_objective",
        summary:
          "Add the objective Sell more, served by Buy now, measured by Orders sold",
        payload: {
          goal_id: "g1",
          title: "Sell more",
          description: "",
          workflow: {
            tool: "agency_link_workflow_objective",
            workflow_id: "w1",
          },
          measure: {
            tool: "agency_set_measure",
            name: "Orders sold",
            target: "20 orders",
          },
        },
      },
    ]);
  });

  it("asks for a workflow and sends nothing when the agency has none", async () => {
    const user = userEvent.setup();
    answerWith({
      agency_list_goals: { items: goals },
      agency_list_objectives: { items: [] },
      agency_list_workflows: { items: [] },
      agency_propose_write: { status: "pending" },
    });
    renderPage(<ObjectiveAdd hubId="h1" />, "objectives");
    await screen.findByRole("form", { name: "New objective" });
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Sell more");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Required: Workflow")).toBeInTheDocument();
    expect(callsOf("agency_propose_write")).toEqual([]);
  });
});
