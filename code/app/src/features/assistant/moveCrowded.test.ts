import { describe, expect, it, vi } from "vitest";
import { moveTool, resolveMove } from "./confirm";
import type { ResultDraft } from "./results";

const issues = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `9f1c-uuid-${index + 1}`, key: `WALK-${index + 1}`, title: `walk-02 bulk ${index + 1}`, description: "", status: "open", step: "", repo: "", tags: [] }));

const searched = (total: number, query = "bulk"): ResultDraft => ({ title: "Bulk issues", total, issues: issues(Math.min(total, 25)) as never, filter: { tags: [], query, backlog: "", other: false } });

const move = (taskID: string) => ({ tool: moveTool, arguments: { taskID, backlog: "b1", step: "Doing" } });

const find = vi.fn().mockResolvedValue([]);

const read = vi.fn().mockResolvedValue(undefined);

describe("a move picked out of a word that fits more than six issues", () => {
  it("refuses the card and asks for a narrower word", async () => {
    const resolved = await resolveMove(move("9f1c-uuid-1"), [searched(8)], find, read, "Move the walk-02 bulk to Doing");
    expect(resolved.problem).toContain('8 issues fit "bulk"');
    expect(resolved.problem).toContain("narrower word");
  });

  it("refuses the same pick when the model passes the key", async () => {
    expect((await resolveMove(move("WALK-1"), [searched(8)], find, read, "Move the walk-02 bulk to Doing")).problem).toContain("8 issues fit");
  });

  it("lets six matches through to the card", async () => {
    expect((await resolveMove(move("9f1c-uuid-1"), [searched(6)], find, read, "Move the walk-02 bulk to Doing")).problem).toBe("");
  });

  it("lets the person's own key or full title through", async () => {
    expect((await resolveMove(move("9f1c-uuid-1"), [searched(8)], find, read, "move WALK-1 to Doing")).problem).toBe("");
    expect((await resolveMove(move("9f1c-uuid-1"), [searched(8)], find, read, "Move walk-02 bulk 1 to Doing")).problem).toBe("");
  });

  it("lets a pick from a long list that was not searched by words through", async () => {
    const pending: ResultDraft = { ...searched(724), filter: { tags: ["mwanachama-frontend-kazi"], query: "", backlog: "", other: false } };
    expect((await resolveMove(move("9f1c-uuid-2"), [pending], find, read, "Move 2 to Doing")).problem).toBe("");
  });
});
