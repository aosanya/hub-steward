import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import * as mcp from "../wakala/mcp";
import { IssuePage } from "./IssuePage";
import { IssueRow } from "./IssueRow";
import { mcpBacklogsClient, taskTools, type BacklogsClient, type Issue, type IssueDetail, type NotesClient } from "./api";

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
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} notesClient={notes} />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));
afterEach(() => vi.restoreAllMocks());

describe("setting an issue's priority from the issue card", () => {
  it("has one button, in the card header beside the title, and no buttons below it", async () => {
    pageWith(async () => undefined);
    const header = (await screen.findByText("Write the manual")).closest(".card-head") as HTMLElement;
    const card = header.closest(".card") as HTMLElement;
    expect(within(header).getByRole("button", { name: /medium/ })).toBeInTheDocument();
    expect(within(card).getAllByRole("button")).toHaveLength(1);
    expect(card.querySelector(".card-foot")).toBeNull();
  });

  it("opens the four values and sets the one chosen, then shows it", async () => {
    const set = vi.fn(async () => undefined);
    pageWith(set);
    await userEvent.click(await screen.findByRole("button", { name: /medium/ }));
    expect(screen.getAllByRole("button").filter((one) => ["critical", "high", "medium", "low"].includes(one.textContent ?? "")).map((one) => one.textContent)).toEqual(["critical", "high", "medium", "low"]);
    await userEvent.click(screen.getByRole("button", { name: "critical" }));
    expect(set).toHaveBeenCalledWith("1", "critical");
    expect(await screen.findByRole("button", { name: /critical/ })).toBeInTheDocument();
  });
});

describe("the priority on a card and a row", () => {
  it("shows the priority as a bubble on the line of a row or board card", () => {
    render(
      <MemoryRouter>
        <IssueRow issue={issue({ priority: "critical" })} chosen={[]} onOpen={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.querySelector(".issue-line")).toHaveTextContent("critical");
  });

  it("shows no bubble when the hub sent no priority", () => {
    render(
      <MemoryRouter>
        <IssueRow issue={issue({ priority: "" })} chosen={[]} onOpen={() => undefined} />
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
