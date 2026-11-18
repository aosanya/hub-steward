import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { askAssistant, couldNotReadSentence } from "./api";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../../shared/wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue([]);
});

afterEach(() => forgetOpenAgency());

const asksThenAnswers = (answer: string, readFails: boolean) => {
  const replies = [{ message: { content: "", tool_calls: [{ id: "c1", name: "taskmanager_task_pending", arguments: {} }] } }, { message: { content: answer } }];
  mcp.callTool.mockImplementation(async (_hub: string, name: string) => {
    if (name === "ai_chat_account") return replies.shift();
    if (readFails) throw new Error("refused");
    return { total: 0, items: [] };
  });
};

describe("an answer after a read that failed", () => {
  it("says a read could not be made, even when the model says there are none", async () => {
    asksThenAnswers("I found no overdue bills for Kiss Péter.", true);
    const answer = await askAssistant("acc1", [{ role: "user", content: "Which bills of Kiss Péter are overdue?" }]);
    expect(answer.text).toContain("I found no overdue bills for Kiss Péter.");
    expect(answer.text).toContain(couldNotReadSentence);
  });

  it("is left as the model wrote it when every read worked", async () => {
    asksThenAnswers("Nothing is pending.", false);
    const answer = await askAssistant("acc1", [{ role: "user", content: "What is pending?" }]);
    expect(answer.text).toBe("Nothing is pending.");
  });
});
