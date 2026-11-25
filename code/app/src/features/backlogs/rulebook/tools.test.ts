import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { taskmanagerModuleFile } from "../../../shared/testing/taskmanagerModule";
import { rulebookTools } from "./tools";

const declared = () => {
  const operations = JSON.parse(taskmanagerModuleFile("taskmanager.operations.json"));
  return new Set<string>(Object.values<any>(operations.operations ?? operations).map((one) => String(one.action).replaceAll(".", "_")));
};

const sourceNames = () =>
  readdirSync(__dirname)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .flatMap((name) => [...readFileSync(join(__dirname, name), "utf8").matchAll(/"(taskmanager_[a-z_]+)"/g)].map((found) => found[1]));

describe("the tools the rulebook calls", () => {
  it("are all declared by the pinned taskmanager module", () => {
    const known = declared();
    for (const tool of Object.values(rulebookTools)) expect(known.has(tool), tool).toBe(true);
  });

  it("name every taskmanager tool written anywhere in the folder in that table", () => {
    const known = declared();
    const names = sourceNames();
    expect(names.length).toBeGreaterThanOrEqual(9);
    for (const name of names) expect(known.has(name), name).toBe(true);
  });

  it("pins the nine names the screens call", () => {
    expect(rulebookTools).toEqual({
      backlogRules: "taskmanager_backlog_rules_list",
      backlogDecisions: "taskmanager_backlog_decisions_list",
      backlogQuestions: "taskmanager_backlog_questions_list",
      list: "taskmanager_rule_list",
      read: "taskmanager_rule_read",
      issues: "taskmanager_rule_issue_list",
      files: "taskmanager_rule_file_list",
      produced: "taskmanager_rule_produced_list",
      forIssue: "taskmanager_rule_list_for_issue",
    });
  });
});
