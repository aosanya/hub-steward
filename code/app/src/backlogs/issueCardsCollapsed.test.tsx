import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { openAgency } from "../agency/open";
import { IssuePage } from "./IssuePage";
import type { BacklogsClient, Issue, IssueDetail, NotesClient } from "./api";
import type { ReferencesClient, RepoClient } from "./references/api";

const issue = (id: string, title: string): Issue => ({
  id,
  title,
  description: "Text",
  status: "pending",
  step: "To do",
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "",
  rank: 1,
});

const first = issue("1", "DEV-009 Create the tables");
const second = issue("2", "DEV-010 Fix the route");
const details: Record<string, IssueDetail> = {
  "1": { ...first, waitsOn: [second], waitedOnBy: [] },
  "2": { ...second, waitsOn: [], waitedOnBy: [first] },
};

const client: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue: async (id) => details[id] };
const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };
const references: ReferencesClient = {
  list: async () => [],
  add: async () => Promise.reject(new Error("unused")),
  remove: async () => undefined,
  confirm: async () => undefined,
  findIssue: async () => null,
};
const repos: RepoClient = { repos: async () => [], entries: async () => null };

const draw = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} notesClient={notes} referencesClient={references} repoClient={repos} />} />
      </Routes>
    </MemoryRouter>,
  );

const head = (name: string) => screen.getByRole("button", { name });

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

describe("the References and Log cards of an issue's page", () => {
  it("start collapsed", async () => {
    draw("/a/hub-1/backlogs/issue/1");
    await screen.findByText("Waits on");
    expect(head("References")).toHaveAttribute("aria-expanded", "false");
    expect(head("Log")).toHaveAttribute("aria-expanded", "false");
  });

  it("open for the visit only: another issue and the way back find both collapsed", async () => {
    draw("/a/hub-1/backlogs/issue/1");
    await screen.findByText("Waits on");
    await userEvent.click(head("Log"));
    await userEvent.click(head("References"));
    expect(head("Log")).toHaveAttribute("aria-expanded", "true");
    expect(head("References")).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(screen.getByText("DEV-010"));
    await screen.findByText("Waited on by");
    expect(head("Log")).toHaveAttribute("aria-expanded", "false");
    expect(head("References")).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(head("Log"));
    await userEvent.click(screen.getByText("DEV-009"));
    await screen.findByText("Waits on");
    expect(head("Log")).toHaveAttribute("aria-expanded", "false");
    expect(head("References")).toHaveAttribute("aria-expanded", "false");
  });
});
