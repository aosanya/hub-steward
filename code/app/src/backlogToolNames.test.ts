import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const hub = resolve(process.cwd(), "../wakala-api");

const folders = ["backlogs", "backlogPage", "backlogBoard", "backlogManage", "backlogAccess", "chat/backlogCards"];

const modules = ["taskmanager", "actor", "agency", "comm", "permissions"];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const sourceFiles = () =>
  folders.flatMap((folder) => walk(resolve(process.cwd(), "src", folder))).filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));

const toolNamesInSource = () => {
  const names = new Map<string, string>();
  for (const path of sourceFiles()) {
    for (const found of readFileSync(path, "utf8").matchAll(/"([a-z]+_[a-z_]+)"/g)) {
      if (modules.includes(found[1].split("_")[0])) names.set(found[1], path);
    }
  }
  return names;
};

const declaredByOperations = () => {
  const names = new Set<string>();
  for (const module of readdirSync(join(hub, "modules"))) {
    const dir = join(hub, "modules", module);
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".operations.json"))) {
      const operations = JSON.parse(readFileSync(join(dir, file), "utf8"));
      for (const one of Object.values<any>(operations.operations ?? operations)) {
        if (typeof one?.tool === "string") names.add(one.tool);
        else if (typeof one?.action === "string") names.add(one.action.replaceAll(".", "_"));
      }
    }
  }
  return names;
};

const declaredInGo = () => {
  const names = new Set<string>();
  for (const path of walk(join(hub, "internal/api/http")).filter((file) => file.endsWith(".go") && !file.endsWith("_test.go"))) {
    for (const found of readFileSync(path, "utf8").matchAll(/mcp\.Tool\{Name:\s*"([a-z_]+)"/g)) names.add(found[1]);
  }
  return names;
};

describe("the tools the backlog screens call", () => {
  const used = toolNamesInSource();

  it("finds the tool names in the source of every backlog screen folder", () => {
    expect(used.size).toBeGreaterThanOrEqual(15);
    for (const prefix of ["backlogs/", "backlogManage/", "backlogAccess/"]) {
      expect([...used.values()].some((path) => path.includes(`/${prefix}`)), prefix).toBe(true);
    }
  });

  it("calls only tools the hub declares in an operations file or registers by hand", () => {
    const declared = new Set([...declaredByOperations(), ...declaredInGo()]);
    const unknown = [...used.entries()].filter(([name]) => !declared.has(name)).map(([name, path]) => `${name} in ${path.slice(path.indexOf("/src/") + 1)}`);
    expect(unknown).toEqual([]);
  });
});
