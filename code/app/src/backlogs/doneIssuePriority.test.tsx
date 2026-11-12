import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import { IssuePage } from "./IssuePage";
import { IssueCard } from "./IssueCard";
import type { BacklogsClient, Issue, IssueDetail, NotesClient } from "./api";

const issue = (over: Partial<Issue>): Issue => ({ id: "1", title: "SW9 Write the manual", description: "Body.", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Backlog", mark: "Ready", rank: 1, priority: "high", ...over });

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

const pageOf = (main: Issue, waitedOnBy: Issue[]) => {
  const detail: IssueDetail = { ...main, waitsOn: [], waitedOnBy };
  const client: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue: async () => detail, setPriority: async () => undefined };
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} notesClient={notes} />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));
afterEach(() => vi.restoreAllMocks());

describe("the priority of an issue in Done", () => {
  it("is a plain pill on a card, with no dropdown", () => {
    render(
      <MemoryRouter>
        <IssueCard issue={issue({ status: "completed", step: "Done" })} chosen={[]} onPriority={async () => undefined} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Priority/ })).toBeNull();
    expect(document.querySelector(".issue-line")).toHaveTextContent("Priority: High");
  });

  it("is a dropdown again on a card once the issue is back in an open step", () => {
    render(
      <MemoryRouter>
        <IssueCard issue={issue({ status: "pending", step: "To do" })} chosen={[]} onPriority={async () => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Priority: High/ })).toBeInTheDocument();
  });

  it("is a plain pill on the issue page of a Done issue", async () => {
    pageOf(issue({ status: "completed", step: "Done" }), []);
    expect(await screen.findByText("Priority: High")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Priority/ })).toBeNull();
  });

  it("is a plain pill on a Done issue in the Waited on by list, a dropdown on an open one", async () => {
    pageOf(issue({ id: "9", status: "pending", step: "To do", priority: "critical" }), [
      issue({ id: "2", title: "ISS-106 Finished", code: "ISS-106", status: "completed", step: "Done", priority: "high" }),
      issue({ id: "3", title: "ISS-107 Open", code: "ISS-107", status: "pending", step: "To do", priority: "low" }),
    ]);
    expect(await screen.findByText("Priority: High")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Priority: High/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Priority: Low/ })).toBeInTheDocument();
  });
});
