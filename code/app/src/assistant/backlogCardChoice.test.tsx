import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { askAssistant, offeredNames } from "./api";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

const backlogs = {
  items: [
    { id: "b1", name: "Backlog" },
    { id: "b2", name: "Software" },
    { id: "b3", name: "walk-07b Ops" },
    { id: "b4", name: "Ops" },
    { id: "s1", name: "walk-09b ready", kind: "smart" },
  ],
};

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue(offeredNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } })));
});

afterEach(() => forgetOpenAgency());

const modelListsBacklogsThenAnswers = (answer: string) => {
  let round = 0;
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
    if (name === "ai_chat_account") {
      round += 1;
      return round === 1 ? { message: { content: "", tool_calls: [{ id: "c", name: "taskmanager_backlog_list", arguments: {} }] } } : { message: { content: answer } };
    }
    if (name === "taskmanager_backlog_list") return backlogs;
    return { items: [] };
  });
};

const viewsOf = async (message: string, answer = "Done.") => {
  modelListsBacklogsThenAnswers(answer);
  const result = await askAssistant("acc1", [{ role: "user", content: message }]);
  return result.lists.map((list) => list.view);
};

describe("which backlog card an answer gets when the model read the backlog list", () => {
  it("is none for a question that names no backlog", async () => {
    expect(await viewsOf("show Blocked and mwanachama-frontend-kazi")).toEqual([]);
  });

  it("is the named backlog alone when the words name one", async () => {
    expect(await viewsOf("show the Software board")).toEqual(["backlog:b2"]);
  });

  it("is the longest name when one name sits inside another", async () => {
    expect(await viewsOf("what is in walk-07b Ops")).toEqual(["backlog:b3"]);
  });

  it("is each backlog named, in the order named", async () => {
    expect(await viewsOf("compare Software and Backlog")).toEqual(["backlog:b2", "backlog:b1"]);
  });

  it("is the whole list only when the words ask for the backlogs", async () => {
    expect(await viewsOf("show the backlogs")).toEqual(["backlogs"]);
  });
});

describe("a message that only asks to show a backlog by its name", () => {
  it("gets that backlog's own card, not the list of every backlog, and the line points at a button that exists", async () => {
    mcp.callTool.mockImplementation(async (_hub: string, name: string) => (name === "taskmanager_backlog_list" ? backlogs : { items: [] }));
    const result = await askAssistant("acc1", [{ role: "user", content: "show walk-09b ready" }]);
    expect(result.lists.map((list) => list.view)).toEqual(["backlog:s1"]);
    expect(result.text).toBe("walk-09b ready is a backlog you can open. Tap Open on it below.");
  });
});
