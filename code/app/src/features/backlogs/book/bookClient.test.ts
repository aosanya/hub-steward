import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../shared/wakala/mcp";
import { guardedRulebook, mcpRulebookClient, rulebookTools } from "../rulebook";
import { mcpBookClient } from "./bookClient";

afterEach(() => vi.restoreAllMocks());

const raw = (code: string, over: Record<string, unknown> = {}) => ({ id: `id-${code}`, kind: "rule", code, title: `Title ${code}`, status: "in_force", ...over });

const hub = (answer: (tool: string, args: Record<string, unknown>) => unknown) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => answer(tool, args) as never);

const clientFor = (ask: () => Promise<boolean> = async () => true) => mcpBookClient(guardedRulebook(mcpRulebookClient(), ask));

const callsOf = (spy: ReturnType<typeof hub>, tool: string) => spy.mock.calls.filter((call) => call[1] === tool);

describe("the list call of the Book", () => {
  it("makes one rule list call for rules in force and nothing else in it", async () => {
    const spy = hub(() => ({ items: [raw("R-1")] }));
    const answer = await clientFor().rules();
    expect(callsOf(spy, rulebookTools.list)).toEqual([["", rulebookTools.list, { kind: "rule", status: ["in_force"] }]]);
    expect(answer.state).toBe("ready");
  });

  it("sends no backlog id, no tag and no limit", async () => {
    const spy = hub(() => ({ items: [] }));
    await clientFor().rules();
    const args = callsOf(spy, rulebookTools.list)[0][2] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(["kind", "status"]);
    expect(callsOf(spy, rulebookTools.backlogRules)).toEqual([]);
  });

  it("hands back only the rules in force, oldest first, when the hub answer holds others", async () => {
    hub(() => ({
      items: [
        raw("R-3", { created_at: "2026-02-01T00:00:00Z" }),
        raw("R-2", { status: "proposed" }),
        raw("D-1", { kind: "decision", status: "decided" }),
        raw("R-1", { created_at: "2026-01-01T00:00:00Z" }),
      ],
    }));
    const answer = await clientFor().rules();
    expect(answer.state === "ready" ? answer.data.map((one) => one.code) : []).toEqual(["R-1", "R-3"]);
  });

  it("makes no call at all when the viewer may not read rules", async () => {
    const spy = hub(() => ({ items: [raw("R-1")] }));
    const answer = await clientFor(async () => false).rules();
    expect(answer).toEqual({ state: "no_access" });
    expect(callsOf(spy, rulebookTools.list)).toEqual([]);
  });

  it("says failed when the list call fails", async () => {
    hub(() => {
      throw new Error("boom");
    });
    expect((await clientFor().rules()).state).toBe("failed");
  });
});

describe("the references of one rule", () => {
  const answers = (tool: string) => {
    if (tool === rulebookTools.issues)
      return {
        items: [
          { issue_id: "i1", issue_code: "ISS-169", relation: "decided_in" },
          { issue_id: "i2", issue_code: "ISS-300", relation: "applies_to" },
          { issue_id: "i3", issue_code: "ISS-218", relation: "decided_in" },
          { issue_id: "i4", issue_code: "ISS-400", relation: "broken_by" },
        ],
      };
    if (tool === rulebookTools.files)
      return {
        items: [
          { id: "f1", repo: "hub-steward", path: "code/app/src/tokens.css" },
          { id: "f2", repo: "hub-steward", path: "gone.md", missing: true },
        ],
      };
    return { items: [] };
  };

  it("keeps the issues it was decided in and drops the others", async () => {
    hub(answers);
    const refs = await clientFor().refs("R-1");
    expect(refs.cameFrom).toEqual([
      { id: "i1", code: "ISS-169" },
      { id: "i3", code: "ISS-218" },
    ]);
  });

  it("keeps the files in the order added, with their missing mark", async () => {
    hub(answers);
    const refs = await clientFor().refs("R-1");
    expect(refs.files.map((one) => [one.path, one.missing])).toEqual([
      ["code/app/src/tokens.css", false],
      ["gone.md", true],
    ]);
  });

  it("asks once for the issues and once for the files of the code", async () => {
    const spy = hub(answers);
    await clientFor().refs("R-1");
    expect(callsOf(spy, rulebookTools.issues)).toEqual([["", rulebookTools.issues, { ruleCode: "R-1" }]]);
    expect(callsOf(spy, rulebookTools.files)).toEqual([["", rulebookTools.files, { ruleCode: "R-1" }]]);
  });

  it("gives no references and does not throw when both reads fail", async () => {
    hub(() => {
      throw new Error("403 forbidden");
    });
    expect(await clientFor().refs("R-1")).toEqual({ cameFrom: [], files: [] });
  });

  it("keeps the files when only the issue read fails", async () => {
    hub((tool) => {
      if (tool === rulebookTools.issues) throw new Error("403 forbidden");
      return answers(tool);
    });
    const refs = await clientFor().refs("R-1");
    expect(refs.cameFrom).toEqual([]);
    expect(refs.files).toHaveLength(2);
  });
});
