import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { askModel, chatTool, type Turn } from "./modelChat";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  callTool: vi.fn(),
  listTools: vi.fn(),
}));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const withDraft = {
  type: "object",
  properties: { instance_id: { type: "string" }, draft_id: { type: "string" } },
  required: ["instance_id", "draft_id"],
};

const reads: ToolInfo[] = [
  "agency_list_goals",
  "agency_list_objectives",
  "agency_list_drafts",
].map((name) => ({ name, description: name, inputSchema: withDraft }));

const asks = (...names: string[]) => ({
  message: {
    role: "assistant",
    content: "",
    tool_calls: names.map((name, index) => ({
      id: `t${index}`,
      name,
      arguments: { draft_id: "guessed" },
    })),
  },
});

const said = (content: string) => ({ message: { role: "assistant", content } });

const ask: Turn[] = [{ role: "user", content: "review the objectives" }];

const converse = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    if (name === "agency_list_drafts")
      return { items: [{ id: "d1", status: "open" }] };
    return { items: [] };
  });
};

const callsOf = (name: string) =>
  callToolMock.mock.calls.filter((call) => call[1] === name);

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([
    ...reads,
    { name: chatTool, description: "chat", inputSchema: { type: "object" } },
  ]);
});

describe("the draft the chat reads from", () => {
  it("is the working draft, so the model is never asked for a draft id and cannot offer a wrong one", async () => {
    converse([asks("agency_list_goals"), said("done")]);

    await askModel("h1", "a1", ask, "objectives");

    const specs = (
      callsOf(chatTool)[0][2] as {
        tools: { name: string; parameters: { properties: object } }[];
      }
    ).tools;
    expect(
      specs.find((spec) => spec.name === "agency_list_goals")?.parameters
        .properties,
    ).not.toHaveProperty("draft_id");
    expect(callsOf("agency_list_goals")[0][2]).toEqual({
      draft_id: "d1",
      instance_id: "h1",
    });
  });

  it("is looked up once for the whole question, however many reads the model makes", async () => {
    converse([
      asks("agency_list_goals", "agency_list_objectives"),
      asks("agency_list_goals"),
      said("done"),
    ]);

    await askModel("h1", "a1", ask, "objectives");

    expect(callsOf("agency_list_drafts")).toHaveLength(1);
    expect(callsOf("agency_list_goals")).toHaveLength(2);
  });

  it("is not something the model can list itself", async () => {
    converse([said("ok")]);

    await askModel("h1", "a1", ask, "objectives");

    const names = (
      callsOf(chatTool)[0][2] as { tools: { name: string }[] }
    ).tools.map((spec) => spec.name);
    expect(names).not.toContain("agency_list_drafts");
  });
});
