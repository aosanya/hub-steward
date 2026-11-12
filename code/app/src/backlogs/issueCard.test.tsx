import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import { BacklogBoard } from "../backlogBoard/BacklogBoard";
import { IssuePage } from "./IssuePage";
import { IssuesPage } from "./IssuesPage";
import type { Backlog, BacklogsClient, Issue, IssueDetail } from "./api";

const issue = (id: string, title: string, over: Partial<Issue> = {}): Issue => ({
  id,
  title,
  description: "Text",
  status: "pending",
  step: "To do",
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "Blocked",
  rank: 1,
  priority: "high",
  createdAt: "2026-11-10T10:00:00Z",
  ...over,
});

const one = issue("1", "DEV-009 Create the tables");
const other = issue("2", "DEV-010 Fix the route", { priority: "low" });
const backlog: Backlog = { id: "backlog", name: "Backlog", steps: ["To do", "Done"], issues: 2 };
const detail: IssueDetail = { ...one, waitsOn: [other], waitedOnBy: [issue("3", "DEV-011 Follow up")] };

const clientWith = (setPriority?: BacklogsClient["setPriority"]): BacklogsClient => ({ backlogs: async () => [backlog], issues: async () => [one, other], issue: async () => detail, setPriority });

const at = (path: string, element: JSX.Element, route: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );

const board = (client: BacklogsClient) => at("/a/hub-1/backlogs/backlog/board", <BacklogBoard client={client} />, "/a/:agencyId/backlogs/:backlogId/board");

const list = (client: BacklogsClient) => at("/a/hub-1/backlogs/backlog", <IssuesPage client={client} />, "/a/:agencyId/backlogs/:backlogId");

const page = (client: BacklogsClient) => at("/a/hub-1/backlogs/issue/1", <IssuePage client={client} />, "/a/:agencyId/backlogs/issue/:issueId");

const shapeOf = (card: Element) => {
  const head = card.querySelector(":scope > .card-head") as HTMLElement;
  const body = card.querySelector(":scope > .card-body") as HTMLElement;
  expect(head).not.toBeNull();
  expect(body).not.toBeNull();
  expect(head.querySelector(".issue-code")).toHaveTextContent(/^DEV-\d+$/);
  expect(head.querySelector(".issue-title")).toBeNull();
  expect(body.firstElementChild?.querySelector(".issue-title") ?? body.firstElementChild).toHaveTextContent(/^(Create the tables|Fix the route|Follow up)$/);
  expect(within(head).queryByRole("button")).toBeNull();
  expect(head).not.toHaveTextContent(/\b(Critical|High|Medium|Low)\b/);
  expect(within(body).getAllByRole("button", { name: /^Priority: (Critical|High|Medium|Low)/ })).toHaveLength(1);
  expect(card.querySelector(".card-foot")).toBeNull();
  expect(body.querySelector(".issue-tags")).not.toBeNull();
  expect(body).toHaveTextContent("Blocked");
  return { head, body };
};

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

describe("every issue card has a header with the code, a rule and a body", () => {
  it("a card of the board", async () => {
    board(clientWith(async () => undefined));
    await screen.findByText("DEV-009");
    const cards = document.querySelectorAll(".bb-col .card");
    expect(cards).toHaveLength(2);
    cards.forEach(shapeOf);
    expect(document.querySelectorAll(".bb-col .card .card")).toHaveLength(0);
  });

  it("a card of the list", async () => {
    list(clientWith(async () => undefined));
    await screen.findByText("DEV-009");
    const cards = document.querySelectorAll(".issue-cards .card");
    expect(cards).toHaveLength(2);
    cards.forEach(shapeOf);
    expect(document.querySelector(".rows")).toBeNull();
  });

  it("what an issue waits on and what waits on it", async () => {
    page(clientWith(async () => undefined));
    await screen.findByText("Waits on");
    const cards = document.querySelectorAll(".issue-side .issue-row .card");
    expect(cards).toHaveLength(2);
    cards.forEach(shapeOf);
  });

  it("the top of the issue page", async () => {
    page(clientWith(async () => undefined));
    await screen.findByText("Waits on");
    shapeOf(document.querySelector(".issue-main > .card") as Element);
  });
});

describe("the priority button on a card", () => {
  it("opens Critical, High, Medium and Low, sets the one chosen and shows it without opening the issue", async () => {
    const set = vi.fn(async () => undefined);
    list(clientWith(set));
    await screen.findByText("DEV-009");
    const first = document.querySelector(".issue-cards .card") as HTMLElement;
    await userEvent.click(within(first).getByRole("button", { name: /Priority: High/ }));
    expect(screen.getAllByRole("button").filter((button) => ["Critical", "High", "Medium", "Low"].includes(button.textContent ?? "")).map((button) => button.textContent)).toEqual(["Critical", "High", "Medium", "Low"]);
    await userEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(set).toHaveBeenCalledWith("1", "critical");
    expect(screen.queryByText("Waits on")).toBeNull();
  });

  it("is a plain label, not a button, when the client cannot set a priority", async () => {
    board(clientWith(undefined));
    await screen.findByText("DEV-009");
    const line = document.querySelector(".bb-col .card .issue-line") as HTMLElement;
    expect(line).toHaveTextContent("Priority: High");
    expect(within(line).queryByRole("button", { name: /Priority: High/ })).toBeNull();
  });

  it("says so in the card when the priority was not changed", async () => {
    list(clientWith(async () => Promise.reject(new Error("no"))));
    await screen.findByText("DEV-009");
    const first = document.querySelector(".issue-cards .card") as HTMLElement;
    await userEvent.click(within(first).getByRole("button", { name: /Priority: High/ }));
    await userEvent.click(screen.getByRole("button", { name: "Medium" }));    expect(await within(first).findByRole("alert")).toHaveTextContent("The priority was not changed.");
  });
});
