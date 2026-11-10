import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { issueOf, type BacklogsClient } from "../backlogs/api";
import { askAssistant, offeredNames } from "./api";
import { moveTool, nameWrite, writeLines } from "./confirm";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(offeredNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } })));
});

afterEach(() => forgetOpenAgency());

const held = [{ issues: [{ id: "9f1c-uuid", key: "DEV-162", title: "Fix the drift" }] }];

const clientOf = (): Pick<BacklogsClient, "backlogs" | "issue"> => ({
  backlogs: vi.fn().mockResolvedValue([{ id: "b1", name: "Backlog", steps: ["To do", "Doing", "Waiting"], issues: 3 }]),
  issue: vi.fn().mockRejectedValue(new Error("not found")),
});

const write = (step: string) => ({ tool: moveTool, arguments: { taskID: "DEV-162", backlog: "b1", step } });

describe("the confirmation card with what the model really passes", () => {
  it("reads the issue by its key and the step in the backlog's own spelling", async () => {
    const names = await nameWrite(write("doing"), held, clientOf());
    expect(names).toEqual({ issue: "Fix the drift", backlog: "Backlog", step: "Doing" });
    expect(writeLines(write("doing"), names)).toEqual(['Move "Fix the drift" to step Doing of Backlog']);
  });

  it("matches a step written as its id", async () => {
    expect((await nameWrite(write("to-do"), held, clientOf())).step).toBe("To do");
  });

  it("keeps the step as asked when the backlog has no such step", async () => {
    const names = await nameWrite(write("reviewing"), held, clientOf());
    expect(names.step).toBeUndefined();
    expect(writeLines(write("reviewing"), names)[0]).toContain("step reviewing of Backlog");
  });

  it("falls back to the ids when the key is held nowhere and the read fails", async () => {
    expect(await nameWrite(write("doing"), [], clientOf())).toEqual({ backlog: "Backlog", step: "Doing" });
  });

  it("keeps an issue's key from the hub's task name", () => {
    expect(issueOf({ id: "9f1c-uuid", task_name: "DEV-162", title: "Fix the drift" }).key).toBe("DEV-162");
    expect(issueOf({ id: "t1", title: "No key here" })).not.toHaveProperty("key");
  });

  it("hands the confirmation the lists this very answer has read, so the key can be found", async () => {
    let round = 0;
    mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
      if (name === "ai_chat_account") {
        round += 1;
        if (round === 1) return { message: { content: "", tool_calls: [{ id: "a", name: "taskmanager_task_list", arguments: { q: "drift" } }, { id: "b", name: moveTool, arguments: write("doing").arguments }] } };
        return { message: { content: "Moved." } };
      }
      if (name === "taskmanager_task_list") return { items: [{ id: "9f1c-uuid", task_name: "DEV-162", title: "Fix the drift" }] };
      return { ok: true };
    });
    const confirm = vi.fn().mockResolvedValue(true);
    await askAssistant("acc1", [{ role: "user", content: "move DEV-162 to Doing" }], () => undefined, confirm);
    const [, seen] = confirm.mock.calls[0];
    expect(seen.flatMap((draft: { issues: { key?: string }[] }) => draft.issues.map((issue) => issue.key))).toEqual(["DEV-162"]);
  });
});
