import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import {
  askModel,
  chatTool,
  maxRounds,
  suggestNudge,
  suggestionsLeftSentence,
  type Turn,
} from "./modelChat";
import { showSuggestionsTool } from "./chatTools";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  callTool: vi.fn(),
  listTools: vi.fn(),
}));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const tool = (name: string): ToolInfo => ({
  name,
  description: `about ${name}`,
  inputSchema: {
    type: "object",
    properties: {
      instance_id: { type: "string" },
      draft_id: { type: "string" },
    },
  },
});

const said = (content: string) => ({ message: { role: "assistant", content } });

const asks = (name: string, args: unknown) => ({
  message: {
    role: "assistant",
    content: "",
    tool_calls: [{ id: "t1", name, arguments: args }],
  },
});

const ask: Turn[] = [{ role: "user", content: "review the objectives" }];

const converse = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) =>
    name === chatTool
      ? queue.length > 1
        ? queue.shift()
        : queue[0]
      : { items: [] },
  );
};

const offeredNames = () =>
  (
    (callToolMock.mock.calls[0][2] as { tools?: { name: string }[] }).tools ??
    []
  ).map((spec) => spec.name);

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue(
    [
      "agency_get_agency",
      "agency_list_objectives",
      "agency_update_objective",
      "agency_delete_objective",
    ].map(tool),
  );
});

describe("a review asked of the chat", () => {
  it("is offered the review tool on Objectives, and the chat itself still cannot delete", async () => {
    converse([said("ok")]);

    await askModel("h1", "a1", ask, "objectives");

    expect(offeredNames()).toContain(showSuggestionsTool);
    expect(offeredNames()).not.toContain("agency_delete_objective");
  });

  it("is offered on every agency page, Publish included", async () => {
    for (const page of [
      "goals",
      "objectives",
      "roles",
      "risks",
      "modules",
      "workflows",
      "test",
      "profile",
      "publish",
    ]) {
      callToolMock.mockReset();
      converse([said("ok")]);

      await askModel("h1", "a1", ask, page);

      expect(offeredNames(), page).toContain(showSuggestionsTool);
    }
  });

  it("is not offered on a page with no chat page of its own", async () => {
    converse([said("ok")]);

    await askModel("h1", "a1", ask, "status");

    expect(offeredNames()).not.toContain(showSuggestionsTool);
  });

  it("opens the Chat response tab with the list, changes nothing, and lets a delete ride on a row", async () => {
    converse([
      asks(showSuggestionsTool, {
        summary: "Two overlap",
        suggestions: [
          {
            title: "Delete O-15",
            tool: "agency_delete_objective",
            arguments: { objective_id: "o15" },
          },
        ],
      }),
      said("The review is in the tab."),
    ]);

    const reply = await askModel("h1", "a1", ask, "objectives");

    expect(reply.answer).toMatchObject({
      kind: "suggestions",
      fill: {
        page: "objectives",
        items: [{ tool: "agency_delete_objective" }],
      },
    });
    expect(reply.changed).toBeUndefined();
    expect(
      callToolMock.mock.calls.filter(
        (call) => call[1] === "agency_delete_objective",
      ),
    ).toEqual([]);
  });

  it("is told to give its suggestions when it keeps reading, and on the last step can do nothing else", async () => {
    converse([
      ...Array.from({ length: maxRounds - 1 }, () =>
        asks("agency_list_objectives", {}),
      ),
      asks(showSuggestionsTool, {
        summary: "Two overlap",
        suggestions: [{ title: "Merge O-15 into O-22" }],
      }),
      said("The review is in the tab."),
    ]);

    const reply = await askModel("h1", "a1", ask, "objectives");

    const sent = callToolMock.mock.calls
      .filter((call) => call[1] === chatTool)
      .map(
        (call) =>
          call[2] as {
            messages: { content: string }[];
            tools: { name: string }[];
          },
      );
    expect(sent[maxRounds - 2].messages.at(-1)?.content).toBe(suggestNudge);
    expect(sent[maxRounds - 1].tools.map((spec) => spec.name)).toEqual([
      showSuggestionsTool,
    ]);
    expect(reply.answer).toMatchObject({ kind: "suggestions" });
    expect(reply.text).toBe(suggestionsLeftSentence);
  });

  it("is not forced to give suggestions when it was not asked for a review", async () => {
    converse([
      ...Array.from({ length: maxRounds }, () =>
        asks("agency_list_objectives", {}),
      ),
    ]);

    await askModel("h1", "a1", ask, "status");

    const sent = callToolMock.mock.calls
      .filter((call) => call[1] === chatTool)
      .map((call) => call[2] as { tools?: { name: string }[] });
    expect(sent.at(-1)?.tools?.map((spec) => spec.name)).not.toEqual([
      showSuggestionsTool,
    ]);
  });
});

describe("askModel with background from the draft", () => {
  it("adds the background to the system message for that call only", async () => {
    callToolMock.mockReset();
    listToolsMock.mockResolvedValue([]);
    callToolMock.mockResolvedValue(said("Done.") as never);

    await askModel("h1", "acc", [{ role: "user", content: "Review the objectives." }], "objectives", "goals (1):\n{\"id\":\"g1\"}");
    await askModel("h1", "acc", [{ role: "user", content: "Review the objectives." }], "objectives");

    const system = (index: number) => {
      const args = callToolMock.mock.calls[index][2] as { messages: { role: string; content: string }[] };
      return args.messages.filter((message) => message.role === "system");
    };
    expect(system(0)).toHaveLength(1);
    expect(system(0)[0].content).toContain("goals (1):");
    expect(system(1)[0].content).not.toContain("goals (1):");
    expect(system(1)[0].content).not.toContain("Background for this turn");
  });
});
