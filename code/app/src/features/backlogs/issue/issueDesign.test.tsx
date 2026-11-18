import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../../../shared/wakala/openAgency";
import { IssuePage } from "./IssuePage";
import type { BacklogsClient, Issue, IssueDetail, NotesClient } from "../shared/api";

const base: Issue = { id: "1", code: "SW9", title: "SW9 Write the manual", description: "Body.", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Backlog", mark: "Ready", rank: 1, priority: "medium", effort: "low" };

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

const page = () => {
  const detail: IssueDetail = { ...base, waitsOn: [], waitedOnBy: [] };
  const client: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue: async () => detail, setPriority: async () => undefined, setEffort: async () => undefined };
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} notesClient={notes} todosClient={{ list: async () => [] }} />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));
afterEach(() => vi.restoreAllMocks());

describe("the issue page follows the menu design", () => {
  it("has the issue name as the page title and one quiet line with the code and the step", async () => {
    page();
    expect(await screen.findByRole("heading", { level: 1, name: "Write the manual" })).toBeInTheDocument();
    expect(screen.getByText(/^SW9 · To do/)).toHaveClass("quiet-line");
  });

  it("has no card header that repeats the code", async () => {
    page();
    await screen.findByRole("heading", { level: 1, name: "Write the manual" });
    expect(document.querySelector(".card-head .issue-code")).toBeNull();
  });

  it("shows Priority and Effort as label and value rows of a Details card", async () => {
    page();
    const details = await screen.findByRole("region", { name: "Details" });
    expect(within(details).getByText("Priority")).toBeInTheDocument();
    expect(within(details).getByText("Medium")).toBeInTheDocument();
    expect(within(details).getByText("Effort")).toBeInTheDocument();
    expect(within(details).getByText("Low")).toBeInTheDocument();
  });

  it("puts the Priority and Effort menus in the Details card footer, two items", async () => {
    page();
    const details = await screen.findByRole("region", { name: "Details" });
    const foot = details.querySelector(".sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: /Priority: Medium/ })).toBeInTheDocument();
    expect(within(foot).getByRole("button", { name: /Effort: Low/ })).toBeInTheDocument();
    expect(within(foot).getAllByRole("button")).toHaveLength(2);
  });
});
