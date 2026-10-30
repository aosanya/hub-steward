import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { ObjectivesView } from "./ObjectivesView";

vi.mock("../../wakala/mcp");

const objective = {
  id: "o1",
  code: "O-1",
  title: "Sell produce",
  description: "",
  goal_id: "g1",
};

const show = (search = "") =>
  renderPage(<ObjectivesView />, "objectives", search);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  answerWith({
    agency_list_goals: { items: [{ id: "g1", code: "G-1", title: "Markets" }] },
    agency_list_objectives: { items: [objective] },
    agency_get_goal: { id: "g1", code: "G-1", title: "Markets" },
    agency_get_objective: objective,
    agency_list_roles: { items: [] },
    agency_list_role_assignments_for_work_item: { items: [] },
    agency_list_workflow_objectives: { items: [] },
    agency_list_workflows: { items: [] },
    agency_list_work_items: { items: [] },
    agency_list_measures: {
      items: [{ id: "m1", objective_id: "o1", name: "Price", target: "10" }],
    },
  });
});

describe("the Objectives pages while measures are off", () => {
  it("shows no measure on the list and never reads them", async () => {
    show();

    await screen.findByText(/Sell produce/);
    expect(screen.queryByText("Measure")).not.toBeInTheDocument();
    expect(callsOf("agency_list_measures")).toHaveLength(0);
  });

  it("shows no measure card on one objective", async () => {
    show("?objective=o1");

    await waitFor(() =>
      expect(screen.getAllByText(/Sell produce/).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText("Measure")).not.toBeInTheDocument();
    expect(callsOf("agency_list_measures")).toHaveLength(0);
  });

  it("leaves the measure and target out of the Add an objective form", async () => {
    show("?add=objective");

    await screen.findByLabelText("Name");
    expect(screen.queryByLabelText("Measure")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Target")).not.toBeInTheDocument();
  });
});
