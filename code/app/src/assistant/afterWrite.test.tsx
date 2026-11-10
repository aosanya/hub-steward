import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { askAssistant, offeredNames } from "./api";
import { moveTool } from "./confirm";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(offeredNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } })));
});

afterEach(() => forgetOpenAgency());

const issue = (id: string, title: string) => ({ id, title, status: "to-do" });

const script = (calls: { id: string; name: string; arguments: Record<string, unknown> }[], replies: Record<string, unknown>) => {
  let round = 0;
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
    if (name === "ai_chat_account") {
      round += 1;
      return round === 1 ? { message: { content: "", tool_calls: calls } } : { message: { content: "Done." } };
    }
    return replies[name] ?? { ok: true };
  });
};

const lookups = [
  { id: "a", name: "taskmanager_task_pending", arguments: { q: "walk-06 issue A" } },
  { id: "b", name: "taskmanager_backlog_list", arguments: {} },
];

const replies = {
  taskmanager_task_pending: { total: 2, items: [issue("t1", "walk-06 issue A"), issue("t2", "walk-06 issue AB")] },
  taskmanager_backlog_list: { items: [{ id: "b1", name: "Backlog" }] },
};

const moveCall = { id: "c", name: moveTool, arguments: { taskID: "t1", backlog: "b1", step: "Doing" } };

describe("the lists and cards after a write", () => {
  it("keeps the lists of a read-only answer", async () => {
    script(lookups, replies);
    const answer = await askAssistant("acc1", [{ role: "user", content: "what is pending for issue A" }], () => undefined, async () => true);
    expect(answer.lists.map((list) => list.title)).toEqual(["Pending walk-06 issue A issues", "Backlogs"]);
  });

  it("drops the lookups that only led to a confirmed write", async () => {
    script([...lookups, moveCall], replies);
    const answer = await askAssistant("acc1", [{ role: "user", content: "move issue A to Doing" }], () => undefined, async () => true);
    expect(mcp.callTool.mock.calls.filter((call) => call[1] === moveTool)).toHaveLength(1);
    expect(answer.lists).toEqual([]);
  });

  it("keeps the lookups when the person cancelled the write", async () => {
    script([...lookups, moveCall], replies);
    const answer = await askAssistant("acc1", [{ role: "user", content: "move issue A to Doing" }], () => undefined, async () => false);
    expect(answer.lists.map((list) => list.title)).toEqual(["Pending walk-06 issue A issues", "Backlogs"]);
  });

  it("ends the ask with the hub's refusal when the write itself failed", async () => {
    script([...lookups, moveCall], replies);
    mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
      if (name === "ai_chat_account") {
        const sent = args.messages as { role: string }[];
        return sent.some((message) => message.role === "tool") ? { message: { content: "It failed." } } : { message: { content: "", tool_calls: [...lookups, moveCall] } };
      }
      if (name === moveTool) throw new Error("refused");
      return (replies as Record<string, unknown>)[name] ?? { ok: true };
    });
    await expect(askAssistant("acc1", [{ role: "user", content: "move issue A to Doing" }], () => undefined, async () => true)).rejects.toThrow("refused");
  });
});
