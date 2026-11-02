import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { actionToolsOf, formAction, listTool, pageActions, type ActionTool } from "./chatActions";
import { askModel, chatTool, type Turn } from "./modelChat";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const schema = { type: "object", properties: { instance_id: { type: "string" } }, required: ["instance_id"] };

const tool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: schema });

const showRaiseTool = "show_raise_form";

const raiseTool: ActionTool = {
  spec: { name: showRaiseTool, description: "Shows the raise form in the content area.", parameters: { type: "object", properties: { tokens: { type: "integer" } }, required: [] } },
  answer: (prompt, args) => formAction(prompt, "Raise", { tool: "ai_set_limits", show: ["tokens_per_day"], initial: { tokens_per_day: args.tokens } }),
};

const asks = (name: string, args: unknown) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] } });

const said = (content: string) => ({ message: { role: "assistant", content } });

const raiseAsk: Turn[] = [{ role: "user", content: "Raise the daily tokens" }];

const conversation = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    return { items: [] };
  });
};

const offeredNames = () => ((callToolMock.mock.calls[0][2] as { tools?: { name: string }[] }).tools ?? []).map((spec) => spec.name);

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([tool("ai_list_accounts"), tool("ai_set_limits"), tool(chatTool)]);
  pageActions.models = [raiseTool];
});

afterEach(() => {
  delete pageActions.models;
});

describe("a page that offers an action tool", () => {
  it("lists the tools of its page and none for another page", () => {
    expect(actionToolsOf("models")).toEqual([raiseTool]);
    expect(actionToolsOf("status")).toEqual([]);
    expect(actionToolsOf("constructor")).toEqual([]);
  });

  it("offers the action tool to the model on that page only", async () => {
    conversation([said("ok")]);
    await askModel("h1", "a1", raiseAsk, "models");
    expect(offeredNames()).toContain(showRaiseTool);

    callToolMock.mockClear();
    conversation([said("ok")]);
    await askModel("h1", "a1", raiseAsk, "status");
    expect(offeredNames()).not.toContain(showRaiseTool);
  });

  it("lands the action it builds as the answer, under the prompt, and records nothing", async () => {
    conversation([asks(showRaiseTool, { tokens: 200000 }), said("Check it, then press Save.")]);

    const reply = await askModel("h1", "a1", raiseAsk, "models");

    expect(reply.answer).toEqual({
      kind: "action",
      prompt: "Raise the daily tokens",
      view: "form",
      title: "Raise",
      params: { tool: "ai_set_limits", show: ["tokens_per_day"], initial: { tokens_per_day: 200000 } },
    });
    expect(reply.text).toBe("Check it, then press Save.");
    expect(reply.calls.map((call) => call.name)).toEqual([showRaiseTool]);
    expect(callToolMock.mock.calls.filter((call) => call[1] === "ai_set_limits")).toEqual([]);
  });
});

describe("the ready-made list tool", () => {
  it("lands the table the model fills as a list answer under the prompt", async () => {
    pageActions.models = [listTool];
    conversation([asks(listTool.spec.name, { title: "Agents", columns: ["Agent"], rows: [["Farmers' agent"], ["Suppliers' agent"]] }), said("Here they are.")]);

    const reply = await askModel("h1", "a1", [{ role: "user", content: "Which agents use the model?" }], "models");

    expect(reply.answer).toEqual({
      kind: "action",
      prompt: "Which agents use the model?",
      view: "list",
      title: "Agents",
      params: { columns: ["Agent"], rows: [["Farmers' agent"], ["Suppliers' agent"]] },
    });
  });
});
