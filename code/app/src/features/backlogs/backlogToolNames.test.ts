import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const hub = resolve(process.cwd(), "../wakala-api");

const folders = ["features/backlogs"];

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

const rosterDir = join(hub, "internal/api/http/testdata/mcp_roster");

const declaredInRoster = () => {
  const names = new Set<string>();
  for (const file of readdirSync(rosterDir).filter((name) => name.endsWith(".txt"))) {
    for (const line of readFileSync(join(rosterDir, file), "utf8").split("\n")) {
      if (line.trim() !== "") names.add(line.trim());
    }
  }
  return names;
};

describe("the tools the backlog screens call", () => {
  const used = toolNamesInSource();

  it("finds the tool names in the source of every backlog screen folder", () => {
    expect(used.size).toBeGreaterThanOrEqual(15);
    for (const prefix of ["backlogs/", "backlogs/manage/", "backlogs/access/"]) {
      expect([...used.values()].some((path) => path.includes(`/${prefix}`)), prefix).toBe(true);
    }
  });

  it("calls only tools the hub lists in its pinned tool roster", () => {
    const declared = declaredInRoster();
    const unknown = [...used.entries()].filter(([name]) => !declared.has(name)).map(([name, path]) => `${name} in ${path.slice(path.indexOf("/src/") + 1)}`);
    expect(unknown).toEqual([]);
  });
});
