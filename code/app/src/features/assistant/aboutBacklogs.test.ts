import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const list: ChatAbout = { kind: "backlogs", id: "all", name: "Backlogs" };

const backlog: ChatAbout = { kind: "backlog", id: "needs-journey-book", name: "Needs Journey Book" };

const issue: ChatAbout = { kind: "backlog-issue", id: "t1", name: "Fix mirrored board drift" };

describe("the chat about the backlogs", () => {
  it("reads the backlogs and the issues listed, with no argument naming anything else", () => {
    expect(readNamesFor(list)).toEqual(["taskmanager_backlog_list", "taskmanager_task_list"]);
    expect(scopeKeysFor(list, "taskmanager_backlog_list")).toEqual([]);
    expect(scopedArgs(list, "taskmanager_task_list", { limit: 5 })).toEqual({ limit: 5 });
  });

  it("gives every read a step word and names the subject by its title", () => {
    for (const name of readNamesFor(list)) expect(stepWordsFor(list)[name]).toBeTruthy();
    expect(aboutLabel(list)).toBe("Backlogs");
    expect(emptyWordsFor(list)).toContain("Backlogs");
  });

  it("offers choices and tells the model what is about", () => {
    expect(choicesFor(list).length).toBeGreaterThan(0);
    expect(promptFor(list)).toContain("about one thing, Backlogs.");
  });
});

describe("the chat about one backlog", () => {
  it("reads its own issues by the backlog it is about, and the backlog list for its steps", () => {
    expect(readNamesFor(backlog)).toEqual(["taskmanager_task_pending", "taskmanager_backlog_list"]);
    expect(scopedArgs(backlog, "taskmanager_task_pending", { backlog: "other", limit: 5 })).toEqual({ backlog: "needs-journey-book", limit: 5 });
    expect(scopeKeysFor(backlog, "taskmanager_task_pending")).toEqual(["backlog"]);
  });

  it("gives every read a step word and names the subject by its name", () => {
    for (const name of readNamesFor(backlog)) expect(stepWordsFor(backlog)[name]).toBeTruthy();
    expect(aboutLabel(backlog)).toBe("Needs Journey Book");
    expect(emptyWordsFor(backlog)).toContain("Needs Journey Book");
  });
});

describe("the chat about one issue", () => {
  it("reads only its own issue and its own Log", () => {
    expect(readNamesFor(issue)).toEqual(["taskmanager_task_read", "taskmanager_task_note_list"]);
    expect(scopedArgs(issue, "taskmanager_task_read", { taskID: "other" })).toEqual({ taskID: "t1" });
    expect(scopedArgs(issue, "taskmanager_task_note_list", { taskID: "other" })).toEqual({ taskID: "t1" });
  });

  it("gives every read a step word and names the subject by its title", () => {
    for (const name of readNamesFor(issue)) expect(stepWordsFor(issue)[name]).toBeTruthy();
    expect(aboutLabel(issue)).toBe("Fix mirrored board drift");
    expect(choicesFor(issue)).toEqual(["Details", "Log"]);
  });
});
