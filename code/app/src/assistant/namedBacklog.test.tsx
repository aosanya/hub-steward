import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { askAssistant, offeredNames } from "./api";
import { askedBacklog } from "./namedBacklog";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

const backlogs = { items: [{ id: "b1", name: "Backlog" }, { id: "b2", name: "Software" }, { id: "s1", name: "walk-09b ready", kind: "smart" }] };

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(offeredNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } })));
});

afterEach(() => forgetOpenAgency());

const modelSays = (content: string) =>
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
    if (name === "taskmanager_backlog_list") return backlogs;
    if (name === "ai_chat_account") return { message: { content } };
    return { items: [] };
  });

const modelCalls = () => mcp.callTool.mock.calls.filter(([, name]) => name === "ai_chat_account");

describe("a message that only asks to show a backlog by its name", () => {
  it("reads the backlog list itself and answers with the backlogs card, without the model's issue search", async () => {
    modelSays("No issues match 'walk-09b' with the Ready tag.");
    const answer = await askAssistant("acc1", [{ role: "user", content: "show walk-09b ready" }]);
    expect(answer.lists.map((list) => list.view)).toEqual(["backlogs"]);
    expect(answer.text).toContain("walk-09b ready");
    expect(answer.text).not.toContain("No issues match");
    expect(modelCalls()).toEqual([]);
  });

  it("takes the words in any case and with the usual leading words", () => {
    expect(askedBacklog("Open the Walk 09b READY backlog please", ["walk-09b ready"])).toBe("walk-09b ready");
  });

  it("does not guess when two backlogs spell the same", () => {
    expect(askedBacklog("show software", ["Software", "software"])).toBeUndefined();
  });

  it("leaves a question that only mentions a backlog to the model", () => {
    expect(askedBacklog("how many ready issues are in Software", ["Software"])).toBeUndefined();
  });

  it("leaves the answer to the model when the words name no backlog", async () => {
    modelSays("12 issues.");
    const answer = await askAssistant("acc1", [{ role: "user", content: "show shoes" }]);
    expect(modelCalls()).toHaveLength(1);
    expect(answer.text).toBe("12 issues.");
  });

  it("leaves the answer to the model when the backlog list cannot be read", async () => {
    mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
      if (name === "taskmanager_backlog_list") throw new Error("down");
      return name === "ai_chat_account" ? { message: { content: "Here." } } : { items: [] };
    });
    const answer = await askAssistant("acc1", [{ role: "user", content: "show walk-09b ready" }]);
    expect(answer.text).toBe("Here.");
  });
});
