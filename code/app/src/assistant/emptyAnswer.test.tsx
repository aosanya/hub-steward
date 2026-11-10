import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { askAssistant } from "./api";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  openAgency("farmers");
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
  mcp.listTools.mockResolvedValue([]);
});

afterEach(() => forgetOpenAgency());

const chatCalls = () => mcp.callTool.mock.calls.filter((call) => call[1] === "ai_chat_account");

describe("an empty answer from the model", () => {
  it("is asked once more before it is shown as a failure", async () => {
    const replies = [{ message: { content: "" } }, { message: { content: "293 issues." } }];
    mcp.callTool.mockImplementation(async (_hub: string, name: string) => (name === "ai_chat_account" ? replies.shift() : {}));
    const answer = await askAssistant("acc1", [{ role: "user", content: "show Blocked" }]);
    expect(answer.text).toBe("293 issues.");
    expect(chatCalls()).toHaveLength(2);
  });

  it("fails after a second empty answer, and no third call is made", async () => {
    mcp.callTool.mockResolvedValue({ message: { content: "  " } });
    await expect(askAssistant("acc1", [{ role: "user", content: "show Blocked" }])).rejects.toThrow("sent no answer");
    expect(chatCalls()).toHaveLength(2);
  });
});
