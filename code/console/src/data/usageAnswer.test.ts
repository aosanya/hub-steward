import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools, type ToolInfo } from "../wakala/mcp";
import { actionToolsOf } from "./chatActions";
import { chatPageOf } from "./chatPages";
import { hintKeys } from "./menu";
import { askModel, chatTool, type Turn } from "./modelChat";
import { usageAnswerOf, usageAskOf, showUsageAnswerTool } from "./usageAnswer";
import type { UsageRow } from "./usageBreakdown";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn(), listTools: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const schema = { type: "object", properties: { window: { type: "string" } }, required: [] };

const tool = (name: string): ToolInfo => ({ name, description: `about ${name}`, inputSchema: schema });

const asks = (name: string, args: unknown) => ({ message: { role: "assistant", content: "", tool_calls: [{ id: "t1", name, arguments: args }] } });

const said = (content: string) => ({ message: { role: "assistant", content } });

const ask: Turn[] = [{ role: "user", content: "Why did test runs use so much of the month?" }];

const breakdown = { from: "2026-10-01", to: "2026-10-28", rows: [] };

const conversation = (answers: unknown[]) => {
  const queue = [...answers];
  callToolMock.mockImplementation(async (_hub: string, name: string) => {
    if (name === chatTool) return queue.length > 1 ? queue.shift() : queue[0];
    if (name === "ai_usage_breakdown") return breakdown;
    return { items: [] };
  });
};

const row = (day: string, kind: UsageRow["kind"], person: string, tokens: number): UsageRow => ({
  day,
  model: "m",
  roleId: "r1",
  role: "Farmers' agent",
  kind,
  person,
  tokensIn: tokens,
  tokensOut: 0,
  requests: 1,
});

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  listToolsMock.mockResolvedValue([tool("ai_usage_breakdown"), tool("ai_list_roles"), tool(chatTool)]);
});

describe("the chat of the Usage pages", () => {
  it.each(["usage", "usage-overview", "usage-work", "usage-agents"])("offers the usage answer tool and reads the breakdown on %s", (page) => {
    expect(actionToolsOf(page).map((one) => one.spec.name)).toEqual([showUsageAnswerTool]);
    expect(chatPageOf(page)?.reads).toContain("ai_usage_breakdown");
  });

  it("offers it on no other page", () => {
    expect(actionToolsOf("status")).toEqual([]);
  });

  it("has three chips of its own on every Usage page", () => {
    expect(hintKeys("usage-overview")).toEqual(["chat.usage.1", "chat.usage.2", "chat.usage.3"]);
  });

  it("puts the usage answer in the content area under the question, with the model's one sentence", async () => {
    conversation([
      asks("ai_usage_breakdown", { window: "month" }),
      asks(showUsageAnswerTool, { kind: "test_run", window: "month" }),
      said("Test runs used 25% of the month, mostly on 14 to 16 Oct."),
    ]);

    const reply = await askModel("h1", "a1", ask, "usage-overview");

    expect(reply.answer).toEqual({
      kind: "action",
      prompt: "Why did test runs use so much of the month?",
      view: "usageAnswer",
      title: "",
      params: { kind: "test_run", window: "month" },
    });
    expect(reply.text).toBe("Test runs used 25% of the month, mostly on 14 to 16 Oct.");
    expect(reply.calls.map((call) => call.name)).toEqual(["ai_usage_breakdown", showUsageAnswerTool]);
    expect(callToolMock.mock.calls.filter((call) => call[1] === "ai_usage_breakdown")).toHaveLength(1);
  });
});

describe("the answer's figures", () => {
  const rows = [row("2026-10-14", "test_run", "p1", 200), row("2026-10-14", "chat", "p2", 100), row("2026-10-15", "test_run", "", 100)];

  it("count only the kind asked about and share it against every kind", () => {
    const answer = usageAnswerOf(rows, "test_run");
    expect(answer.tokens).toBe(300);
    expect(answer.share).toBe(75);
    expect(answer.runs).toBe(2);
    expect(answer.busiest).toEqual({ day: "2026-10-14", tokens: 200, runs: 1, person: "p1" });
    expect(answer.busyDays.map((day) => day.day)).toEqual(["2026-10-14", "2026-10-15"]);
  });

  it("count every kind when none is named", () => {
    expect(usageAnswerOf(rows, "").tokens).toBe(400);
  });

  it("read a span, a kind and a role from the model's arguments and ignore what is not one", () => {
    expect(usageAskOf({ kind: "test_run", window: "7d", role_id: "r1", model: "m" })).toEqual({ kind: "test_run", span: "7d", roleId: "r1", model: "m" });
    expect(usageAskOf({ kind: "nonsense", window: "year" })).toEqual({ kind: "", span: "month", roleId: "", model: "" });
  });
});
