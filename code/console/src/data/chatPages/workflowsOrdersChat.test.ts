import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../../wakala/mcp";
import type { Suggestion } from "../chatAnswer";
import { applySuggestion } from "../chatSuggestions";
import { showSuggestionsTool } from "../chatTools";
import { askModel, chatTool, type Turn } from "../modelChat";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  callTool: vi.fn(),
  listTools: vi.fn(),
}));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const underWay = "taskmanager_workflow_run_list_under_way";
const stop = "taskmanager_workflow_run_stop";

const tool = (name: string, properties: Record<string, unknown> = {}): ToolInfo => ({
  name,
  description: `about ${name}`,
  inputSchema: { type: "object", properties: { instance_id: { type: "string" }, ...properties } },
});

const asks = (name: string, args: unknown) => ({
  message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] },
});

const said = (content: string) => ({ message: { role: "assistant", content } });

const stopRunTwo: Suggestion = { title: "Stop run-two", detail: "", tool: stop, arguments: {}, then: [] };

const turns: Turn[] = [{ role: "user", content: "which orders are under way?" }];

const offeredNames = () => ((callToolMock.mock.calls.find((call) => call[1] === chatTool)![2] as { tools: { name: string }[] }).tools).map((spec) => spec.name);

const converse = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    if (name === underWay) return { items: [{ id: "r2", name: "run-two", workflow_code: "group-order" }] };
    return { items: [] };
  });
};

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([
    tool("agency_get_agency"),
    tool("agency_list_workflows"),
    tool(underWay),
    tool("taskmanager_workflow_run_list_closed"),
    tool(stop, { runID: { type: "string" }, reason: { type: "string" }, restart_on_version: { type: "number" } }),
  ]);
});

describe("the chat on the Workflows page", () => {
  it("is offered the lists of orders but not the stop, which can only ride on a suggestion", async () => {
    converse([said("ok")]);

    await askModel("h1", "a1", turns, "workflows");

    expect(offeredNames()).toEqual(expect.arrayContaining([underWay, "taskmanager_workflow_run_list_closed", showSuggestionsTool]));
    expect(offeredNames()).not.toContain(stop);
  });

  it("lists the orders under way by calling the task manager", async () => {
    converse([asks(underWay, {}), said("run-two is under way")]);

    const reply = await askModel("h1", "a1", turns, "workflows");

    expect(callToolMock).toHaveBeenCalledWith("h1", underWay, expect.objectContaining({ instance_id: "h1" }));
    expect(reply.text).toBe("run-two is under way");
  });

  it("stops an order and starts it again on a version when the manager applies the suggestion", async () => {
    callToolMock.mockResolvedValue({ stopped: { id: "r2" } });

    await applySuggestion("h1", "workflows", { ...stopRunTwo, arguments: { runID: "r2", restart_on_version: 2 } });

    expect(callToolMock).toHaveBeenCalledWith("h1", stop, { runID: "r2", restart_on_version: 2, instance_id: "h1" });
  });

  it("does not stop an order on a page whose chat has no stop to suggest", async () => {
    await expect(applySuggestion("h1", "test", { ...stopRunTwo, arguments: { runID: "r2" } })).rejects.toThrow("this suggestion has no change to apply");

    expect(callToolMock).not.toHaveBeenCalled();
  });
});
