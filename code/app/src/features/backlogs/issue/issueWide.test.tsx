import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { openAgency } from "../../../shared/wakala/openAgency";
import { IssuePage } from "./IssuePage";
import type { BacklogsClient, Issue, IssueDetail, NotesClient } from "../shared/api";
import type { QuestionsClient } from "../questions";

const issue = (id: string, title: string): Issue => ({
  id,
  title,
  description: "A description.\n\nRead from: docs/a.md",
  status: "pending",
  step: "To do",
  repo: "hub-steward",
  topics: [],
  backlog: "Backlog",
  mark: "Ready",
  rank: 1,
});

const detail: IssueDetail = { ...issue("1", "DEV-009 Create the tables"), waitsOn: [issue("2", "DEV-010 Fix the route")], waitedOnBy: [] };

const client: BacklogsClient = { backlogs: async () => [], issues: async () => [], issue: async () => detail };

const notes: NotesClient = { notes: async () => [], addNote: async () => Promise.reject(new Error("unused")) };

const questionsClient: QuestionsClient = {
  forIssue: async () => [],
  read: vi.fn(),
  list: vi.fn(),
  answer: vi.fn(),
  standing: async () => ({ holds: () => false, nameOf: (role: string) => role, canAsk: true }),
};

const css = readFileSync(resolve(__dirname, "issueWide.css"), "utf8");

const wideBlock = () => css.slice(css.indexOf("@media (min-width: 48rem)"));

beforeEach(() => openAgency({ id: "hub-1", name: "Hub" } as never));

const open = async () => {
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={client} notesClient={notes} questionsClient={questionsClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("Waits on");
};

describe("an issue's page on a wide window", () => {
  it("puts the card in one column and the sections, the source last, in another", async () => {
    await open();
    const main = document.querySelector(".issue-wide > .issue-main") as HTMLElement;
    const side = document.querySelector(".issue-wide > .issue-side") as HTMLElement;
    expect(main.querySelector(".issue-body")).toHaveTextContent("A description.");
    expect(side).toContainElement(screen.getByText("Waits on"));
    expect(side).toContainElement(screen.getByText("Log"));
    expect(side.lastElementChild).toContainElement(screen.getByText("Source"));
    expect(main).not.toContainElement(side);
  });

  it("puts the Questions card at the top of the right column on a wide window, above References", async () => {
    const wide = vi.spyOn(window, "matchMedia").mockImplementation(((query: string) => ({ matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as never);
    await open();
    const side = document.querySelector(".issue-wide > .issue-side") as HTMLElement;
    const main = document.querySelector(".issue-wide > .issue-main") as HTMLElement;
    const questions = await screen.findByText("Questions");
    expect(side).toContainElement(questions);
    expect(main).not.toContainElement(questions);
    expect(questions.compareDocumentPosition(screen.getByText("References")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    wide.mockRestore();
  });

  it("keeps the Questions card after Details in the one column of a phone", async () => {
    await open();
    const main = document.querySelector(".issue-wide > .issue-main") as HTMLElement;
    const questions = await screen.findByText("Questions");
    expect(main).toContainElement(questions);
    expect(screen.getByText("Details").compareDocumentPosition(questions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(questions.compareDocumentPosition(screen.getByText("Description")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sets the two columns only inside the 48rem block, so a phone keeps one column", () => {
    expect(css).toContain("@media (min-width: 48rem)");
    const outside = css.slice(0, css.indexOf("@media (min-width: 48rem)"));
    expect(outside).not.toContain("flex-wrap");
    expect(outside).not.toContain("max-width");
  });

  it("keeps the card to a readable width and gives the rest to the sections", () => {
    expect(wideBlock()).toMatch(/\.issue-wide\s*\{[^}]*flex-direction: row[^}]*flex-wrap: wrap/);
    expect(wideBlock()).toMatch(/\.issue-main\s*\{[^}]*flex: 1 1 24rem[^}]*max-width: 40rem/);
    expect(wideBlock()).toMatch(/\.issue-side\s*\{[^}]*flex: 1 1 18rem/);
  });
});
