import { describe, expect, it } from "vitest";
import { inBook } from "./bookRules";
import { dated, numbered } from "./bookFixture";

const codes = (rules: { code: string }[]) => rules.map((one) => one.code);

describe("what the Book keeps", () => {
  it("keeps only rules in force", () => {
    const held = [
      numbered(1),
      numbered(2, { status: "proposed" }),
      numbered(3, { status: "superseded" }),
      numbered(4, { status: "retired" }),
      numbered(5, { kind: "decision", status: "in_force" }),
      numbered(6, { kind: "question", status: "open" }),
    ];
    expect(codes(inBook(held))).toEqual(["R-1"]);
  });

  it("keeps a decision out even when it carries the in-force status", () => {
    expect(inBook([dated({ kind: "decision", code: "D-1" })])).toEqual([]);
  });

  it("keeps nothing for an empty answer", () => {
    expect(inBook([])).toEqual([]);
  });
});

describe("the order of the Book", () => {
  it("puts the oldest rule first by its creation time", () => {
    const held = [numbered(1, { createdAt: "2026-03-01T00:00:00Z" }), numbered(2, { createdAt: "2026-01-01T00:00:00Z" }), numbered(3, { createdAt: "2026-02-01T00:00:00Z" })];
    expect(codes(inBook(held))).toEqual(["R-2", "R-3", "R-1"]);
  });

  it("orders equal times by the number in the code, not by the text", () => {
    const same = "2026-01-01T00:00:00Z";
    const held = [numbered(10, { createdAt: same }), numbered(9, { createdAt: same }), numbered(2, { createdAt: same })];
    expect(codes(inBook(held))).toEqual(["R-2", "R-9", "R-10"]);
  });

  it("puts a rule with no creation time after the dated ones, by code number", () => {
    const held = [numbered(1, { createdAt: "" }), numbered(5, { createdAt: "2026-01-01T00:00:00Z" }), numbered(2, { createdAt: "" })];
    expect(codes(inBook(held))).toEqual(["R-5", "R-1", "R-2"]);
  });

  it("does not change the list it was given", () => {
    const held = [numbered(2), numbered(1)];
    inBook(held);
    expect(codes(held)).toEqual(["R-2", "R-1"]);
  });
});
