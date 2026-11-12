import { describe, expect, it, vi } from "vitest";
import { McpError } from "../wakala/mcp";
import type { NotificationItem } from "./api";
import { openChecked, stateOf, type Reader } from "./subjectCheck";

const note = (over: Partial<NotificationItem>): NotificationItem => ({
  id: "n1",
  event: "task_assigned",
  subjectKind: "task",
  subjectId: "t1",
  names: {},
  createdAt: "2026-11-12T10:00:00Z",
  read: false,
  ...over,
});

const reading = (reply: unknown): Reader => vi.fn().mockResolvedValue(reply);

const failing = (message: string): Reader => vi.fn().mockRejectedValue(new McpError(message));

describe("the state of a notification's subject", () => {
  it.each([
    ["task", "taskmanager_task_read", { taskID: "t1" }],
    ["issue", "taskmanager_task_read", { taskID: "t1" }],
    ["survey", "forms_form_read", { form_id: "t1" }],
    ["form", "forms_form_read", { form_id: "t1" }],
    ["group", "actor_get_group", { group_id: "t1" }],
    ["group_order", "market_get_group_order", { groupOrderID: "t1" }],
  ])("reads a %s with %s", async (subjectKind, tool, args) => {
    const read = reading({ id: "t1", status: "pending" });
    expect(await stateOf(note({ subjectKind }), read)).toBe("there");
    expect(read).toHaveBeenCalledWith(tool, args);
  });

  it.each(["completed", "cancelled"])("says done for a task whose status is %s", async (status) => {
    expect(await stateOf(note({}), reading({ status }))).toBe("done");
  });

  it("does not call a form done because it is closed", async () => {
    expect(await stateOf(note({ subjectKind: "form" }), reading({ status: "completed" }))).toBe("there");
  });

  it.each(["taskmanager_task_read: not found", "forms_form_read: no such form", "actor_get_group: group does not exist"])("says gone when the read answers %s", async (message) => {
    expect(await stateOf(note({}), failing(message))).toBe("gone");
  });

  it("says unknown when the server fails, so nothing is said that may be wrong", async () => {
    expect(await stateOf(note({}), failing("wakala answered 503: down"))).toBe("unknown");
    expect(await stateOf(note({}), vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))).toBe("unknown");
    expect(await stateOf(note({}), failing("not found"))).toBe("gone");
  });

  it("says unknown, with no read, for a subject the server cannot read yet", async () => {
    const read = reading({});
    expect(await stateOf(note({ event: "ask_waiting", subjectKind: "ask" }), read)).toBe("unknown");
    expect(await stateOf(note({ subjectId: "" }), read)).toBe("unknown");
    expect(read).not.toHaveBeenCalled();
  });
});

describe("opening a notification after its subject is checked", () => {
  const deps = (read: Reader) => ({ read, markOneRead: vi.fn(), navigate: vi.fn(), say: vi.fn() });

  it("marks it read and opens it when the subject is there", async () => {
    const d = deps(reading({ status: "pending" }));
    await openChecked(note({}), "/issue/t1", d);
    expect(d.markOneRead).toHaveBeenCalledWith("n1");
    expect(d.navigate).toHaveBeenCalledWith("/issue/t1");
    expect(d.say).toHaveBeenCalledWith("");
  });

  it("opens it as before when the check cannot tell", async () => {
    const d = deps(failing("wakala answered 500: down"));
    await openChecked(note({}), "/issue/t1", d);
    expect(d.markOneRead).toHaveBeenCalledWith("n1");
    expect(d.navigate).toHaveBeenCalledWith("/issue/t1");
  });

  it("opens a done task, which still has its page", async () => {
    const d = deps(reading({ status: "completed" }));
    await openChecked(note({}), "/issue/t1", d);
    expect(d.navigate).toHaveBeenCalledWith("/issue/t1");
  });

  it("says the subject is gone, clears the row and goes nowhere when it vanished", async () => {
    const d = deps(failing("taskmanager_task_read: not found"));
    await openChecked(note({}), "/issue/t1", d);
    expect(d.navigate).not.toHaveBeenCalled();
    expect(d.markOneRead).toHaveBeenCalledWith("n1");
    expect(d.say).toHaveBeenCalledWith("That task is no longer there.");
  });

  it("does not mark an already read row again", async () => {
    const d = deps(failing("not found"));
    await openChecked(note({ read: true }), "/issue/t1", d);
    expect(d.markOneRead).not.toHaveBeenCalled();
  });
});
