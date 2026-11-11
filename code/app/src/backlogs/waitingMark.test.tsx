import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { blockedIsATagRule } from "../assistant/triager";
import { rulesProblem } from "../assistant/ruleCodes";
import { filterDraft } from "../smartBacklog/fromFilter";
import { choicesOf } from "../smartBacklog/api";
import { rulesKey } from "../smartBacklog/rulesKey";
import { textLook } from "../ui/textColor";
import { issueOf, type Issue } from "./api";
import { IssueLine, IssueTags } from "./IssueTitle";

const issue = (over: Partial<Issue>): Issue => ({ id: "a", title: "t", description: "", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Backlog", mark: "", rank: 1, ...over });

describe("Waiting as a mark beside Blocked", () => {
  it("reads the Waiting tag as the Waiting mark and keeps it out of the topics", () => {
    const one = issueOf({ id: "a", status: "pending", tags: ["Docs", "Waiting"] });
    expect(one.mark).toBe("Waiting");
    expect(one.topics).toEqual(["Docs"]);
  });

  it("never carries Waiting and Blocked together, and Blocked wins, then Waiting over Ready", () => {
    expect(issueOf({ id: "a", status: "pending", tags: ["Waiting", "Blocked"] }).mark).toBe("Blocked");
    expect(issueOf({ id: "a", status: "pending", tags: ["Ready", "Waiting"] }).mark).toBe("Waiting");
    expect(issueOf({ id: "a", status: "pending", tags: ["Ready", "Waiting", "Blocked"] }).topics).toEqual([]);
  });

  it("gives settled work no mark even with the Waiting tag", () => {
    expect(issueOf({ id: "a", status: "completed", tags: ["Waiting"] }).mark).toBe("");
  });

  it("reads the hub's waiting flag when the tag is not listed", () => {
    expect(issueOf({ id: "a", status: "pending", waiting: true }).mark).toBe("Waiting");
    expect(issueOf({ id: "a", status: "pending", waiting: true, blocked: true }).mark).toBe("Blocked");
  });

  it("colours Waiting in the amber tone, Sinbin in a deeper orange, Blocked red and Ready green", () => {
    expect(textLook("Waiting")).toEqual({ tone: "waiting" });
    expect(textLook("Sinbin")).toEqual({ tone: "sinbin" });
    expect(textLook("Blocked")).toEqual({ tone: "danger" });
    expect(textLook("Ready")).toEqual({ tone: "success" });
  });

  it("draws the Waiting pill first on a card, in the amber tone, and not in the danger or info tone", () => {
    const { container } = render(<IssueTags issue={issue({ mark: "Waiting", topics: ["Docs"] })} chosen={[]} onTag={() => {}} />);
    const first = container.querySelector(".issue-tags > *")!;
    expect(first.textContent).toBe("Waiting");
    expect(first).toHaveClass("waiting");
    expect(first).not.toHaveClass("danger");
    expect(first).not.toHaveClass("info");
  });

  it("draws the Waiting pill on a row line", () => {
    const { container } = render(<IssueLine issue={issue({ mark: "Waiting" })} chosen={[]} onTag={() => {}} />);
    const first = container.querySelector(".issue-tags > *")!;
    expect(first.textContent).toBe("Waiting");
    expect(first).toHaveClass("waiting");
  });

  it("offers Waiting and Sinbin between Ready and Blocked in the mark choices", () => {
    expect(choicesOf([]).mark).toEqual(["Ready", "Waiting", "Sinbin", "Blocked"]);
  });

  it("turns a chosen Waiting chip into a mark rule", () => {
    expect(filterDraft(["Waiting"], "", []).rules).toEqual([{ field: "mark", operator: "is", value: "Waiting" }]);
  });

  it("keeps Waiting, Ready and Blocked rules apart when comparing rule sets", () => {
    const key = (value: string) => rulesKey({ match: "all", rules: [{ field: "mark", operator: "is", value }] });
    expect(new Set([key("Waiting"), key("waiting"), key("Ready"), key("Blocked")]).size).toBe(3);
  });

  it("lets the assistant write a Waiting mark rule and still refuses an unknown mark", () => {
    expect(rulesProblem([{ field: "mark", operator: "is", value: "Waiting" }])).toBe("");
    expect(rulesProblem([{ field: "mark", operator: "is", value: "waiting" }])).toBe("");
    expect(rulesProblem([{ field: "mark", operator: "is", value: "Stale" }])).toContain("Ready, Waiting, Sinbin or Blocked");
  });

  it("tells the Triager that Waiting and Blocked are separate tags to list apart", () => {
    expect(blockedIsATagRule).toContain("the Waiting tag only");
    expect(blockedIsATagRule).toContain("the Blocked tag only");
    expect(blockedIsATagRule).not.toContain("never the Waiting step");
  });
});
