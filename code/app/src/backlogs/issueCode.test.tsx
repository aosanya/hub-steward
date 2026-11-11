import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { issueOf, type Issue } from "./api";
import { IssueRow } from "./IssueRow";
import { titleParts } from "./IssueTitle";
import { matchesQuery } from "./tags";

const issue = (over: Partial<Issue>): Issue => ({ id: "a", title: "t", description: "", status: "pending", step: "", repo: "", topics: [], backlog: "", mark: "", rank: 1, ...over });

describe("an issue's own code", () => {
  it("is read from the hub's code field", () => {
    expect(issueOf({ id: "x", title: "Gives every new issue its number", code: "SW193", status: "pending" }).code).toBe("SW193");
    expect(issueOf({ id: "x", title: "No code yet", status: "pending" }).code).toBeUndefined();
  });

  it("shows on the card as the code even when the title does not start with it", () => {
    render(<IssueRow issue={issue({ title: "Gives every new issue its number", code: "SW193" })} chosen={[]} />);
    expect(screen.getByText("SW193")).toHaveClass("issue-code");
    expect(screen.getByText(/Gives every new issue its number/)).toBeInTheDocument();
  });

  it("shows once when the title starts with the same code", () => {
    render(<IssueRow issue={issue({ title: "SW193 Gives every new issue its number", code: "SW193" })} chosen={[]} />);
    expect(screen.getAllByText(/SW193/)).toHaveLength(1);
  });

  it("wins over the code a title starts with, and the title is kept whole", () => {
    expect(titleParts("DEV-127 Create the tables", "DEV-130")).toEqual({ code: "DEV-130", rest: "DEV-127 Create the tables" });
    expect(titleParts("DEV-127 Create the tables", "DEV-127")).toEqual({ code: "DEV-127", rest: "Create the tables" });
    expect(titleParts("Create the tables", "DEV-127")).toEqual({ code: "DEV-127", rest: "Create the tables" });
  });

  it("falls back to the code a title starts with when the hub sent none", () => {
    expect(titleParts("DEV-127 Create the tables")).toEqual({ code: "DEV-127", rest: "Create the tables" });
  });

  it("is found by the search box even when the title does not carry it", () => {
    const one = issue({ title: "Gives every new issue its number", code: "SW193" });
    expect(matchesQuery(one, "sw193")).toBe(true);
    expect(matchesQuery(one, "sw194")).toBe(false);
  });
});
