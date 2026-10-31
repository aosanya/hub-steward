import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, proposals, renderView } from "../spec/usersTesting";
import { WorkflowsView } from "../views/WorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const objectives = [
  { id: "o1", code: "O-1", title: "Gather" },
  { id: "o2", code: "O-2", title: "Fund" },
];

const answer = (links: Record<string, unknown>[], extra: Record<string, unknown> = {}) => {
  vi.mocked(callTool).mockReset();
  answering({
    agency_get_workflow: { id: "w1", code: "group-order", name: "Group order", description: "" },
    agency_list_workflows: { items: [{ id: "w1", code: "group-order", name: "Group order" }] },
    agency_list_work_items: { items: [] },
    agency_list_workflow_objectives: { items: links },
    agency_list_objectives: { items: objectives },
    agency_list_pickers: { actors: [], answer_types: [] },
    agency_propose_write: {},
    ...extra,
  });
};

const objectivesLine = async () => (await screen.findByText("Objectives")).nextElementSibling as HTMLElement;

beforeEach(() => vi.mocked(callTool).mockReset());

describe("A workflow's objectives", () => {
  it("lists each linked objective with its title on the detail page", async () => {
    answer([{ id: "l1", workflow_id: "w1", objective_id: "o1" }]);
    renderView("workflows", WorkflowsView, "?open=w1");

    const line = within(await objectivesLine());
    expect(await line.findByText("O-1")).toBeInTheDocument();
    expect(line.getByText("Gather")).toBeInTheDocument();
  });

  it("puts the title under the code, in one stack, not beside it", async () => {
    answer([{ id: "l1", workflow_id: "w1", objective_id: "o1" }]);
    renderView("workflows", WorkflowsView, "?open=w1");

    const line = within(await objectivesLine());
    const code = await line.findByText("O-1");
    expect(code.parentElement).toHaveClass("stack");
    expect(code.nextElementSibling).toBe(line.getByText("Gather"));
  });

  it("draws the workflow card without a boxed description", async () => {
    answer([], { agency_get_workflow: { id: "w1", code: "group-order", name: "Group order", description: "Farmers buy together" } });
    const { container } = renderView("workflows", WorkflowsView, "?open=w1");

    await objectivesLine();

    expect(screen.queryByText("Farmers buy together")).not.toBeInTheDocument();
    expect(container.querySelector(".note")).toBeNull();
  });

  it("says plainly that a workflow with no objective cannot be published, on the page and on its card", async () => {
    answer([]);
    renderView("workflows", WorkflowsView, "?open=w1");
    expect(await within(await objectivesLine()).findByText("No objective yet. It cannot be published until it has one.")).toBeInTheDocument();
  });

  it("says the same on the list card", async () => {
    answer([]);
    renderView("workflows", WorkflowsView);
    expect(await screen.findByText("No objective yet. It cannot be published until it has one.")).toBeInTheDocument();
  });

  it("proposes unlinking one objective and tells the owner it waits for approval", async () => {
    answer([{ id: "l1", workflow_id: "w1", objective_id: "o1" }]);
    renderView("workflows", WorkflowsView, "?open=w1");

    fireEvent.click(await screen.findByRole("button", { name: "Unlink" }));

    await waitFor(() =>
      expect(proposals()).toEqual([
        {
          kind: "agency_delete_workflow_objective",
          summary: "Unlink the objective O-1 Gather from the workflow Group order",
          payload: { workflow_objective_id: "l1" },
        },
      ]),
    );
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("offers only the objectives not yet linked and proposes the link", async () => {
    answer([{ id: "l1", workflow_id: "w1", objective_id: "o1" }]);
    renderView("workflows", WorkflowsView, "?open=w1");

    fireEvent.click(await screen.findByRole("button", { name: "Link an objective" }));
    const choose = await screen.findByRole("combobox");
    expect(within(choose).getAllByRole("option").map((option) => option.textContent)).toEqual(["O-2 Fund"]);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(proposals()).toEqual([
        {
          kind: "agency_link_workflow_objective",
          summary: "Link the objective O-2 Fund to the workflow Group order",
          payload: { workflow_id: "w1", objective_id: "o2" },
        },
      ]),
    );
  });

  it("offers no link button once every objective is linked", async () => {
    answer([
      { id: "l1", workflow_id: "w1", objective_id: "o1" },
      { id: "l2", workflow_id: "w1", objective_id: "o2" },
    ]);
    renderView("workflows", WorkflowsView, "?open=w1");

    await screen.findByText("O-2");
    expect(screen.queryByRole("button", { name: "Link an objective" })).not.toBeInTheDocument();
  });
});
