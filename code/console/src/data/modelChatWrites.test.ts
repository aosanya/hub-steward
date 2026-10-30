import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { askModel, chatTool, formNudge, type Turn } from "./modelChat";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("./chatPages", () => ({
  chatPageOf: (page: string) => (page === "demo" ? { reads: ["agency_list_roles"], writes: ["agency_create_role", "agency_set_thing"] } : null),
}));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const withDraft = {
  type: "object",
  properties: { instance_id: { type: "string" }, draft_id: { type: "string" }, name: { type: "string" } },
  required: ["instance_id", "draft_id", "name"],
};

const withoutDraft = { type: "object", properties: { instance_id: { type: "string" }, name: { type: "string" } }, required: ["instance_id"] };

const offered: ToolInfo[] = [
  { name: "agency_list_roles", description: "lists roles", inputSchema: { type: "object", properties: { instance_id: { type: "string" } } } },
  { name: "agency_create_role", description: "creates a role", inputSchema: withDraft },
  { name: "agency_set_thing", description: "sets a thing", inputSchema: withoutDraft },
  { name: "agency_delete_role", description: "deletes a role", inputSchema: withDraft },
  { name: chatTool, description: "chat", inputSchema: { type: "object" } },
];

const said = (content: string) => ({ message: { role: "assistant", content } });

const asks = (name: string, args: unknown) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] } });

const ask: Turn[] = [{ role: "user", content: "Add a Treasurer role" }];

const converse = (answers: unknown[], extra: Record<string, unknown> = {}) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    if (name === "agency_list_drafts") return { items: [{ id: "d1", status: "open" }] };
    if (name in extra) {
      const answer = extra[name];
      if (answer instanceof Error) throw answer;
      return answer;
    }
    return { items: [] };
  });
};

const calls = (name: string) => callToolMock.mock.calls.filter((call) => call[1] === name).map((call) => call[2]);

const offeredNames = () => ((callToolMock.mock.calls[0][2] as { tools?: { name: string }[] }).tools ?? []).map((spec) => spec.name);

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue(offered);
});

describe("a page that lets the chat change the agency", () => {
  it("offers its read tools and its write tools, and no other write", async () => {
    converse([said("ok")]);

    await askModel("h1", "a1", ask, "demo");

    expect(offeredNames()).toEqual(expect.arrayContaining(["agency_list_roles", "agency_create_role", "agency_set_thing"]));
    expect(offeredNames()).not.toContain("agency_delete_role");
  });

  it("hides the draft from the model, so it cannot choose one", async () => {
    converse([said("ok")]);

    await askModel("h1", "a1", ask, "demo");

    const specs = (callToolMock.mock.calls[0][2] as { tools: { name: string; parameters: { properties: object; required: string[] } }[] }).tools;
    const create = specs.find((spec) => spec.name === "agency_create_role");
    expect(Object.keys(create?.parameters.properties ?? {})).toEqual(["name"]);
    expect(create?.parameters.required).toEqual(["name"]);
  });

  it("runs a write at once in the working draft and marks the page changed", async () => {
    converse([asks("agency_create_role", { name: "Treasurer" }), said("I added the Treasurer role.")], { agency_create_role: { id: "r9" } });

    const reply = await askModel("h1", "a1", ask, "demo");

    expect(calls("agency_create_role")).toEqual([{ name: "Treasurer", draft_id: "d1", instance_id: "h1" }]);
    expect(reply.changed).toBe("demo");
    expect(reply.text).toBe("I added the Treasurer role.");
  });

  it("does not add a draft to a write that does not take one", async () => {
    converse([asks("agency_set_thing", { name: "x" }), said("Done.")]);

    await askModel("h1", "a1", ask, "demo");

    expect(calls("agency_set_thing")).toEqual([{ name: "x", instance_id: "h1" }]);
  });

  it("does not mark the page changed when the write is refused, and tells the model why", async () => {
    converse([asks("agency_create_role", { name: "Treasurer" }), said("It was refused.")], { agency_create_role: new Error("agency_create_role: name already used") });

    const reply = await askModel("h1", "a1", ask, "demo");

    expect(reply.changed).toBeUndefined();
    expect(reply.calls[0].state).toBe("error");
  });

  it("refuses a delete the page did not list", async () => {
    converse([asks("agency_delete_role", { name: "x" }), said("Cannot.")]);

    const reply = await askModel("h1", "a1", ask, "demo");

    expect(calls("agency_delete_role")).toEqual([]);
    expect(reply.calls[0].state).toBe("error");
  });

  it("is told once to call a write tool when it only promises the change", async () => {
    converse([asks("agency_list_roles", {}), said("I'll add that role."), asks("agency_create_role", { name: "Treasurer" }), said("Added.")]);

    await askModel("h1", "a1", ask, "demo");

    const sent = callToolMock.mock.calls.filter((call) => call[1] === chatTool).map((call) => (call[2] as { messages: { role: string; content: string }[] }).messages);
    expect(sent[2].at(-1)?.content).toBe(formNudge("agency_create_role"));
  });
});
