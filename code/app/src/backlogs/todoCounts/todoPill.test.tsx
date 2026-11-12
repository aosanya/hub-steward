import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../../agency/open";
import { BacklogBoard } from "../../backlogBoard/BacklogBoard";
import type { Backlog, BacklogsClient, Issue } from "../api";
import { IssueCard } from "../IssueCard";
import { IssuesPage } from "../IssuesPage";
import type { TodoCountsClient } from "./api";
import { TodoCountScope } from "./TodoCountScope";

const issue = (id: string, over: Partial<Issue> = {}): Issue => ({
  id,
  title: `DEV-00${id} Piece ${id}`,
  description: "Text",
  status: "pending",
  step: "To do",
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "Ready",
  rank: Number(id),
  priority: "high",
  effort: "low",
  createdAt: "2026-11-10T10:00:00Z",
  ...over,
});

const counts = (answer: Record<string, { done: number; total: number }> | Error) => {
  const read = vi.fn(async (_ids: string[]) => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const client: TodoCountsClient = { counts: read };
  return { client, read };
};

const cards = (issues: Issue[], client: TodoCountsClient) => (
  <TodoCountScope issues={issues} client={client}>
    {issues.map((one) => (
      <IssueCard key={one.id} issue={one} chosen={[]} />
    ))}
  </TodoCountScope>
);

const rowOf = (id: string) => document.querySelectorAll(".issue-row")[Number(id) - 1] as HTMLElement;

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

describe("a card shows its todo count next to its priority and effort", () => {
  it("shows 2 of 6 on a card with todos", async () => {
    render(cards([issue("1")], counts({ 1: { done: 2, total: 6 } }).client));
    expect(await screen.findByText("2 of 6")).toBeInTheDocument();
    const row = rowOf("1");
    expect(row).toHaveTextContent("High");
    expect(row).toHaveTextContent("Low");
    expect(row).toHaveTextContent("2 of 6");
  });

  it("shows no pill on a card without todos", async () => {
    const { client, read } = counts({ 1: { done: 2, total: 6 } });
    render(cards([issue("1"), issue("2")], client));
    await screen.findByText("2 of 6");
    expect(rowOf("2")).not.toHaveTextContent(/\d+ of \d+/);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("shows no pill, and no wrong one, when the count read fails", async () => {
    const { client, read } = counts(new Error("down"));
    render(cards([issue("1")], client));
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    await Promise.resolve();
    expect(rowOf("1")).not.toHaveTextContent(/\d+ of \d+/);
    expect(rowOf("1")).toHaveTextContent("High");
  });

  it("asks once for all the cards on the screen", async () => {
    const { client, read } = counts({ 1: { done: 0, total: 2 }, 3: { done: 4, total: 4 } });
    render(cards([issue("1"), issue("2"), issue("3")], client));
    await screen.findByText("4 of 4");
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(["1", "2", "3"]);
    expect(rowOf("1")).toHaveTextContent("0 of 2");
  });

  it("shows no pill outside a scope", () => {
    render(<IssueCard issue={issue("1")} chosen={[]} />);
    expect(rowOf("1")).not.toHaveTextContent(/\d+ of \d+/);
  });
});

const backlog: Backlog = { id: "backlog", name: "Backlog", steps: ["To do", "Done"], issues: 2 };

const client = (): BacklogsClient => ({ backlogs: async () => [backlog], issues: async () => [issue("1"), issue("2")], issue: async () => ({ ...issue("1"), waitsOn: [], waitedOnBy: [] }) });

describe("the board asks for the counts, the list does not", () => {
  it("the board shows the pill from one read for its cards", async () => {
    const { client: todos, read } = counts({ 1: { done: 2, total: 6 } });
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/backlog/board"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/:backlogId/board" element={<BacklogBoard client={client()} todoCounts={todos} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("2 of 6")).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(["1", "2"]);
  });

  it("the list rows show no pill and ask for nothing", async () => {
    const { client: todos, read } = counts({ 1: { done: 2, total: 6 } });
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/all?view=list"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/:backlogId" element={<IssuesPage client={client()} todoCounts={todos} />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("DEV-001");
    expect(document.body).not.toHaveTextContent("2 of 6");
    expect(read).not.toHaveBeenCalled();
  });

  it("the board of All issues shows the pill", async () => {
    const { client: todos } = counts({ 2: { done: 1, total: 3 } });
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/all"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/:backlogId" element={<IssuesPage client={client()} todoCounts={todos} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("1 of 3")).toBeInTheDocument();
  });
});
