import { askAssistant, offeredNames } from "./api";
import { createTool, rulesTool, writeProblem } from "./confirm";
import { pageLines } from "./triager";
import { ruleCodesLine, rulesProblem } from "./ruleCodes";

const mcp = vi.hoisted(() => ({ callTool: vi.fn(), listTools: vi.fn() }));

vi.mock("../wakala/mcp", () => ({ callTool: mcp.callTool, listTools: mcp.listTools, McpError: class extends Error {} }));

beforeEach(() => {
  mcp.callTool.mockReset();
  mcp.listTools.mockReset();
});

const tool = (name: string) => ({ name, description: name, inputSchema: { type: "object", properties: {}, required: [] } });

describe("rule codes in the page lines", () => {
  it("names every field code and every operator code the hub takes", () => {
    for (const code of ["tag", "mark", "backlog", "step", "priority", "title", "description", "waits_on", "last_changed", "has", "does_not_have", "is_not", "contains", "does_not_contain", "has_something", "has_nothing", "in_the_last", "not_in_the_last"]) {
      expect(ruleCodesLine).toContain(code);
    }
    expect(pageLines).toContain(ruleCodesLine);
  });

  it("says never to send the display words", () => {
    expect(ruleCodesLine).toContain("never");
    expect(ruleCodesLine).toContain("Last changed");
    expect(ruleCodesLine).toContain("is in the last");
  });

  it("tells the model to read the backlog list when the owner asks to show a backlog by name", () => {
    expect(pageLines).toContain("taskmanager_backlog_list");
    expect(pageLines).toMatch(/show .*backlog/i);
  });
});

describe("a rule is checked before the card", () => {
  it("accepts rules in codes", () => {
    expect(rulesProblem([{ field: "last_changed", operator: "in_the_last", value: "14 days" }, { field: "mark", operator: "is", value: "Ready" }])).toBe("");
    expect(rulesProblem({ match: "all", rules: [{ field: "waits_on", operator: "has_nothing", value: "" }] })).toBe("");
  });

  it("names a display word used as a field", () => {
    const problem = rulesProblem([{ field: "Last changed", operator: "in_the_last", value: "14 days" }]);
    expect(problem).toContain("Last changed");
    expect(problem).toContain("last_changed");
  });

  it("names a display word used as an operator and what the field takes", () => {
    const problem = rulesProblem([{ field: "last_changed", operator: "is in the last", value: "14 days" }]);
    expect(problem).toContain("is in the last");
    expect(problem).toContain("in_the_last, not_in_the_last");
  });

  it("refuses a duration that is not a number and a unit, a mark that is not Ready, Waiting or Blocked and an unknown priority", () => {
    expect(rulesProblem([{ field: "last_changed", operator: "in_the_last", value: "fortnight" }])).not.toBe("");
    expect(rulesProblem([{ field: "mark", operator: "is", value: "Stale" }])).not.toBe("");
    expect(rulesProblem([{ field: "priority", operator: "is", value: "urgent" }])).not.toBe("");
  });

  it("checks the rules of a create and of a rules change, and nothing else", () => {
    const bad = [{ field: "Tag", operator: "has", value: "docs" }];
    expect(writeProblem({ tool: rulesTool, arguments: { backlogID: "b", rules: bad } })).not.toBe("");
    expect(writeProblem({ tool: createTool, arguments: { name: "x", rules: { match: "any", rules: bad } } })).not.toBe("");
    expect(writeProblem({ tool: createTool, arguments: { name: "x", steps: ["To do"] } })).toBe("");
  });

  it("does not show the card or call the hub for a bad rule, and hands the model the problem", async () => {
    mcp.listTools.mockResolvedValue(offeredNames.map(tool));
    const bad = { id: "c1", name: rulesTool, arguments: { backlogID: "b1", rules: [{ field: "Last changed", operator: "is in the last", value: "14 days" }] } };
    mcp.callTool.mockImplementation(async (_hub: string, name: string, args: Record<string, unknown>) => {
      if (name === "ai_chat_account") {
        const sent = args.messages as { role: string; content: string }[];
        const reply = sent.find((message) => message.role === "tool");
        return reply ? { message: { content: reply.content } } : { message: { content: "", tool_calls: [bad] } };
      }
      if (name === "agency_list_publications") return { items: [] };
      return { ok: true };
    });
    const confirm = vi.fn().mockResolvedValue(true);
    const answer = await askAssistant("acc1", [{ role: "user", content: "last 14 days" }], () => undefined, confirm);
    expect(confirm).not.toHaveBeenCalled();
    expect(mcp.callTool.mock.calls.filter((call) => call[1] === rulesTool)).toHaveLength(0);
    expect(answer.text).toContain("last_changed");
    expect(answer.text).toContain("Nothing was done");
  });
});
