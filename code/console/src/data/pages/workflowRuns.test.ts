import { beforeEach, expect, test, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { ordersClosed, ordersWithClosed, stopOrder } from "./workflowRuns";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

const answerWith = (replies: Record<string, unknown>) =>
  call.mockImplementation((async (_hub: string, tool: string) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return reply === undefined ? { items: [] } : reply;
  }) as typeof callTool);

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool);

const going = { id: "r1", name: "run-one", workflow_code: "pick-ask", workflow_version: 2, status: "in_progress" };

const closed = {
  id: "r2",
  name: "run-two",
  workflow_code: "pick-ask",
  workflow_version: 1,
  status: "closed",
  started_at: "2026-10-29T08:30:00Z",
  completed_at: "2026-10-29T09:00:00Z",
  step_due_at: "2026-10-29T09:00:00Z",
  cancel_run_id: "run-two-closed",
};

beforeEach(() => call.mockReset());

test("the closed runs are read from the closed list, each with its status and cancel run", async () => {
  answerWith({ taskmanager_workflow_run_list_closed: { items: [closed] } });

  const orders = await ordersClosed("h1");

  expect(callsTo("taskmanager_workflow_run_list_closed")).toHaveLength(1);
  expect(orders).toEqual([
    {
      id: "r2",
      name: "run-two",
      workflowCode: "pick-ask",
      version: 1,
      startedAt: "2026-10-29T08:30:00Z",
      status: "closed",
      stepDueAt: "2026-10-29T09:00:00Z",
      cancelRunId: "run-two-closed",
    },
  ]);
});

test("the orders are the ones under way followed by the closed ones", async () => {
  answerWith({
    taskmanager_workflow_run_list_under_way: { items: [going] },
    taskmanager_workflow_run_list_closed: { items: [closed] },
  });

  const orders = await ordersWithClosed("h1");

  expect(orders.map((order) => [order.id, order.status])).toEqual([
    ["r1", "in_progress"],
    ["r2", "closed"],
  ]);
});

test("a closed list that cannot be read reads as no closed runs", async () => {
  answerWith({
    taskmanager_workflow_run_list_under_way: { items: [going] },
    taskmanager_workflow_run_list_closed: new McpError("unknown tool taskmanager_workflow_run_list_closed"),
  });

  expect(await ordersClosed("h1")).toEqual([]);
  expect((await ordersWithClosed("h1")).map((order) => order.id)).toEqual(["r1"]);
});

test("a list under way that cannot be read still fails the orders", async () => {
  answerWith({
    taskmanager_workflow_run_list_under_way: new McpError("down"),
    taskmanager_workflow_run_list_closed: { items: [closed] },
  });

  await expect(ordersWithClosed("h1")).rejects.toThrow("down");
});

test("stopping an order sends the run alone when no version is given", async () => {
  answerWith({ taskmanager_workflow_run_stop: { stopped: { id: "r1" } } });

  await stopOrder("h1", "r1");

  expect(callsTo("taskmanager_workflow_run_stop").map(([, , args]) => args)).toEqual([{ runID: "r1" }]);
});

test("stopping an order with a version sends restart_on_version with the run", async () => {
  answerWith({ taskmanager_workflow_run_stop: { stopped: { id: "r1" } } });

  await stopOrder("h1", "r1", 2);

  expect(callsTo("taskmanager_workflow_run_stop").map(([, , args]) => args)).toEqual([{ runID: "r1", restart_on_version: 2 }]);
});
