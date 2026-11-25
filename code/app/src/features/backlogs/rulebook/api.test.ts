import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../shared/wakala/mcp";
import { fileOf, issueOf, ruleOf } from "./mappers";
import { mcpRulebookClient } from "./api";

afterEach(() => vi.restoreAllMocks());

const hub = (answer: (tool: string, args: Record<string, unknown>) => unknown) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => answer(tool, args) as never);

const raw = {
  id: "r1",
  kind: "rule",
  code: "R-2",
  title: "Routes are named after the model",
  body: "Because the routes read better.",
  status: "superseded",
  tags: ["go", "api"],
  supersedes: "R-1",
  superseded_by: "R-9",
  decided_by: "Owner",
  decided_at: "2026-11-25",
  priority: "P1",
  answered_by: "D-3",
  created_at: "2026-11-20T10:00:00Z",
};

describe("a record from the hub", () => {
  it("becomes a Rule with every field named for the screens", () => {
    expect(ruleOf(raw)).toEqual({
      id: "r1",
      kind: "rule",
      code: "R-2",
      title: "Routes are named after the model",
      body: "Because the routes read better.",
      status: "superseded",
      tags: ["go", "api"],
      supersedes: "R-1",
      supersededBy: "R-9",
      decidedBy: "Owner",
      decidedAt: "2026-11-25",
      priority: "P1",
      answeredBy: "D-3",
      createdAt: "2026-11-20T10:00:00Z",
    });
  });

  it("turns missing fields into empty text and empty lists, never undefined", () => {
    expect(ruleOf({ code: "Q-1", kind: "question", title: "Which?" })).toEqual({
      id: "",
      kind: "question",
      code: "Q-1",
      title: "Which?",
      body: "",
      status: "",
      tags: [],
      supersedes: "",
      supersededBy: "",
      decidedBy: "",
      decidedAt: "",
      priority: "",
      answeredBy: "",
      createdAt: "",
    });
    expect(Object.values(ruleOf(undefined)).includes(undefined as never)).toBe(false);
  });

  it("drops a tag that is not text and reads an unknown kind as a rule", () => {
    const rule = ruleOf({ code: "X-1", kind: "memo", tags: ["go", 4, null, ""] });
    expect(rule.tags).toEqual(["go"]);
    expect(rule.kind).toBe("rule");
  });

  it("maps an issue link and a file link", () => {
    expect(issueOf({ issue_id: "i1", issue_code: "ISS-246", title: "Rules view", relation: "decided_in" })).toEqual({
      id: "i1",
      code: "ISS-246",
      title: "Rules view",
      relation: "decided_in",
    });
    expect(fileOf({ id: "f1", repo: "hub-steward", path: "code/app/src/a.ts", line: 12, note: "see it", added_by: "u1", missing: true })).toEqual({
      id: "f1",
      repo: "hub-steward",
      path: "code/app/src/a.ts",
      line: 12,
      note: "see it",
      addedBy: "u1",
      missing: true,
    });
  });

  it("flags a file missing only when the wire says true", () => {
    expect(fileOf({ repo: "r", path: "p" }).missing).toBe(false);
    expect(fileOf({ repo: "r", path: "p", missing: "true" }).missing).toBe(false);
    expect(fileOf({ repo: "r", path: "p", missing: false }).missing).toBe(false);
    expect(fileOf({ repo: "r", path: "p" }).line).toBe(0);
  });
});

describe("the list of one backlog", () => {
  it("asks the rule list of the backlog with the backlog id and each status", async () => {
    const call = hub(() => [raw]);
    const answer = await mcpRulebookClient().list("b1", "rule", { statuses: ["in_force", "proposed"] });
    expect(call).toHaveBeenCalledWith("", "taskmanager_backlog_rules_list", { backlogID: "b1", status: ["in_force", "proposed"] });
    expect(answer).toEqual({ state: "ready", data: [ruleOf(raw)] });
  });

  it("asks the decision list for a decision and the question list for a question", async () => {
    const call = hub(() => ({ items: [] }));
    await mcpRulebookClient().list("b1", "decision", { statuses: ["decided"] });
    await mcpRulebookClient().list("b1", "question", { statuses: ["open"] });
    expect(call).toHaveBeenNthCalledWith(1, "", "taskmanager_backlog_decisions_list", { backlogID: "b1", status: ["decided"] });
    expect(call).toHaveBeenNthCalledWith(2, "", "taskmanager_backlog_questions_list", { backlogID: "b1", status: ["open"] });
  });

  it("sends no status when none is chosen, so the hub gives its own default", async () => {
    const call = hub(() => []);
    await mcpRulebookClient().list("b1", "rule");
    expect(call).toHaveBeenCalledWith("", "taskmanager_backlog_rules_list", { backlogID: "b1" });
  });

  it("sends no status for an empty statuses list, so the hub gives its own default", async () => {
    const call = hub(() => []);
    await mcpRulebookClient().list("b1", "rule", { statuses: [] });
    await mcpRulebookClient().list("all", "rule", { statuses: [] });
    expect(call).toHaveBeenNthCalledWith(1, "", "taskmanager_backlog_rules_list", { backlogID: "b1" });
    expect(call).toHaveBeenNthCalledWith(2, "", "taskmanager_rule_list", { kind: "rule" });
  });

  it.each([
    ["rule", "decided"],
    ["rule", "open"],
    ["decision", "retired"],
    ["decision", "in_force"],
    ["question", "proposed"],
    ["question", "superseded"],
  ] as const)("refuses the status %2$s on a %1$s before any hub call", async (kind, status) => {
    const call = hub(() => []);
    expect(await mcpRulebookClient().list("b1", kind, { statuses: [status] })).toEqual({ state: "failed" });
    expect(await mcpRulebookClient().list("all", kind, { statuses: [status] })).toEqual({ state: "failed" });
    expect(call).not.toHaveBeenCalled();
  });

  it("refuses one stray status among good ones", async () => {
    const call = hub(() => []);
    expect(await mcpRulebookClient().list("b1", "rule", { statuses: ["in_force", "open"] })).toEqual({ state: "failed" });
    expect(call).not.toHaveBeenCalled();
  });

  it("reads a bare array, items, or an empty answer", async () => {
    hub(() => ({ items: [raw] }));
    expect(await mcpRulebookClient().list("b1", "rule")).toEqual({ state: "ready", data: [ruleOf(raw)] });
    hub(() => ({}));
    expect(await mcpRulebookClient().list("b1", "rule")).toEqual({ state: "ready", data: [] });
  });

  it("reads an empty list whose items are null as no records", async () => {
    hub(() => ({ items: null }));
    expect(await mcpRulebookClient().list("b1", "question")).toEqual({ state: "ready", data: [] });
    hub(() => null);
    expect(await mcpRulebookClient().list("all", "question")).toEqual({ state: "ready", data: [] });
  });

  it("drops a record that carries no code", async () => {
    hub(() => [raw, { title: "no code" }]);
    const answer = await mcpRulebookClient().list("b1", "rule");
    expect(answer.state === "ready" && answer.data.map((rule) => rule.code)).toEqual(["R-2"]);
  });
});

describe("the list across all issues", () => {
  it("asks the instance-wide list with the kind and the statuses and never a backlog id", async () => {
    const call = hub(() => []);
    await mcpRulebookClient().list("all", "decision", { statuses: ["decided", "proposed"] });
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_list", { kind: "decision", status: ["decided", "proposed"] });
    expect(Object.keys(call.mock.calls[0][2] ?? {})).not.toContain("backlogID");
  });

  it("adds the tags a record must carry", async () => {
    const call = hub(() => []);
    await mcpRulebookClient().list("all", "rule", { statuses: ["in_force"], tags: ["go", "api"] });
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_list", { kind: "rule", status: ["in_force"], tag: ["go", "api"] });
  });

  it("sends only the kind when nothing else is chosen", async () => {
    const call = hub(() => []);
    await mcpRulebookClient().list("all", "question");
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_list", { kind: "question" });
  });

  it("passes the hub id it was built with", async () => {
    const call = hub(() => []);
    await mcpRulebookClient("hub-9").list("all", "rule");
    expect(call.mock.calls[0][0]).toBe("hub-9");
  });
});
