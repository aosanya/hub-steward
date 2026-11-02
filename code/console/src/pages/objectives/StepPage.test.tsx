import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { ObjectivesView } from "../views/ObjectivesView";

vi.mock("../../data/features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

vi.mock("../../wakala/mcp");

const step = {
  id: "i1",
  code: "WI-4",
  title: "Start the order from a posted bulk price",
  workflow_id: "w1",
};

const roles = [
  { id: "r1", name: "Coordinator", kind: "human" },
  { id: "r2", name: "Farmers' agent", kind: "ai" },
  { id: "r3", name: "Supplier", kind: "human" },
];

const assignments = [
  { role_id: "r1", label: "accountable" },
  { role_id: "r1", label: "responsible" },
  { role_id: "r2", label: "consulted" },
  { role_id: "r3", label: "informed" },
  { role_id: "r3", label: "consulted" },
];

const objectives = [
  { id: "o3", code: "O-3", title: "Farmers buy together" },
  { id: "o9", code: "O-9", title: "Record each payment" },
  { id: "o1", code: "O-1", title: "Suppliers post prices" },
];

const replies = (more: Record<string, unknown> = {}) => ({
  agency_get_work_item: step,
  agency_get_workflow: { id: "w1", code: "W-1", name: "Group order" },
  agency_list_workflow_objectives: {
    items: [
      { workflow_id: "w1", objective_id: "o3" },
      { workflow_id: "w1", objective_id: "o9" },
    ],
  },
  agency_list_objectives: { items: objectives },
  agency_list_roles: { items: roles },
  agency_list_role_assignments_for_work_item: { items: assignments },
  ...more,
});

const open = (more: Record<string, unknown> = {}) => {
  answerWith(replies(more));
  renderPage(<ObjectivesView />, "objectives", "?step=i1");
};

const rows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("one step", () => {
  it("is titled with the step's code and names the step, its workflow and the objectives that workflow serves", async () => {
    open();

    expect(
      await screen.findByRole("heading", { name: "Step WI-4", level: 1 }),
    ).toBeInTheDocument();
    const card = (
      await screen.findByRole("heading", {
        name: "Start the order from a posted bulk price",
        level: 2,
      })
    ).closest("section") as HTMLElement;
    expect(
      await within(card).findByRole("link", { name: "Group order" }),
    ).toHaveAttribute("href", "/h/h1/workflows?open=w1");
    expect(within(card).getByRole("link", { name: "O-3" })).toHaveAttribute(
      "href",
      "/h/h1/objectives?objective=o3",
    );
    expect(within(card).getByRole("link", { name: "O-9" })).toBeInTheDocument();
    expect(
      within(card).queryByRole("link", { name: "O-1" }),
    ).not.toBeInTheDocument();
  });

  it("tabulates each role with a mark under R, A, C or I, a role holding two labels once, and tells an agent from a person", async () => {
    open();

    const table = await screen.findByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Role", "R", "A", "C", "I"]);
    expect(rows(table)).toEqual([
      ["CCoordinatorHuman", "Responsible", "Accountable", "", ""],
      ["Farmers' agentAI role", "", "", "Consulted", ""],
      ["SSupplierHuman", "", "", "Consulted", "Informed"],
    ]);
    expect(
      within(table).getByRole("link", { name: "Supplier" }),
    ).toHaveAttribute("href", "/h/h1/roles");
  });

  it("reads the step by its id alone and its roles from the working draft", async () => {
    open();
    await screen.findByRole("table");

    expect(callsOf("agency_get_work_item")).toEqual([{ work_item_id: "i1" }]);
    expect(callsOf("agency_get_workflow")).toEqual([{ workflow_id: "w1" }]);
    expect(callsOf("agency_list_workflow_objectives")).toEqual([
      { workflow_id: "w1" },
    ]);
    expect(callsOf("agency_list_role_assignments_for_work_item")).toEqual([
      { work_item_id: "i1" },
    ]);
  });

  it("says no role is on the step when none is labelled", async () => {
    open({ agency_list_role_assignments_for_work_item: { items: [] } });

    expect(
      await screen.findByText("No roles on this step yet."),
    ).toBeInTheDocument();
  });

  it("says the page could not be loaded when the step cannot be read", async () => {
    open({
      agency_get_work_item: () => {
        throw new Error("gone");
      },
    });

    expect(
      await screen.findByText("The page could not be loaded."),
    ).toHaveClass("error");
  });

  it("draws nothing while the step is read and announces the failure only once the read has failed", async () => {
    open({
      agency_get_work_item: () => {
        throw new Error("gone");
      },
    });

    expect(screen.queryByText("The page could not be loaded.")).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
  });
});
