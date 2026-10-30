import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, renderView } from "../spec/usersTesting";
import { WorkflowsView } from "../views/WorkflowsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const detail = (fields: Record<string, unknown>) => {
  vi.mocked(callTool).mockReset();
  answering({
    agency_get_workflow: { id: "w1", code: "group-order", name: "Group order", description: "", ...fields },
    agency_list_workflows: { items: [{ id: "w1", code: "group-order", name: "Group order" }] },
    agency_list_work_items: { items: [] },
    agency_list_pickers: { actors: [], answer_types: [] },
    taskmanager_workflow_run_list_under_way: { items: [] },
  });
  renderView("workflows", WorkflowsView, "?open=w1");
};

const ordersLine = async () => (await screen.findByText("Orders under way")).nextElementSibling;

beforeEach(() => vi.mocked(callTool).mockReset());

describe("A workflow's Orders under way line", () => {
  it("reads like the drawing: the count, the version they started on and the version they finish on", async () => {
    detail({ version: 2, orders_under_way: 1, order_versions: [1] });

    expect(await ordersLine()).toHaveTextContent("1, started on version 1, finishes on version 1");
  });

  it("lists every version the orders are on while a later one is published", async () => {
    detail({ version: 3, orders_under_way: 4, order_versions: [1, 2] });

    expect(await ordersLine()).toHaveTextContent("4, started on version 1 and 2, finishes on version 1 and 2");
  });

  it("says no orders are under way when the workflow has none", async () => {
    detail({ version: 2, orders_under_way: 0 });

    expect(await ordersLine()).toHaveTextContent("No orders are under way.");
  });
});
