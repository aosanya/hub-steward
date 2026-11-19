import { describe, expect, it } from "vitest";
import { taskmanagerModuleFile } from "../../../shared/testing/taskmanagerModule";
import { PRIORITIES } from "./fields";

const serverPriorities = (): string[] => {
  const source = taskmanagerModuleFile("models/task.go");
  return [...source.matchAll(/TaskPriority\w+\s+TaskPriority = "(\w+)"/g)].map((match) => match[1]);
};

describe("the Priority values of a smart backlog rule", () => {
  it("are exactly the priorities the server accepts", () => {
    expect([...PRIORITIES].sort()).toEqual(serverPriorities().sort());
  });
});
