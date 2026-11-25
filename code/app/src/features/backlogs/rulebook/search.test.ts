import { describe, expect, it } from "vitest";
import { rule } from "./rulebookFixture";
import { matchesRule, narrowedRules } from "./search";

const held = [
  rule({ code: "R-1", title: "No comments in code", body: "Names carry the meaning.", tags: ["code", "style"] }),
  rule({ code: "R-2", title: "Font sizes are in rem", body: "One root value.", tags: ["css"] }),
  rule({ code: "D-3", kind: "decision", title: "A good example is a link", body: "No copy goes stale.", tags: ["rules"] }),
];

const codes = (query: string) => narrowedRules(held, query).map((one) => one.code);

describe("searching the loaded rules", () => {
  it("keeps everything for a blank query", () => {
    expect(codes("")).toEqual(["R-1", "R-2", "D-3"]);
    expect(codes("   ")).toEqual(["R-1", "R-2", "D-3"]);
  });

  it("looks through the code, the title, the body and the tags", () => {
    expect(codes("r-2")).toEqual(["R-2"]);
    expect(codes("comments")).toEqual(["R-1"]);
    expect(codes("goes stale")).toEqual(["D-3"]);
    expect(codes("style")).toEqual(["R-1"]);
  });

  it("ignores case", () => {
    expect(codes("FONT")).toEqual(["R-2"]);
    expect(codes("CSS")).toEqual(["R-2"]);
  });

  it("wants every typed word somewhere in the record, in any order", () => {
    expect(codes("root font")).toEqual(["R-2"]);
    expect(codes("font meaning")).toEqual([]);
  });

  it("finds nothing for a word nobody has", () => {
    expect(codes("zebra")).toEqual([]);
  });

  it("matches one record the same way", () => {
    expect(matchesRule(held[0], "meaning code")).toBe(true);
    expect(matchesRule(held[0], "rem")).toBe(false);
  });
});
