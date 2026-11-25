import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../shared/wakala/mcp";
import { mcpRulebookClient } from "./api";

afterEach(() => vi.restoreAllMocks());

const hub = (answer: (tool: string, args: Record<string, unknown>) => unknown) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    const reply = answer(tool, args);
    if (reply instanceof Error) throw reply;
    return reply as never;
  });

const record = (code: string, kind: string, extra: Record<string, unknown> = {}) => ({ id: `id-${code}`, code, kind, title: `${code} title`, status: "in_force", ...extra });

const issue = (id: string, relation: string) => ({ issue_id: id, issue_code: `ISS-${id}`, title: `Issue ${id}`, relation });

const ready = <T>(answer: { state: string; data?: T }) => {
  expect(answer.state).toBe("ready");
  return answer.data as T;
};

describe("one record, its issues and its files", () => {
  it("reads a record by its code", async () => {
    const call = hub(() => record("R-2", "rule", { created_at: "2026-11-20T10:00:00Z" }));
    const rule = ready(await mcpRulebookClient().read("R-2"));
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_read", { ruleCode: "R-2" });
    expect(rule).toMatchObject({ code: "R-2", createdAt: "2026-11-20T10:00:00Z" });
  });

  it("reads a record that is wrapped in rule", async () => {
    hub(() => ({ rule: record("D-3", "decision") }));
    expect(ready(await mcpRulebookClient().read("D-3"))).toMatchObject({ code: "D-3", kind: "decision" });
  });

  it("says missing for an answer that holds no record", async () => {
    hub(() => ({}));
    expect(await mcpRulebookClient().read("R-99")).toEqual({ state: "missing" });
  });

  it("lists the issues that follow a rule", async () => {
    const call = hub(() => [issue("1", "applies_to")]);
    expect(ready(await mcpRulebookClient().issues("R-2"))).toEqual([{ id: "1", code: "ISS-1", title: "Issue 1", relation: "applies_to" }]);
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_issue_list", { ruleCode: "R-2" });
  });

  it("lists the files with Not found true only for a missing one", async () => {
    const call = hub(() => ({ items: [{ id: "f1", repo: "hub-steward", path: "a.ts", missing: true }, { id: "f2", repo: "hub-steward", path: "b.ts" }] }));
    expect(ready(await mcpRulebookClient().files("R-2")).map((file: any) => file.missing)).toEqual([true, false]);
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_file_list", { ruleCode: "R-2" });
  });

  it("lists the rules a decision produced", async () => {
    const call = hub(() => [record("R-2", "rule")]);
    expect(ready(await mcpRulebookClient().produced("D-3")).map((rule: any) => rule.code)).toEqual(["R-2"]);
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_produced_list", { ruleCode: "D-3" });
  });
});

describe("what went wrong is a typed answer", () => {
  it("says forbidden for a refusal of access", async () => {
    hub(() => new mcp.McpError("taskmanager_backlog_rules_list: backlog access forbidden"));
    expect(await mcpRulebookClient().list("b1", "rule")).toEqual({ state: "forbidden" });
  });

  it("says forbidden when the transport refuses the session", async () => {
    hub(() => new mcp.McpError("not signed in", true));
    expect(await mcpRulebookClient().read("R-2")).toEqual({ state: "forbidden" });
  });

  it("says missing for an unknown code", async () => {
    hub(() => new mcp.McpError("taskmanager_rule_read: rule not found"));
    expect(await mcpRulebookClient().read("R-99")).toEqual({ state: "missing" });
    expect(await mcpRulebookClient().issues("R-99")).toEqual({ state: "missing" });
  });

  it("says failed, with no message, for anything else", async () => {
    hub(() => new Error("offline"));
    expect(await mcpRulebookClient().files("R-2")).toEqual({ state: "failed" });
    hub(() => new mcp.McpError("taskmanager_rule_read: wakala answered 500: boom"));
    expect(await mcpRulebookClient().read("R-2")).toEqual({ state: "failed" });
  });

  it("says forbidden for a 403 answer", async () => {
    hub(() => new mcp.McpError("wakala answered 403: no"));
    expect(await mcpRulebookClient().list("b1", "rule")).toEqual({ state: "forbidden" });
  });

  it("does not read the word permission or not allowed in a message as a refusal", async () => {
    hub(() => new mcp.McpError("taskmanager_rule_read: permission table could not be loaded"));
    expect(await mcpRulebookClient().read("R-2")).toEqual({ state: "failed" });
    hub(() => new mcp.McpError("taskmanager_rule_read: that is not allowed here"));
    expect(await mcpRulebookClient().read("R-2")).toEqual({ state: "failed" });
  });

  it("says missing for an unknown backlog", async () => {
    hub(() => new mcp.McpError("taskmanager_backlog_rules_list: unknown backlog"));
    expect(await mcpRulebookClient().list("b9", "rule")).toEqual({ state: "missing" });
  });
});

describe("Settled in and Why", () => {
  const linked = (rule: Record<string, unknown>, relation: string) => ({ rule, relation });

  it("gives the issues a decision was decided in and no others", async () => {
    hub(() => [issue("1", "decided_in"), issue("2", "applies_to"), issue("3", "decided_in")]);
    expect(ready(await mcpRulebookClient().settledIn("D-3")).map((one: any) => one.code)).toEqual(["ISS-1", "ISS-3"]);
  });

  it("finds the decision a rule came from with two reads: its issues, then the rules of each decided-in issue", async () => {
    const call = hub((tool) =>
      tool === "taskmanager_rule_issue_list"
        ? [issue("1", "decided_in"), issue("2", "applies_to")]
        : { linked: [linked(record("R-2", "rule"), "decided_in"), linked(record("D-3", "decision"), "decided_in")], suggested: [record("D-8", "decision")] },
    );
    const why = ready(await mcpRulebookClient().why("R-2"));
    expect(why).toMatchObject({ code: "D-3", kind: "decision" });
    const forIssue = call.mock.calls.filter(([, tool]) => tool === "taskmanager_rule_list_for_issue");
    expect(forIssue.map(([, , args]) => args)).toEqual([{ taskID: "1" }]);
  });

  it("gives nothing when no linked decision is found", async () => {
    hub((tool) => (tool === "taskmanager_rule_issue_list" ? [issue("1", "decided_in")] : { linked: [linked(record("R-5", "rule"), "applies_to")] }));
    expect(await mcpRulebookClient().why("R-2")).toEqual({ state: "ready", data: undefined });
  });

  it("ignores a linked decision whose relation is not decided_in", async () => {
    hub((tool) => (tool === "taskmanager_rule_issue_list" ? [issue("1", "decided_in")] : { linked: [linked(record("D-3", "decision"), "applies_to"), linked(record("D-4", "decision"), "broken_by")] }));
    expect(await mcpRulebookClient().why("R-2")).toEqual({ state: "ready", data: undefined });
  });

  it("makes no second read when the rule has no decided-in issue", async () => {
    const call = hub(() => [issue("2", "applies_to")]);
    expect(await mcpRulebookClient().why("R-2")).toEqual({ state: "ready", data: undefined });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("skips an issue whose rules cannot be read and tries the next", async () => {
    hub((tool, args) => {
      if (tool === "taskmanager_rule_issue_list") return [issue("1", "decided_in"), issue("2", "decided_in")];
      return args.taskID === "1" ? new mcp.McpError("taskmanager_rule_list_for_issue: forbidden") : { linked: [linked(record("D-3", "decision"), "decided_in")] };
    });
    expect(ready(await mcpRulebookClient().why("R-2"))).toMatchObject({ code: "D-3" });
  });

  it("fails when the issues of the rule cannot be read", async () => {
    hub(() => new mcp.McpError("taskmanager_rule_issue_list: rule not found"));
    expect(await mcpRulebookClient().why("R-2")).toEqual({ state: "missing" });
  });
});

describe("opening one record whole", () => {
  const answering = (tool: string, args: Record<string, unknown>) => {
    const code = String(args.ruleCode ?? "");
    if (tool === "taskmanager_rule_read") return record(code, code.startsWith("D") ? "decision" : code.startsWith("Q") ? "question" : "rule");
    if (tool === "taskmanager_rule_issue_list") return [issue("1", "decided_in"), issue("2", "applies_to")];
    if (tool === "taskmanager_rule_file_list") return [{ id: "f1", repo: "hub-steward", path: "a.ts", missing: true }];
    if (tool === "taskmanager_rule_produced_list") return [record("R-2", "rule")];
    if (tool === "taskmanager_rule_list_for_issue") return { linked: [{ rule: record("D-3", "decision"), relation: "decided_in" }] };
    return [];
  };

  it("gives a rule its issues, its files and its Why", async () => {
    const call = hub(answering);
    const opened = ready<any>(await mcpRulebookClient().open("R-2"));
    expect(opened.rule.code).toBe("R-2");
    expect(opened.issues).toHaveLength(2);
    expect(opened.files[0].missing).toBe(true);
    expect(opened.why.code).toBe("D-3");
    expect(opened.produced).toEqual([]);
    expect(call.mock.calls.some(([, tool]) => tool === "taskmanager_rule_produced_list")).toBe(false);
  });

  it("gives a decision the rules it produced and where it was settled, with no Why", async () => {
    const call = hub(answering);
    const opened = ready<any>(await mcpRulebookClient().open("D-3"));
    expect(opened.produced.map((rule: any) => rule.code)).toEqual(["R-2"]);
    expect(opened.settledIn.map((one: any) => one.code)).toEqual(["ISS-1"]);
    expect(opened.why).toBeUndefined();
    expect(call.mock.calls.some(([, tool]) => tool === "taskmanager_rule_list_for_issue")).toBe(false);
  });

  it("gives a question its issues and files only", async () => {
    const call = hub(answering);
    const opened = ready<any>(await mcpRulebookClient().open("Q-1"));
    expect(opened.rule.kind).toBe("question");
    expect(opened.produced).toEqual([]);
    expect(opened.why).toBeUndefined();
    expect(call.mock.calls.some(([, tool]) => tool === "taskmanager_rule_produced_list" || tool === "taskmanager_rule_list_for_issue")).toBe(false);
  });

  it("gives an answered question the decision that answered it", async () => {
    const call = hub((tool, args) => {
      if (tool === "taskmanager_rule_read") return args.ruleCode === "Q-1" ? record("Q-1", "question", { answered_by: "D-3" }) : record("D-3", "decision");
      return [];
    });
    const opened = ready<any>(await mcpRulebookClient().open("Q-1"));
    expect(opened.answer.code).toBe("D-3");
    expect(call).toHaveBeenCalledWith("", "taskmanager_rule_read", { ruleCode: "D-3" });
  });

  it("gives a question that nobody answered no answer and reads no second record", async () => {
    const call = hub((tool) => (tool === "taskmanager_rule_read" ? record("Q-1", "question") : []));
    expect(ready<any>(await mcpRulebookClient().open("Q-1")).answer).toBeUndefined();
    expect(call.mock.calls.filter(([, tool]) => tool === "taskmanager_rule_read")).toHaveLength(1);
  });

  it("still opens a question whose answering decision cannot be read", async () => {
    hub((tool, args) => {
      if (tool !== "taskmanager_rule_read") return [];
      return args.ruleCode === "Q-1" ? record("Q-1", "question", { answered_by: "D-9" }) : new mcp.McpError("taskmanager_rule_read: forbidden");
    });
    const opened = ready<any>(await mcpRulebookClient().open("Q-1"));
    expect(opened.rule.code).toBe("Q-1");
    expect(opened.answer).toBeUndefined();
  });

  it("is missing when the record is unknown", async () => {
    hub(() => new mcp.McpError("taskmanager_rule_read: rule not found"));
    expect(await mcpRulebookClient().open("R-99")).toEqual({ state: "missing" });
  });

  it("fails when its files cannot be read", async () => {
    hub((tool, args) => (tool === "taskmanager_rule_file_list" ? new Error("offline") : answering(tool, args)));
    expect(await mcpRulebookClient().open("R-2")).toEqual({ state: "failed" });
  });
});
