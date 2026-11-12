import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { words } from "../entry/words";
import { magyar } from "../entry/magyar";
import { swahili } from "../entry/swahili";
import * as mcp from "../wakala/mcp";
import { assignedIssuesOf, assignedIssueTitle, mcpAssignedClient } from "./assignedIssues";
import type { NotificationItem } from "./api";
import { pathOf, titleOf } from "./noticeWords";

beforeEach(() => vi.restoreAllMocks());

afterEach(() => vi.restoreAllMocks());

const row = (over: Record<string, unknown>) => ({ id: "t1", code: "HS-002", title: "Review: the Review step", status: "pending", assigned_to: "m1", assignee_kind: "actor", step: "review", ...over });

describe("the issues waiting on the member", () => {
  it("keeps an open issue assigned to the member, by code and title", () => {
    expect(assignedIssuesOf([row({})], "m1")).toEqual([{ id: "t1", code: "HS-002", title: "Review: the Review step", step: "review" }]);
  });

  it("leaves out an issue assigned to someone else, to a role or to an agent", () => {
    const others = [row({ id: "a", assigned_to: "m2" }), row({ id: "b", assignee_kind: "role" }), row({ id: "c", assignee_kind: "agent" }), row({ id: "d", assignee_kind: "" }), row({ id: "e", assigned_to: "" })];
    expect(assignedIssuesOf(others, "m1")).toEqual([]);
  });

  it("leaves out an issue that is finished", () => {
    const finished = ["completed", "cancelled", "failed"].map((status) => row({ id: status, status }));
    expect(assignedIssuesOf(finished, "m1")).toEqual([]);
  });

  it("leaves out everything when the member's id is not known", () => {
    expect(assignedIssuesOf([row({})], "")).toEqual([]);
  });

  it("names an issue by its code then its title, and by the title alone when it has no code", () => {
    expect(assignedIssueTitle({ id: "t1", code: "HS-002", title: "Review: the Review step", step: "" })).toBe("HS-002 Review: the Review step");
    expect(assignedIssueTitle({ id: "t1", code: "", title: "Review it", step: "" })).toBe("Review it");
  });
});

const withTaskModule = { modules: [{ module: "taskmanager" }] };

const hub = (modules: unknown, rest: (tool: string) => unknown) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
    if (tool === "agency_get_agency") return { name: "Kisumu" };
    if (tool === "agency_list_mounts") return modules;
    const out = rest(tool);
    if (out instanceof Error) throw out;
    return out;
  });

describe("the read of the member's issues", () => {
  it("asks who the member is, lists the issues, and keeps the member's open ones", async () => {
    const spy = hub(withTaskModule, (tool) => (tool === "actor_get_my_actor" ? { id: "m1" } : { items: [row({}), row({ id: "t2", assigned_to: "m9" })] }));
    expect(await mcpAssignedClient.assigned()).toEqual([{ id: "t1", code: "HS-002", title: "Review: the Review step", step: "review" }]);
    expect(spy.mock.calls.map((c) => c[1])).toContain("taskmanager_task_list");
  });

  it("reads nothing and finds none when the agency has no task module", async () => {
    const spy = hub({ modules: [{ module: "forms" }] }, () => new Error("not asked"));
    expect(await mcpAssignedClient.assigned()).toEqual([]);
    expect(spy.mock.calls.map((c) => c[1])).not.toContain("taskmanager_task_list");
  });

  it("fails when the modules cannot be read, so the count is not taken for none", async () => {
    hub({}, () => new Error("down"));
    await expect(mcpAssignedClient.assigned()).rejects.toThrow();
  });

  it("fails when the issues cannot be read, so the count is not taken for none", async () => {
    hub(withTaskModule, (tool) => (tool === "actor_get_my_actor" ? { id: "m1" } : new Error("down")));
    await expect(mcpAssignedClient.assigned()).rejects.toThrow();
  });
});

const assigned: NotificationItem = { id: "n1", event: "task_assigned", subjectKind: "issue", subjectId: "t1", names: {}, createdAt: "2026-11-12T10:00:00Z", read: false };

describe("the notification that an issue was assigned", () => {
  it("says an issue, never a task, in English, Swahili and Magyar", () => {
    expect(titleOf(assigned, words)).toBe("An issue was assigned to you");
    expect(words.inboxTaskAssigned).not.toMatch(/task/i);
    expect(swahili.inboxTaskAssigned).not.toMatch(/kazi/i);
    expect(magyar.inboxTaskAssigned).not.toMatch(/feladat/i);
  });

  it("opens the issue when tapped, whether the hub calls the subject a task or an issue", () => {
    expect(pathOf(assigned)).toMatch(/\/backlogs\/issue\/t1$/);
    expect(pathOf({ ...assigned, subjectKind: "task" })).toMatch(/\/backlogs\/issue\/t1$/);
  });
});
