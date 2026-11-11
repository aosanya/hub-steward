import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { blockedIsATagRule } from "../assistant/triager";
import { ruleCodesLine, rulesProblem } from "../assistant/ruleCodes";
import { filterDraft } from "../smartBacklog/fromFilter";
import { choicesOf } from "../smartBacklog/api";
import { rulesKey } from "../smartBacklog/rulesKey";
import { issueOf, type Issue } from "./api";
import { IssueLine, IssueTags } from "./IssueTitle";
import { markNames } from "./marks";

const issue = (over: Partial<Issue>): Issue => ({ id: "a", title: "t", description: "", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Backlog", mark: "", rank: 1, ...over });

describe("Sinbin as a mark beside Ready, Waiting and Blocked", () => {
  it("reads the Sinbin tag as the Sinbin mark and keeps it out of the topics", () => {
    const one = issueOf({ id: "a", status: "pending", tags: ["Docs", "Sinbin"] });
    expect(one.mark).toBe("Sinbin");
    expect(one.topics).toEqual(["Docs"]);
  });

  it("lets Blocked win over Sinbin, and Sinbin win over Waiting and Ready", () => {
    expect(issueOf({ id: "a", status: "pending", tags: ["Sinbin", "Blocked"] }).mark).toBe("Blocked");
    expect(issueOf({ id: "a", status: "pending", tags: ["Waiting", "Sinbin"] }).mark).toBe("Sinbin");
    expect(issueOf({ id: "a", status: "pending", tags: ["Ready", "Sinbin"] }).mark).toBe("Sinbin");
    expect(issueOf({ id: "a", status: "pending", tags: ["Ready", "Waiting", "Sinbin", "Blocked"] }).topics).toEqual([]);
  });

  it("gives settled work no mark even with the Sinbin tag", () => {
    expect(issueOf({ id: "a", status: "cancelled", tags: ["Sinbin"] }).mark).toBe("");
  });

  it("reads the hub's sinbin flag when the tag is not listed", () => {
    expect(issueOf({ id: "a", status: "pending", sinbin: true }).mark).toBe("Sinbin");
    expect(issueOf({ id: "a", status: "pending", sinbin: true, blocked: true }).mark).toBe("Blocked");
    expect(issueOf({ id: "a", status: "pending", sinbin: true, waiting: true }).mark).toBe("Sinbin");
  });

  it("draws the Sinbin pill first on a card, in its own tone", () => {
    const { container } = render(<IssueTags issue={issue({ mark: "Sinbin", topics: ["Docs"] })} chosen={[]} onTag={() => {}} />);
    const first = container.querySelector(".issue-tags > *")!;
    expect(first.textContent).toBe("Sinbin");
    expect(first).toHaveClass("sinbin");
    expect(first).not.toHaveClass("waiting");
    expect(first).not.toHaveClass("danger");
  });

  it("draws the Sinbin pill on a row line", () => {
    const { container } = render(<IssueLine issue={issue({ mark: "Sinbin" })} chosen={[]} onTag={() => {}} />);
    const first = container.querySelector(".issue-tags > *")!;
    expect(first.textContent).toBe("Sinbin");
    expect(first).toHaveClass("sinbin");
  });

  it("lists Sinbin between Waiting and Blocked", () => {
    expect([...markNames]).toEqual(["Ready", "Waiting", "Sinbin", "Blocked"]);
    expect(choicesOf([]).mark).toEqual(["Ready", "Waiting", "Sinbin", "Blocked"]);
  });

  it("turns a chosen Sinbin chip into a mark rule", () => {
    expect(filterDraft(["Sinbin"], "", []).rules).toEqual([{ field: "mark", operator: "is", value: "Sinbin" }]);
  });

  it("keeps Sinbin apart from the other marks when comparing rule sets", () => {
    const key = (value: string) => rulesKey({ match: "all", rules: [{ field: "mark", operator: "is", value }] });
    expect(key("sinbin")).toBe(key("Sinbin"));
    expect(new Set([key("Sinbin"), key("Waiting"), key("Ready"), key("Blocked")]).size).toBe(4);
  });

  it("lets the assistant write a Sinbin mark rule and names Sinbin when it refuses an unknown mark", () => {
    expect(rulesProblem([{ field: "mark", operator: "is", value: "Sinbin" }])).toBe("");
    expect(rulesProblem([{ field: "mark", operator: "is", value: "sinbin" }])).toBe("");
    expect(rulesProblem([{ field: "mark", operator: "is", value: "Stale" }])).toContain("Ready, Waiting, Sinbin or Blocked");
    expect(ruleCodesLine).toContain("Ready, Waiting, Sinbin or Blocked for mark");
  });

  it("tells the Triager that Sinbin is a tag of its own, set when a worker stops at a cap", () => {
    expect(blockedIsATagRule).toContain("the Sinbin tag only");
    expect(blockedIsATagRule).toContain("stopped at a cap");
  });
});
