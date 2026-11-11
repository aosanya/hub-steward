import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  topics: ["Docs"],
  backlog: "Backlog",
  mark: "Ready",
  rank: 1,
  ...over,
});

const one = issue("1", "DEV-009 Create the tables");
const other = issue("2", "DEV-010 Fix the route");
const backlog: Backlog = { id: "backlog", name: "Backlog", steps: ["To do", "Done"], issues: 2 };
const detail: IssueDetail = { ...one, waitsOn: [other], waitedOnBy: [issue("3", "DEV-011 Follow up")] };

const client: BacklogsClient = { backlogs: async () => [backlog], issues: async () => [one, other], issue: async () => detail };

const at = (path: string, element: JSX.Element, route: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

describe("every place that shows an issue draws it through the one shared row", () => {
  it("the list of all issues and a search result", async () => {
    at("/a/hub-1/backlogs/all?q=route&view=list", <IssuesPage client={client} />, "/a/:agencyId/backlogs/:backlogId");
    await screen.findByText("DEV-010");
    expect(document.querySelectorAll(".rows > .issue-row")).toHaveLength(1);
  });

  it("the cards of the board", async () => {
    at("/a/hub-1/backlogs/backlog/board", <BacklogBoard client={client} />, "/a/:agencyId/backlogs/:backlogId/board");
    await screen.findByText("DEV-009");
    const cards = document.querySelectorAll(".bb-card");
    expect(cards).toHaveLength(2);
    cards.forEach((card) => expect(card.querySelector(".issue-row")).not.toBeNull());
  });

  it("the top of an issue's page, what it waits on and what waits on it", async () => {
    at("/a/hub-1/backlogs/issue/1", <IssuePage client={client} />, "/a/:agencyId/backlogs/issue/:issueId");
    await screen.findByText("Waits on");
    expect(document.querySelectorAll(".issue-row.static")).toHaveLength(1);
    expect(document.querySelectorAll(".card.flush .rows .issue-row")).toHaveLength(2);
    expect(screen.getByText("Waited on by")).toBeInTheDocument();
  });

  it("the top of an issue's page and its description are one card, and the row stays static", async () => {
    at("/a/hub-1/backlogs/issue/1", <IssuePage client={client} />, "/a/:agencyId/backlogs/issue/:issueId");
    await screen.findByText("Waits on");
    const row = document.querySelector(".issue-row.static") as HTMLElement;
    const card = row.closest("section") as HTMLElement;
    expect(card).toHaveClass("card");
    expect(card.querySelector(".issue-description")).toHaveTextContent("Text");
    expect(document.querySelectorAll("section.card")).toHaveLength(5);
    expect(row.closest("a, button")).toBeNull();
    expect(row.querySelector("a, button")).toBeNull();
  });
});
