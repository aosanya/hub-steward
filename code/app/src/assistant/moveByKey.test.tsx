import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { askAssistant, offeredNames } from "./api";
import type { BacklogsClient } from "../backlogs/api";
import { moveTool, nameWrite } from "./confirm";
import { pendingTool } from "./results";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(offeredNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } })));
});

afterEach(() => forgetOpenAgency());

const moveByKey = { id: "m", name: moveTool, arguments: { taskID: "DEV-066", backlog: "b1", step: "Doing" } };

const script = (extra: Record<string, unknown>) => {
  let round = 0;
  mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
    if (name === "ai_chat_account") {
      round += 1;
      const sent = args.messages as { role: string; content: string }[];
      return round === 1 ? { message: { content: "", tool_calls: [moveByKey] } } : { message: { content: sent[sent.length - 1].content } };
    }
    return name in extra ? extra[name] : { ok: true };
  });
};

const moveCalls = () => mcp.callTool.mock.calls.filter(([, name]) => name === moveTool);

describe("a move of an issue the model names by its key", () => {
  it("finds the issue by its key before the card and moves it by its id", async () => {
    script({ [pendingTool]: { items: [{ id: "uuid-66", title: "DEV-066 Fix the drift" }, { id: "uuid-660", title: "DEV-0660 Another" }] } });
    const confirm = vi.fn().mockResolvedValue(true);
    await askAssistant("acc1", [{ role: "user", content: "move DEV-066 to Doing" }], () => undefined, confirm);
    expect(confirm.mock.calls[0][0].arguments.taskID).toBe("uuid-66");
    expect(moveCalls().map(([, , args]) => args.taskID)).toEqual(["uuid-66"]);
  });

  it("takes the id from a list this answer has already read, without another lookup", async () => {
    let round = 0;
    mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
      if (name === "ai_chat_account") {
        round += 1;
        return round === 1
          ? { message: { content: "", tool_calls: [{ id: "a", name: "taskmanager_task_list", arguments: { q: "drift" } }, moveByKey] } }
          : { message: { content: "Moved." } };
      }
      if (name === "taskmanager_task_list") return { items: [{ id: "uuid-66", task_name: "DEV-066", title: "Fix the drift" }] };
      return { ok: true };
    });
    const confirm = vi.fn().mockResolvedValue(true);
    await askAssistant("acc1", [{ role: "user", content: "move DEV-066 to Doing" }], () => undefined, confirm);
    expect(confirm.mock.calls[0][0].arguments.taskID).toBe("uuid-66");
    expect(mcp.callTool.mock.calls.some(([, name]) => name === pendingTool)).toBe(false);
  });

  it("shows no card and moves nothing when no issue has that key", async () => {
    script({ [pendingTool]: { items: [{ id: "uuid-7", title: "DEV-070 Something else" }] } });
    const confirm = vi.fn().mockResolvedValue(true);
    const answer = await askAssistant("acc1", [{ role: "user", content: "move DEV-066 to Doing" }], () => undefined, confirm);
    expect(confirm).not.toHaveBeenCalled();
    expect(moveCalls()).toEqual([]);
    expect(answer.text).toContain("I could not find DEV-066.");
  });

  it("leaves the write to the hub when the lookup itself fails", async () => {
    script({});
    mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
      if (name === "ai_chat_account") return (args.messages as unknown[]).length < 3 ? { message: { content: "", tool_calls: [moveByKey] } } : { message: { content: "ok" } };
      if (name === pendingTool) throw new Error("down");
      return { ok: true };
    });
    const confirm = vi.fn().mockResolvedValue(true);
    await askAssistant("acc1", [{ role: "user", content: "move DEV-066 to Doing" }], () => undefined, confirm);
    expect(confirm.mock.calls[0][0].arguments.taskID).toBe("DEV-066");
  });

  it("reads an id the answer has not read, so the card can name the issue", async () => {
    let round = 0;
    mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
      if (name === "ai_chat_account") {
        round += 1;
        return round === 1 ? { message: { content: "", tool_calls: [{ id: "m", name: moveTool, arguments: { taskID: "fb3dd440-aaaa-bbbb", backlog: "backlog", step: "doing" } }] } } : { message: { content: "ok" } };
      }
      if (name === "taskmanager_task_read") return { id: "fb3dd440-aaaa-bbbb", task_name: "DEV-162", title: "Fix the drift" };
      return { ok: true };
    });
    const confirm = vi.fn().mockResolvedValue(true);
    await askAssistant("acc1", [{ role: "user", content: "move it to Doing" }], () => undefined, confirm);
    const [write, seen] = confirm.mock.calls[0];
    expect(write.arguments.taskID).toBe("fb3dd440-aaaa-bbbb");
    expect(seen.flatMap((list: { issues: { title: string }[] }) => list.issues.map((issue) => issue.title))).toContain("Fix the drift");
  });
});

describe("the card for a move by the default backlog name", () => {
  it("names the backlog by its name when the write carries the word 'backlog', and the step in its own spelling", async () => {
    const client: Pick<BacklogsClient, "backlogs" | "issue"> = {
      backlogs: vi.fn().mockResolvedValue([{ id: "b-uuid", name: "Backlog", steps: ["To do", "Doing"], issues: 3 }]),
      issue: vi.fn().mockRejectedValue(new Error("down")),
    };
    const names = await nameWrite({ tool: moveTool, arguments: { taskID: "fb3dd440", backlog: "backlog", step: "doing" } }, [{ issues: [{ id: "fb3dd440", title: "Fix the drift" }] }], client);
    expect(names).toEqual({ issue: "Fix the drift", backlog: "Backlog", step: "Doing" });
  });
});
