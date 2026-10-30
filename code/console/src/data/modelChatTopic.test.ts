import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { askModel, chatTool, contextOf, maxContextTurns, newTopicTool, type Turn } from "./modelChat";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const tool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: { type: "object" } });

const said = (content: string) => ({ message: { role: "assistant", content } });

const asks = (name: string) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: {} }] } });

const conversation = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => (name === chatTool ? (queue.length > 1 ? queue.shift() : queue[0]) : { items: [] }));
};

const sentMessages = () => callToolMock.mock.calls.filter((call) => call[1] === chatTool).map((call) => (call[2] as { messages: { role: string; content: string }[] }).messages);

const offeredNames = () => ((callToolMock.mock.calls[0][2] as { tools?: { name: string }[] }).tools ?? []).map((spec) => spec.name);

const user = (content: string, newTopic = false): Turn => ({ role: "user", content, ...(newTopic ? { newTopic } : {}) });

const assistant = (content: string): Turn => ({ role: "assistant", content });

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([tool("agency_get_agency")]);
});

describe("the part of the chat that is sent to the model", () => {
  it("is everything when the chat is short and no subject was closed", () => {
    const turns = [user("a"), assistant("b"), user("c")];

    expect(contextOf(turns)).toEqual(turns);
  });

  it("starts at the newest message that opened a new subject", () => {
    const turns = [user("purpose"), assistant("ok"), user("goals", true), assistant("sure"), user("more")];

    expect(contextOf(turns).map((turn) => turn.content)).toEqual(["goals", "sure", "more"]);
  });

  it("keeps only the most recent turns and starts on a message from the manager", () => {
    const turns = Array.from({ length: 30 }, (_, index) => (index % 2 === 0 ? user(`q${index}`) : assistant(`a${index}`)));

    const kept = contextOf(turns);

    expect(kept.length).toBeLessThanOrEqual(maxContextTurns);
    expect(kept[0].role).toBe("user");
    expect(kept.at(-1)).toEqual(turns.at(-1));
  });
});

describe("a manager who changes the subject", () => {
  const earlier = [user("make the purpose broader"), assistant("It is on the page."), user("Generate the goals for this agency")];

  it("offers the new-topic tool only when there is something earlier to forget", async () => {
    conversation([said("ok")]);
    await askModel("h1", "a1", [user("hello")], "goals");
    expect(offeredNames()).not.toContain(newTopicTool);

    callToolMock.mockClear();
    conversation([said("ok")]);
    await askModel("h1", "a1", earlier, "goals");
    expect(offeredNames()).toContain(newTopicTool);
  });

  it("drops the earlier messages from the request once the model calls it, and marks the reply", async () => {
    conversation([asks(newTopicTool), said("Here are goals.")]);

    const reply = await askModel("h1", "a1", earlier, "goals");

    const [first, second] = sentMessages();
    expect(first.map((message) => message.content)).toContain("make the purpose broader");
    expect(second.map((message) => message.role)).toEqual(["system", "user"]);
    expect(second[1].content).toBe("Generate the goals for this agency");
    expect(reply.text).toBe("Here are goals.");
    expect(reply.newTopic).toBe(true);
  });

  it("leaves the chat whole when the model does not call it", async () => {
    conversation([said("The Purpose is about farmers.")]);

    const reply = await askModel("h1", "a1", earlier, "goals");

    expect(reply.newTopic).toBeUndefined();
  });

  it("sends only the messages since the subject changed on the next question", async () => {
    conversation([said("ok")]);

    await askModel("h1", "a1", [user("purpose"), assistant("done"), user("goals", true), assistant("here"), user("shorter")], "goals");

    expect(sentMessages()[0].slice(1).map((message) => message.content)).toEqual(["goals", "here", "shorter"]);
  });
});
