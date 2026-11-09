import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Issue } from "./api";
import { IssueTags, IssueTitle, titleParts } from "./IssueTitle";

const issue = (over: Partial<Issue>): Issue => ({ id: "a", title: "t", description: "", status: "pending", step: "", repo: "", topics: [], backlog: "", mark: "", rank: 1, ...over });

describe("an issue's title on a row or card", () => {
  it("splits the code from the title at the first space when it looks like an id", () => {
    expect(titleParts("DEV-009 Create the party plane's structure tables")).toEqual({ code: "DEV-009", rest: "Create the party plane's structure tables" });
    expect(titleParts("SW59 Port the fixes")).toEqual({ code: "SW59", rest: "Port the fixes" });
    expect(titleParts("W74 Port the lock")).toEqual({ code: "W74", rest: "Port the lock" });
  });

  it("leaves a title with no id in front whole", () => {
    expect(titleParts("Create the tables")).toEqual({ code: "", rest: "Create the tables" });
    expect(titleParts("DEV-009")).toEqual({ code: "", rest: "DEV-009" });
  });

  it("shows the title as plain text without backticks or bold marks", () => {
    expect(titleParts("DEV-009 Create `chapter` and **role_kind**")).toEqual({ code: "DEV-009", rest: "Create chapter and role_kind" });
  });

  it("puts the code in its own span so it can take the accent colour", () => {
    render(<IssueTitle title="DEV-009 Create the tables" />);
    expect(screen.getByText("DEV-009")).toHaveClass("issue-code");
  });

  it("shows one bubble for each tag, three for three, and none for none", () => {
    const { container, rerender } = render(<IssueTags issue={issue({ repo: "hub-steward", topics: ["Docs"], backlog: "Backlog" })} chosen={[]} onTag={() => {}} />);
    expect(container.querySelectorAll(".chip")).toHaveLength(3);
    rerender(<IssueTags issue={issue({})} chosen={[]} onTag={() => {}} />);
    expect(container.querySelectorAll(".chip")).toHaveLength(0);
  });
});
