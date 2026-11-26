import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../../../shared/wakala/openAgency";
import { IssuePage } from "../issue/IssuePage";
import type { BacklogsClient, IssueDetail, NotesClient } from "../shared/api";
import { IssueQuestions } from "./IssueQuestions";
import type { Question, QuestionsClient } from "./types";

afterEach(cleanup);

const question: Question = {
  id: "q1",
  code: "Q-14",
  title: "Which language should the imported agency open in?",
  body: "",
  priority: "P1",
  status: "open",
  targetRole: "Product owner",
  answer: "",
  tags: [],
  options: [
    { text: "English first", recommended: true, reason: "The template is written in English." },
    { text: "Swahili first", recommended: false, reason: "" },
  ],
};

const clientOf = (over: Partial<QuestionsClient> = {}): QuestionsClient => ({
  forIssue: vi.fn(async () => [question]),
  answer: vi.fn(async () => undefined),
  standing: async () => ({ holds: (role: string) => role === "Product owner" }),
  ...over,
});

describe("the Questions section of an issue", () => {
  it("shows each open question with its code, priority, role, text and options", async () => {
    render(<IssueQuestions issueId="1" client={clientOf()} />);
    expect(await screen.findByText("Which language should the imported agency open in?")).toBeInTheDocument();
    expect(screen.getByText("Q-14")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("For: Product owner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /English first/ })).toBeInTheDocument();
  });

  it("shows nothing when the issue has no open question", async () => {
    const client = clientOf({ forIssue: vi.fn(async () => []) });
    const { container } = render(<IssueQuestions issueId="1" client={client} />);
    await waitFor(() => expect(client.forIssue).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("answers by option, sends the index, and shows the closing words without moving the issue", async () => {
    const client = clientOf();
    render(<IssueQuestions issueId="1" client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: /Swahili first/ }));
    expect(client.answer).toHaveBeenCalledWith("Q-14", { option: 1 });
    expect(await screen.findByText("Answered: Swahili first")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /English first/ })).toBeNull();
  });

  it("answers with Other and shows the typed words", async () => {
    const client = clientOf();
    render(<IssueQuestions issueId="1" client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Other" }));
    fireEvent.change(screen.getByLabelText("Your own answer"), { target: { value: "Ask the council" } });
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
    expect(client.answer).toHaveBeenCalledWith("Q-14", { other: "Ask the council" });
    expect(await screen.findByText("Answered: Ask the council")).toBeInTheDocument();
  });

  it("reads the options only for someone who does not hold the targeted role", async () => {
    render(<IssueQuestions issueId="1" client={clientOf({ standing: async () => ({ holds: () => false }) })} />);
    expect(await screen.findByText("English first")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /English first/ })).toBeNull();
    expect(screen.getByText("Only Product owner can answer this question.")).toBeInTheDocument();
  });

  it("says the questions could not be loaded when the read fails", async () => {
    render(<IssueQuestions issueId="1" client={clientOf({ forIssue: vi.fn(async () => Promise.reject(new Error("down"))) })} />);
    expect(await screen.findByText("The questions could not be loaded.")).toBeInTheDocument();
  });
});

const detail: IssueDetail = {
  id: "1",
  code: "HS-2",
  title: "Load the template",
  description: "Load it.",
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

describe("the issue page", () => {
  it("carries the Questions section between Details and Description", async () => {
    openAgency({ id: "hub-1", name: "Hub" } as never);
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={backlogs} notesClient={notes} questionsClient={clientOf()} />} />
        </Routes>
      </MemoryRouter>,
    );
    const heading = await screen.findByText("Questions");
    const details = screen.getByText("Details");
    const description = screen.getByText("Description");
    expect(details.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
