import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { askModel, chatTool, formNudge, showWorkflowFormTool, type Turn } from "./modelChat";
import { showRoleLimitFormTool } from "./roleLimitAction";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const schema = { type: "object", properties: { instance_id: { type: "string" } }, required: ["instance_id"] };

const tool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: schema });

const asks = (name: string, args: unknown) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] } });

const said = (content: string) => ({ message: { role: "assistant", content } });

const conversation = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    return { items: [] };
  });
};

const chatCalls = () => callToolMock.mock.calls.filter((call) => call[1] === chatTool);

const lastMessageOf = (index: number) => {
  const messages = (chatCalls()[index][2] as { messages: { role: string; content: string }[] }).messages;
  return messages[messages.length - 1];
};

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([tool("ai_list_roles"), tool("agency_list_workflows"), tool("agency_create_workflow"), tool(chatTool)]);
});

describe("a read question on the Models page", () => {
  const ask: Turn[] = [{ role: "user", content: "What is the Farmers' agent limit?" }];

  it("ends with the answer that follows the read, in two chat calls and with no nudge to open the role-limit form", async () => {
    conversation([asks("ai_list_roles", {}), said("The Farmers' agent may use 50000 tokens a day.")]);

    const reply = await askModel("h1", "a1", ask, "models");

    expect(chatCalls()).toHaveLength(2);
    expect(reply.text).toBe("The Farmers' agent may use 50000 tokens a day.");
    expect(reply.answer).toBeUndefined();
    expect(lastMessageOf(1).role).toBe("tool");
    expect(JSON.stringify(chatCalls().map((call) => call[2]))).not.toContain(formNudge(showRoleLimitFormTool));
  });

  it("still lands the role-limit form when the model calls it after reading, in three chat calls", async () => {
    conversation([asks("ai_list_roles", {}), asks(showRoleLimitFormTool, { role: "r1", limit: "tokens_per_day", value: 80 }), said("Check it, then press Save.")]);

    const reply = await askModel("h1", "a1", [{ role: "user", content: "Raise the Farmers' agent limit to 80" }], "models");

    expect(chatCalls()).toHaveLength(3);
    expect(reply.answer).toMatchObject({ kind: "action", params: { role: "r1", limit: "tokens_per_day", value: 80 } });
  });
});

describe("a form request on the Workflows page", () => {
  it("is nudged once to call the form tool when the model only promises the workflow, in four chat calls", async () => {
    conversation([
      asks("agency_list_workflows", {}),
      said("I'll add that workflow."),
      asks(showWorkflowFormTool, { name: "Cancel after a no", description: "", cancel: true, steps: [] }),
      said("Check it, then press Save."),
    ]);

    const reply = await askModel("h1", "a1", [{ role: "user", content: "Add a cancel workflow" }], "workflows");

    expect(chatCalls()).toHaveLength(4);
    expect(lastMessageOf(2)).toEqual({ role: "user", content: formNudge(showWorkflowFormTool) });
    expect(reply.answer).toMatchObject({ kind: "form", form: "workflow" });
  });
});
