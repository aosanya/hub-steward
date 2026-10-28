import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool, listTools, type ToolInfo } from "../wakala/mcp";
import {
  askModel,
  chatTool,
  maxOfferedTools,
  maxResultLength,
  maxRounds,
  noAnswerSentence,
  noModelSentence,
  showToolsTool,
  tooManyRoundsSentence,
  type Turn,
} from "./modelChat";
import { showLimitRaiseTool } from "./limitRaise";
import { showRoleLimitFormTool } from "./roleLimitAction";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const schema = { type: "object", properties: { instance_id: { type: "string" }, scope: { type: "string" } }, required: ["instance_id", "scope"] };

const tool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: schema });

const offered = [tool("agency_list_roles"), tool("ai_get_account"), tool("actor_create_group"), tool("agency_propose_write"), tool(chatTool)];

const said = (content: string) => ({ message: { role: "assistant", content } });

const asks = (...calls: { id?: string; name: string; arguments: unknown }[]) => ({ message: { role: "assistant", content: "", tool_calls: calls } });

const hello: Turn[] = [{ role: "user", content: "Which roles are there?" }];

type Handlers = { answers: unknown[]; tools?: Record<string, (args: Record<string, unknown>) => unknown> };

const conversation = ({ answers, tools = {} }: Handlers) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown> = {}) => {
    if (name === chatTool) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    }
    if (!(name in tools)) throw new Error(`unexpected tool ${name}`);
    const result = tools[name](args);
    if (result instanceof Error) throw result;
    return result;
  });
};

const chatCalls = () => callToolMock.mock.calls.filter((call) => call[1] === chatTool);
const toolCalls = () => callToolMock.mock.calls.filter((call) => call[1] !== chatTool);
const sentMessages = (index: number) => (chatCalls()[index][2] as { messages: Record<string, unknown>[] }).messages;

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue(offered);
});

describe("asking the picked model", () => {
  it("returns the answer of a model that asks for no tool, from the picked account in this hub", async () => {
    conversation({ answers: [said("  Two roles.  ")] });

    expect((await askModel("hub-1", "a-7", hello)).text).toBe("Two roles.");

    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(callToolMock.mock.calls[0][0]).toBe("hub-1");
    expect(callToolMock.mock.calls[0][1]).toBe(chatTool);
    expect(callToolMock.mock.calls[0][2]).toMatchObject({ accountID: "a-7" });
  });

  it("opens with a system line that makes the model the manager's assistant that changes things only with the tools it is given, then the conversation so far", async () => {
    conversation({ answers: [said("ok")] });
    const earlier: Turn[] = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "And now?" },
    ];

    await askModel("hub-1", "a-7", earlier);

    const messages = sentMessages(0);
    expect(messages[0].role).toBe("system");
    expect(String(messages[0].content)).toMatch(/manager of this hub/);
    expect(String(messages[0].content)).toMatch(/When you have no tool for a change, say so/);
    expect(messages.slice(1)).toEqual(earlier);
  });

  it("refuses to ask when no model is picked and calls nothing", async () => {
    conversation({ answers: [said("ok")] });

    await expect(askModel("hub-1", "", hello)).rejects.toThrow(noModelSentence);
    expect(callToolMock).not.toHaveBeenCalled();
    expect(listToolsMock).not.toHaveBeenCalled();
  });

  it("passes the error on when the model call is refused, as when the account has no key", async () => {
    conversation({ answers: [new McpError("ai_chat_account: no key is set for this account")] });

    await expect(askModel("hub-1", "a-7", hello)).rejects.toThrow("no key is set for this account");
  });

  it("fails when the model sends neither an answer nor a tool call", async () => {
    conversation({ answers: [said("   ")] });

    await expect(askModel("hub-1", "a-7", hello)).rejects.toThrow(noAnswerSentence);
  });

  it("fails when the reply carries no message at all", async () => {
    conversation({ answers: [{}] });

    await expect(askModel("hub-1", "a-7", hello)).rejects.toThrow(noAnswerSentence);
  });
});

describe("the tools the model is offered", () => {
  const offeredOn = async (page: string) => {
    await askModel("hub-1", "a-7", hello, page);
    const asked = chatCalls().at(-1)?.[2] as { tools?: { name: string }[] };
    return (asked.tools ?? []).map((t) => t.name).filter((name) => name !== showToolsTool);
  };

  it("are the hub's read-only tools only, never a write and never the chat itself", async () => {
    conversation({ answers: [said("ok")] });

    expect(await offeredOn("status")).toEqual(["agency_list_roles", "ai_get_account"]);
  });

  it("are those of the open page's family, so the Models page gets the AI tools and not the agency's", async () => {
    listToolsMock.mockResolvedValue([tool("ai_list_accounts"), tool("agency_list_roles"), tool("actor_list_groups"), tool("sources_source_list")]);
    conversation({ answers: [said("ok")] });

    expect(await offeredOn("models")).toEqual(["ai_list_accounts", showRoleLimitFormTool, showLimitRaiseTool]);
    expect(await offeredOn("documents")).toEqual(["agency_list_roles", "sources_source_list"]);
    expect(await offeredOn("groups")).toEqual(["agency_list_roles", "actor_list_groups"]);
  });

  it("are a few basics on a page that has no family of its own", async () => {
    listToolsMock.mockResolvedValue([tool("ai_list_accounts"), tool("forms_form_list"), tool("actor_list_groups"), tool("insight_list_x")]);
    conversation({ answers: [said("ok")] });

    expect(await offeredOn("nowhere")).toEqual(["ai_list_accounts", "actor_list_groups"]);
  });

  it("are cut down to the first sentence of their description and of each argument's, so the model is not sent pages of text", async () => {
    const long = (sentence: string) => `${sentence}. ${"More and more detail follows here. ".repeat(40)}`;
    listToolsMock.mockResolvedValue([
      {
        name: "ai_list_accounts",
        description: long("Lists the accounts"),
        inputSchema: { type: "object", properties: { instance_id: { type: "string" }, limit: { type: "integer", description: long("How many") } }, required: ["instance_id"] },
      },
    ]);
    conversation({ answers: [said("ok")] });

    await askModel("hub-1", "a-7", hello, "models");

    const [spec] = (chatCalls()[0][2] as { tools: { description: string; parameters: { properties: { limit: { type: string; description: string } } } }[] }).tools;
    expect(spec.description).toBe("Lists the accounts.");
    expect(spec.parameters.properties.limit).toEqual({ type: "integer", description: "How many." });
  });

  it("have a runaway sentence cut at a limit and marked", async () => {
    listToolsMock.mockResolvedValue([{ name: "ai_list_accounts", description: "x".repeat(500), inputSchema: schema }]);
    conversation({ answers: [said("ok")] });

    await askModel("hub-1", "a-7", hello, "models");

    const [spec] = (chatCalls()[0][2] as { tools: { description: string }[] }).tools;
    expect(spec.description).toHaveLength(200);
    expect(spec.description.endsWith("…")).toBe(true);
  });

  it("carry their description, and their input schema without the hub, which the console fills in", async () => {
    conversation({ answers: [said("ok")] });

    await askModel("hub-1", "a-7", hello, "status");

    const [first] = (chatCalls()[0][2] as { tools: unknown[] }).tools;
    expect(first).toEqual({
      name: "agency_list_roles",
      description: "about agency_list_roles",
      parameters: { type: "object", properties: { scope: { type: "string" } }, required: ["scope"] },
    });
  });

  it("number at most the limit the common providers accept", async () => {
    listToolsMock.mockResolvedValue(Array.from({ length: maxOfferedTools + 50 }, (_, i) => tool(`ai_thing_${i}_list`)));
    conversation({ answers: [said("ok")] });

    await askModel("hub-1", "a-7", hello, "models");

    expect((chatCalls()[0][2] as { tools: unknown[] }).tools).toHaveLength(maxOfferedTools + 1);
  });

  it("give up a read tool for each tool of the page's own, so the Models page still totals the limit", async () => {
    listToolsMock.mockResolvedValue(Array.from({ length: maxOfferedTools + 50 }, (_, i) => tool(`ai_thing_${i}_list`)));
    conversation({ answers: [said("ok")] });

    await askModel("hub-1", "a-7", hello, "models");

    const names = (chatCalls()[0][2] as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names.filter((name) => name.startsWith("ai_thing_"))).toHaveLength(maxOfferedTools - 2);
    expect(names).toContain(showRoleLimitFormTool);
    expect(names).toContain(showLimitRaiseTool);
    expect(names).toContain(showToolsTool);
  });

  it("are left out, and the chat goes on, when the list of tools cannot be read", async () => {
    listToolsMock.mockRejectedValue(new McpError("not signed in", true));
    conversation({ answers: [said("ok")] });

    expect((await askModel("hub-1", "a-7", hello)).text).toBe("ok");
    expect(chatCalls()[0][2]).not.toHaveProperty("tools");
  });

  it("are left out when the hub offers no read tool", async () => {
    listToolsMock.mockResolvedValue([tool("actor_create_group")]);
    conversation({ answers: [said("ok")] });

    await askModel("hub-1", "a-7", hello, "status");

    expect(chatCalls()[0][2]).not.toHaveProperty("tools");
  });
});

describe("a tool the model asks for", () => {
  it("runs as the signed-in manager in this hub, its result goes back to the model, which then answers", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: { scope: "d-1" } }), said("There is one role: Manager.")],
      tools: { agency_list_roles: () => ({ items: [{ name: "Manager" }] }) },
    });

    expect((await askModel("hub-1", "a-7", hello)).text).toBe("There is one role: Manager.");

    expect(toolCalls()).toEqual([["hub-1", "agency_list_roles", { scope: "d-1", instance_id: "hub-1" }]]);
    expect(chatCalls()).toHaveLength(2);
    expect(sentMessages(1).slice(2)).toEqual([
      { role: "assistant", content: "", tool_calls: [{ id: "c1", name: "agency_list_roles", arguments: { scope: "d-1" } }] },
      { role: "tool", content: JSON.stringify({ items: [{ name: "Manager" }] }), tool_call_id: "c1" },
    ]);
  });

  it("keeps the first round's conversation as it was sent, not as it grew", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: {} }), said("done")],
      tools: { agency_list_roles: () => ({}) },
    });

    await askModel("hub-1", "a-7", hello, "status");

    expect(sentMessages(0)).toHaveLength(2);
    expect(sentMessages(1)).toHaveLength(4);
  });

  it("is always run in this hub, whichever hub the model names", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: { instance_id: "another-hub", scope: "d-1" } }), said("done")],
      tools: { agency_list_roles: () => ({}) },
    });

    await askModel("hub-1", "a-7", hello, "status");

    expect(toolCalls()).toEqual([["hub-1", "agency_list_roles", { instance_id: "hub-1", scope: "d-1" }]]);
  });

  it("is read from arguments the model wrote as text", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: '{"scope":"d-2"}' }), said("done")],
      tools: { agency_list_roles: () => ({}) },
    });

    await askModel("hub-1", "a-7", hello, "status");

    expect(toolCalls()[0][2]).toEqual({ scope: "d-2", instance_id: "hub-1" });
  });

  it("is run with no arguments when the model wrote text that is not an object", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: "not json" }), said("done")],
      tools: { agency_list_roles: () => ({}) },
    });

    await askModel("hub-1", "a-7", hello, "status");

    expect(toolCalls()[0][2]).toEqual({ instance_id: "hub-1" });
  });

  it("gets an id of our own when the model gave none, so its result can be matched", async () => {
    conversation({
      answers: [asks({ name: "agency_list_roles", arguments: {} }), said("done")],
      tools: { agency_list_roles: () => ({}) },
    });

    await askModel("hub-1", "a-7", hello, "status");

    const [call] = (sentMessages(1)[2] as { tool_calls: { id: string }[] }).tool_calls;
    expect(call.id).not.toBe("");
    expect(sentMessages(1)[3].tool_call_id).toBe(call.id);
  });

  it("answers every call of one reply, in order, before the model is asked again", async () => {
    conversation({
      answers: [
        asks({ id: "c1", name: "agency_list_roles", arguments: {} }, { id: "c2", name: "ai_get_account", arguments: { accountID: "a-7" } }),
        said("done"),
      ],
      tools: { agency_list_roles: () => ({ roles: 1 }), ai_get_account: () => ({ id: "a-7" }) },
    });

    await askModel("hub-1", "a-7", hello, "status");

    expect(toolCalls().map((call) => call[1])).toEqual(["agency_list_roles", "ai_get_account"]);
    expect(sentMessages(1).slice(3).map((m) => [m.role, m.tool_call_id])).toEqual([
      ["tool", "c1"],
      ["tool", "c2"],
    ]);
  });

  it("goes back to the model as its error text, and the chat goes on, when the tool fails", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: {} }), said("I could not read the roles.")],
      tools: { agency_list_roles: () => new McpError("agency_list_roles: not found") },
    });

    expect((await askModel("hub-1", "a-7", hello)).text).toBe("I could not read the roles.");
    expect(sentMessages(1)[3]).toEqual({ role: "tool", content: "agency_list_roles: not found", tool_call_id: "c1" });
  });

  it("is not run when it was not offered, as a write the model made up, and the model is told so", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "actor_create_group", arguments: { name: "x" } }), said("I cannot.")],
      tools: { actor_create_group: () => ({ id: "made" }) },
    });

    expect((await askModel("hub-1", "a-7", hello)).text).toBe("I cannot.");

    expect(toolCalls()).toEqual([]);
    expect(sentMessages(1)[3]).toEqual({ role: "tool", content: "the tool actor_create_group is not available", tool_call_id: "c1" });
  });

  it("is not run when it is the chat itself", async () => {
    conversation({ answers: [asks({ id: "c1", name: chatTool, arguments: {} }), said("no")] });

    await askModel("hub-1", "a-7", hello, "status");

    expect(chatCalls()).toHaveLength(2);
    expect(sentMessages(1)[3].content).toBe(`the tool ${chatTool} is not available`);
  });

  it("has a long result cut, so one lookup cannot fill the model's whole window", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: {} }), said("done")],
      tools: { agency_list_roles: () => ({ text: "x".repeat(maxResultLength * 2) }) },
    });

    await askModel("hub-1", "a-7", hello, "status");

    const content = String(sentMessages(1)[3].content);
    expect(content).toHaveLength(maxResultLength + 1);
    expect(content.endsWith("…")).toBe(true);
  });

  it("goes back as empty text when the tool answers nothing", async () => {
    conversation({
      answers: [asks({ id: "c1", name: "agency_list_roles", arguments: {} }), said("done")],
      tools: { agency_list_roles: () => undefined },
    });

    await askModel("hub-1", "a-7", hello, "status");

    expect(sentMessages(1)[3].content).toBe("");
  });
});

describe("a model that keeps asking for tools", () => {
  it("is stopped after the last round with a sentence, and is not asked once more", async () => {
    conversation({
      answers: [asks({ id: "c", name: "agency_list_roles", arguments: {} })],
      tools: { agency_list_roles: () => ({}) },
    });

    expect((await askModel("hub-1", "a-7", hello)).text).toBe(tooManyRoundsSentence);

    expect(chatCalls()).toHaveLength(maxRounds);
    expect(toolCalls()).toHaveLength(maxRounds);
  });

  it("may answer in the last round it is given", async () => {
    conversation({
      answers: [...Array.from({ length: maxRounds - 1 }, () => asks({ id: "c", name: "agency_list_roles", arguments: {} })), said("Just in time.")],
      tools: { agency_list_roles: () => ({}) },
    });

    expect((await askModel("hub-1", "a-7", hello)).text).toBe("Just in time.");
    expect(chatCalls()).toHaveLength(maxRounds);
  });
});

describe("asking what tools the chat has", () => {
  const asksForTheList = () => asks({ id: "t1", name: showToolsTool, arguments: {} });

  it("offers the console's own tool next to the read tools", async () => {
    conversation({ answers: [said("ok")] });

    await askModel("hub-1", "a-7", hello, "status");

    const names = (chatCalls()[0][2] as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(names).toEqual(["agency_list_roles", "ai_get_account", showToolsTool]);
  });

  it("answers from the offered tools, not from the model's wording, with a row each for name, first sentence and area", async () => {
    listToolsMock.mockResolvedValue([
      { name: "agency_list_roles", description: "Lists the roles. More detail follows.", inputSchema: schema },
      { name: "ai_get_account", description: "Reads one account.", inputSchema: schema },
      tool("actor_create_group"),
    ]);
    conversation({ answers: [asksForTheList(), said("The list is on the page.")] });
    const asked: Turn[] = [{ role: "user", content: "What tools do we have?" }];

    const reply = await askModel("hub-1", "a-7", asked, "status");

    expect(reply.text).toBe("The list is on the page.");
    expect(reply.answer).toEqual({
      kind: "tools",
      prompt: "What tools do we have?",
      rows: [
        { name: "agency_list_roles", summary: "Lists the roles.", area: "agency" },
        { name: "ai_get_account", summary: "Reads one account.", area: "ai" },
      ],
    });
    expect(toolCalls()).toHaveLength(0);
  });

  it("tells the model the list is shown, so it does not repeat it", async () => {
    conversation({ answers: [asksForTheList(), said("Shown.")] });

    await askModel("hub-1", "a-7", hello, "status");

    const result = sentMessages(1).at(-1) as { role: string; content: string; tool_call_id: string };
    expect(result.role).toBe("tool");
    expect(result.tool_call_id).toBe("t1");
    expect(result.content).toContain("now shown to the manager in the content area");
  });

  it("logs each call for the thread, the console's tool and the read tools alike", async () => {
    conversation({
      answers: [asks({ id: "a", name: "agency_list_roles", arguments: { scope: "d1", instance_id: "x" } }, { id: "b", name: "ai_get_account", arguments: {} }), said("Done.")],
      tools: { agency_list_roles: () => ({ roles: [] }), ai_get_account: () => new Error("no such account") },
    });

    const reply = await askModel("hub-1", "a-7", hello, "status");

    expect(reply.calls.map(({ name, summary, state }) => ({ name, summary, state }))).toEqual([
      { name: "agency_list_roles", summary: "scope=d1", state: "done" },
      { name: "ai_get_account", summary: "", state: "error" },
    ]);
  });

  it("sends the model the words of the conversation only, not the calls and answers kept for the screen", async () => {
    conversation({ answers: [said("ok")] });
    const kept: Turn[] = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello", calls: [{ name: "x", summary: "", state: "done", ms: 3 }], answer: { kind: "tools", prompt: "Hi", rows: [] } },
      { role: "user", content: "And?" },
    ];

    await askModel("hub-1", "a-7", kept, "status");

    expect(sentMessages(0).slice(1)).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "And?" },
    ]);
  });
});
