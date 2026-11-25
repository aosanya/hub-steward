import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../shared/wakala/mcp";
import { askMayReadRules, guardedRulebook, mayReadRulesIn, readRulesPermission } from "./access";
import type { RulebookClient } from "./types";

afterEach(() => vi.restoreAllMocks());

describe("who may read rules", () => {
  it("asks for rule.read", () => {
    expect(readRulesPermission).toBe("rule.read");
  });

  it("is true when the roles list rule.read", () => {
    expect(mayReadRulesIn({ permissions: ["task.read", "rule.read"] })).toBe(true);
  });

  it("is true for an owner, whose reply lists every code", () => {
    expect(mayReadRulesIn({ permissions: ["task.read", "task.edit", "rule.read", "rule.edit", "backlog.manage"] })).toBe(true);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
    ["null permissions", { permissions: null }],
    ["a string reply", "rule.read"],
    ["a string of permissions", { permissions: "rule.read" }],
    ["an error object", new Error("offline")],
    ["an error reply", { error: "forbidden" }],
  ])("fails closed for %s", (_name, reply) => {
    expect(mayReadRulesIn(reply)).toBe(false);
  });

  it("is false when the list lacks rule.read", () => {
    expect(mayReadRulesIn({ permissions: ["task.read"] })).toBe(false);
    expect(mayReadRulesIn({ permissions: [] })).toBe(false);
  });

  it("reads the roles of the viewer with agency_get_my_roles", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ permissions: ["rule.read"] } as never);
    expect(await askMayReadRules()).toBe(true);
    expect(call).toHaveBeenCalledWith("", "agency_get_my_roles");
  });
});

const inner = (): RulebookClient => ({
  list: vi.fn(async () => ({ state: "ready", data: [] })),
  read: vi.fn(),
  issues: vi.fn(),
  files: vi.fn(),
  produced: vi.fn(),
  settledIn: vi.fn(),
  why: vi.fn(),
  open: vi.fn(),
} as unknown as RulebookClient);

describe("a client behind the rule.read pre-check", () => {
  it("answers no access to every call and asks the hub for nothing when the viewer may not read", async () => {
    const client = inner();
    const guarded = guardedRulebook(client, async () => false);
    expect(await guarded.list("b1", "rule")).toEqual({ state: "no_access" });
    expect(await guarded.read("R-2")).toEqual({ state: "no_access" });
    expect(await guarded.issues("R-2")).toEqual({ state: "no_access" });
    expect(await guarded.files("R-2")).toEqual({ state: "no_access" });
    expect(await guarded.produced("D-3")).toEqual({ state: "no_access" });
    expect(await guarded.settledIn("D-3")).toEqual({ state: "no_access" });
    expect(await guarded.why("R-2")).toEqual({ state: "no_access" });
    expect(await guarded.open("R-2")).toEqual({ state: "no_access" });
    for (const method of Object.values(client)) expect(method).not.toHaveBeenCalled();
  });

  it("passes the call through when the viewer may read", async () => {
    const client = inner();
    const guarded = guardedRulebook(client, async () => true);
    expect(await guarded.list("b1", "rule", { statuses: ["in_force"] })).toEqual({ state: "ready", data: [] });
    expect(client.list).toHaveBeenCalledWith("b1", "rule", { statuses: ["in_force"] });
  });

  it("says failed, not no access, when the roles cannot be read", async () => {
    const guarded = guardedRulebook(inner(), async () => {
      throw new Error("offline");
    });
    expect(await guarded.list("b1", "rule")).toEqual({ state: "failed" });
  });
});
