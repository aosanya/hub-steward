import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { issueOf, type Issue } from "./api";
import { IssueRow } from "./IssueRow";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const issue = (over: Partial<Issue>): Issue => ({ id: "a", title: "t", description: "", status: "pending", step: "To do", repo: "taskmanager", topics: ["Docs"], backlog: "Backlog", mark: "", rank: 1, ...over });
const show = (one: Issue, open = true) => render(<MemoryRouter><IssueRow issue={one} chosen={[]} onOpen={open ? () => undefined : undefined} /></MemoryRouter>);

describe("an issue's age", () => {
  it("is read from the hub's created_at and completed_at", () => {
    const one = issueOf({ id: "x", title: "t", status: "completed", created_at: "2026-11-09T09:00:00Z", completed_at: "2026-11-11T09:00:00Z" });
    expect(one.createdAt).toBe("2026-11-09T09:00:00Z");
    expect(one.completedAt).toBe("2026-11-11T09:00:00Z");
  });

  it("shows on a row of a list, after the repo and backlog bubbles", () => {
    show(issue({ createdAt: minutesAgo(40) }));
    const bubble = screen.getByText("40 min");
    expect(bubble.className).toBe("chip");
    expect(bubble.previousElementSibling?.textContent).toBe("Backlog");
  });

  it("shows on the issue page's card line, with the exact time as its title", () => {
    show(issue({ createdAt: minutesAgo(3 * 24 * 60 + 5) }), false);
    expect(screen.getByText("3 days").getAttribute("title")).toMatch(/^Created /);
  });

  it("shows how long a Done issue took, not a growing age", () => {
    show(issue({ status: "completed", createdAt: "2020-01-01T00:00:00Z", completedAt: "2020-01-03T00:00:00Z" }));
    expect(screen.getByText("2 days")).toBeTruthy();
  });

  it("shows how long a Cancelled issue took", () => {
    show(issue({ status: "cancelled", createdAt: "2020-01-01T00:00:00Z", completedAt: "2020-01-01T05:40:00Z" }));
    expect(screen.getByText("5 h")).toBeTruthy();
  });

  it("shows no bubble for an issue with no created_at", () => {
    const { container } = show(issue({}));
    expect(container.querySelector(".issue-tags .chip:last-child")?.textContent).toBe("Backlog");
  });
});
