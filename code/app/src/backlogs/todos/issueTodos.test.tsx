import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { openAgency } from "../../agency/open";
import { IssuePage } from "../IssuePage";
import type { BacklogsClient, IssueDetail, NotesClient } from "../api";
import type { TodosClient } from "./api";
import type { Todo } from "./todoTree";

const detail: IssueDetail = {
  id: "1",
  code: "CLN-2",
  title: "Bring the docs in line",
  description: "Every current page names the new bottom bar.",
  status: "pending",
  step: "In Progress",
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "",
  rank: 1,
  waitsOn: [],
  waitedOnBy: [],
};

const backlogs: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue: async () => detail };

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

const todo = (number: number, over: Partial<Todo> = {}): Todo => ({ id: `t${number}`, number, title: `Piece ${number} title`, status: "pending", waitsOn: [], blockedReason: "", ...over });

const open = (todos: TodosClient) => {
  openAgency({ id: "hub-1", name: "Hub" } as never);
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={backlogs} notesClient={notes} todosClient={todos} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("the todo list on an issue's page", () => {
  it("sits in the issue card, under the description, and reads the todos of that issue", async () => {
    const todos: TodosClient = { list: vi.fn(async () => [todo(1, { status: "completed" }), todo(2, { waitsOn: ["t1"] })]) };
    open(todos);
    await screen.findByText("Piece 1 title");
    const main = document.querySelector(".issue-wide > .issue-main") as HTMLElement;
    expect(within(main).getByText("Todo list")).toBeInTheDocument();
    expect(within(main).getByText("1 of 2 done")).toBeInTheDocument();
    const body = main.querySelector(".issue-body") as HTMLElement;
    const list = main.querySelector(".todos") as HTMLElement;
    expect(body.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(todos.list).toHaveBeenCalledWith("1");
  });

  it("shows the empty line for an issue with no todos", async () => {
    open({ list: async () => [] });
    expect(await screen.findByText("No pieces yet.")).toBeInTheDocument();
  });

  it("says the todo list could not be loaded, with Try again, and keeps the rest of the page", async () => {
    open({ list: async () => Promise.reject(new Error("down")) });
    expect(await screen.findByText("The todo list could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByText("Every current page names the new bottom bar.")).toBeInTheDocument();
    expect(screen.queryByText("No pieces yet.")).toBeNull();
  });
});
