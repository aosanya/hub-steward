import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, renderView } from "../spec/usersTesting";
import { WorkflowsView } from "../views/WorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const steps = [
  {
    id: "s1",
    workflow_id: "w1",
    ordinality: 1,
    objective_id: "o1",
    title: "Answered",
    kind: "yes_no",
    role_id: "r2",
    time_limit_minutes: 2880,
    cancel_workflow_id: "w2",
  },
  {
    id: "s2",
    workflow_id: "w1",
    ordinality: 2,
    objective_id: "o1",
    title: "Quick",
    kind: "fill_form",
    role_id: "r2",
    time_limit_minutes: 1,
    cancel_workflow_id: "w2",
  },
  {
    id: "s3",
    workflow_id: "w1",
    ordinality: 3,
    objective_id: "o1",
    title: "Thank you",
    kind: "notify",
    form_name: "Thanks",
  },
];

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  answering({
    agency_get_workflow: {
      id: "w1",
      code: "group-order",
      name: "Group order",
      description: "",
    },
    agency_list_workflows: {
      items: [
        { id: "w1", code: "group-order", name: "Group order" },
        { id: "w2", name: "Cancel" },
      ],
    },
    agency_list_work_items: { items: steps },
    agency_list_pickers: {
      actors: [{ id: "r2", name: "Supplier", kind: "role" }],
      answer_types: [],
    },
  });
});

describe("A workflow's detail", () => {
  it("says the time limit and the cancel workflow on the step cards that have one", async () => {
    renderView("workflows", WorkflowsView, "?open=w1");

    const first = within((await screen.findByRole("heading", { name: "1 · Answered" })).closest("section") as HTMLElement);
    expect(first.getByText("Time limit")).toBeInTheDocument();
    expect(first.getByText("2,880 minutes, then Cancel runs")).toBeInTheDocument();
    const second = within(screen.getByRole("heading", { name: "2 · Quick" }).closest("section") as HTMLElement);
    expect(second.getByText("1 minute, then Cancel runs")).toBeInTheDocument();
  });

  it("leaves the line out of a step with no limit", async () => {
    renderView("workflows", WorkflowsView, "?open=w1");

    const third = within((await screen.findByRole("heading", { name: "3 · Thank you" })).closest("section") as HTMLElement);
    expect(third.queryByText("Time limit")).not.toBeInTheDocument();
  });
});
