import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIORITIES } from "./fields";

const serverPriorities = (): string[] => {
  const source = readFileSync(resolve(process.cwd(), "../wakala-api/modules/taskmanager/models/task.go"), "utf8");
  return [...source.matchAll(/TaskPriority\w+\s+TaskPriority = "(\w+)"/g)].map((match) => match[1]);
};

describe("the Priority values of a smart backlog rule", () => {
  it("are exactly the priorities the server accepts", () => {
    expect([...PRIORITIES].sort()).toEqual(serverPriorities().sort());
  });
});
