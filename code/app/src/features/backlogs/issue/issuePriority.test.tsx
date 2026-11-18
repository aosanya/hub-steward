import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../../../shared/wakala/openAgency";
import * as mcp from "../../../shared/wakala/mcp";
import { IssuePage } from "./IssuePage";
import { IssueCard } from "../shared/IssueCard";
import { mcpBacklogsClient, taskTools, type BacklogsClient, type Issue, type IssueDetail, type NotesClient } from "../shared/api";

const issue = (over: Partial<Issue>): Issue => ({ id: "1", title: "SW9 Write the manual", description: "Body.", status: "pending", step: "To do", repo: "hub-steward", topics: [], backlog: "Backlog", mark: "Ready", rank: 1, priority: "medium", ...over });

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

const pageWith = (setPriority: BacklogsClient["setPriority"]) => {
  let current: IssueDetail = { ...issue({}), waitsOn: [], waitedOnBy: [] };
  const client: BacklogsClient = {
    backlogs: async () => [],
    issues: async () => [],
    issue: async () => current,
    setPriority: async (id, priority) => {
      await setPriority?.(id, priority);
      current = { ...current, priority };
    },
  };
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

describe("setting an issue's priority from the issue card", () => {
  it("has one button, in the footer of the Details card", async () => {
    pageWith(async () => undefined);
    const details = await screen.findByRole("region", { name: "Details" });
    const foot = details.querySelector(".sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: /Priority: Medium/ })).toBeInTheDocument();
    expect(within(foot).getAllByRole("button")).toHaveLength(1);
  });

  it("has the title as the page title and the code in the quiet line", async () => {
    pageWith(async () => undefined);
    expect(await screen.findByRole("heading", { level: 1, name: "Write the manual" })).toBeInTheDocument();
    expect(document.querySelector(".quiet-line")).toHaveTextContent(/^SW9/);
    expect(document.querySelector(".card-head .issue-code")).toBeNull();
  });

  it("opens the four values and sets the one chosen, then shows it", async () => {
    const set = vi.fn(async () => undefined);
    pageWith(set);
    await userEvent.click(await screen.findByRole("button", { name: /Priority: Medium/ }));
    expect(screen.getAllByRole("button").filter((one) => ["Critical", "High", "Medium", "Low"].includes(one.textContent ?? "")).map((one) => one.textContent)).toEqual(["Critical", "High", "Medium", "Low"]);
    await userEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(set).toHaveBeenCalledWith("1", "critical");
    expect(await screen.findByRole("button", { name: /Priority: Critical/ })).toBeInTheDocument();
  });
});

describe("the priority on a card and a row", () => {
  it("shows the priority in the chip row of a row or board card, not in its header", () => {
    render(
      <MemoryRouter>
        <IssueCard issue={issue({ priority: "critical" })} chosen={[]} onOpen={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.querySelector(".issue-line")).toHaveTextContent("Priority: Critical");
    expect(document.querySelector(".card-head")).not.toHaveTextContent("Critical");
  });

  it("shows no priority chip when the hub sent no priority", () => {
    render(
      <MemoryRouter>
        <IssueCard issue={issue({ priority: "" })} chosen={[]} onOpen={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.querySelector(".issue-line")).not.toHaveTextContent(/critical|high|medium|low/);
  });
});

describe("the hub call", () => {
  it("patches only the priority of the issue", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({} as never);
    await mcpBacklogsClient.setPriority?.("1", "high");
    expect(call).toHaveBeenCalledWith("", taskTools.patch, { taskID: "1", priority: "high" });
  });
});
