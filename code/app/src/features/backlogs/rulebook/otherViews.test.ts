import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import { issueViewPath } from "./otherViews";

beforeEach(() => openAgency("hub-1"));

afterEach(() => forgetOpenAgency());

const smart = { id: "s1", name: "Ready", steps: [], issues: 0, kind: "smart" as const };

const plain = { id: "b1", name: "Sprint 1", steps: [], issues: 0 };

describe("the address of the issue views a rulebook list goes back to", () => {
  it("sends All issues to its own view parameter", () => {
    expect(issueViewPath("all", undefined, "board")).toBe("/a/hub-1/backlogs/all");
    expect(issueViewPath("all", undefined, "list")).toBe("/a/hub-1/backlogs/all?view=list");
  });

  it("sends a smart backlog to its smart screen", () => {
    expect(issueViewPath("s1", smart, "board")).toBe("/a/hub-1/backlogs/s1/smart");
    expect(issueViewPath("s1", smart, "list")).toBe("/a/hub-1/backlogs/s1/smart?view=list");
  });

  it("sends a named backlog to its list and its board", () => {
    expect(issueViewPath("b1", plain, "list")).toBe("/a/hub-1/backlogs/b1");
    expect(issueViewPath("b1", plain, "board")).toBe("/a/hub-1/backlogs/b1/board");
    expect(issueViewPath("b1", undefined, "board")).toBe("/a/hub-1/backlogs/b1/board");
  });
});
