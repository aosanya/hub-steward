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
  read: vi.fn(async () => question),
  list: vi.fn(async () => [question]),
  answer: vi.fn(async () => undefined),
  standing: async () => ({ holds: (role: string) => role === "Product owner", nameOf: (role: string) => role, canAsk: true }),
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

  it("still shows the Questions card with its empty line when the issue has no open question, and no Ask button when the client cannot ask", async () => {
    const client = clientOf({ forIssue: vi.fn(async () => []) });
    render(<IssueQuestions issueId="1" client={client} />);
    expect(await screen.findByText("Questions")).toBeInTheDocument();
    expect(screen.getByText("No open questions on this issue.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask a question" })).toBeNull();
  });

  it("shows nothing while the questions load", () => {
    const { container } = render(<IssueQuestions issueId="1" client={clientOf({ forIssue: () => new Promise(() => undefined) })} />);
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
    render(<IssueQuestions issueId="1" client={clientOf({ standing: async () => ({ holds: () => false, nameOf: (role: string) => role, canAsk: true }) })} />);
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

describe("asking a question from the issue page", () => {
  const roles = [{ id: "r1", code: "product-owner", name: "Product owner" }];
  const asking = (over: Partial<QuestionsClient> = {}) =>
    clientOf({ roles: vi.fn(async () => roles), ask: vi.fn(async () => "Q-21"), standing: async () => ({ holds: () => true, nameOf: (role: string) => (role === "product-owner" ? "Product owner" : role), canAsk: true }), ...over });

  it("shows the empty card with its one Ask a question button when the issue has no question yet", async () => {
    render(<IssueQuestions issueId="1" tags={["hub-steward"]} client={asking({ forIssue: vi.fn(async () => []) })} />);
    expect(await screen.findByText("No open questions on this issue.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ask a question" })).toHaveLength(1);
  });

  it("puts the Ask a question button after the questions and the count in the title", async () => {
    render(<IssueQuestions issueId="1" client={asking()} />);
    const ask = await screen.findByRole("button", { name: "Ask a question" });
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("English first").compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the Ask button off for a reader who may not write rules, and the questions and options still readable", async () => {
    render(<IssueQuestions issueId="1" client={asking({ standing: async () => ({ holds: () => false, nameOf: (role: string) => role, canAsk: false }) })} />);
    expect(await screen.findByRole("button", { name: "Ask a question" })).toBeDisabled();
    expect(screen.getByText("English first")).toBeInTheDocument();
  });

  it("keeps the section on screen while it reads the questions again after asking", async () => {
    let reads = 0;
    const client = asking({ forIssue: vi.fn(async () => { reads += 1; return reads === 1 ? [] : new Promise<Question[]>(() => undefined); }) });
    render(<IssueQuestions issueId="1" tags={[]} client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask a question" }));
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Which?" } });
    fireEvent.click(await screen.findByRole("radio", { name: "Product owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(client.forIssue).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Questions")).toBeInTheDocument();
  });

  it("opens the form, files the question with the issue's tags, then reads the questions again", async () => {
    const client = asking();
    render(<IssueQuestions issueId="1" tags={["hub-steward"]} client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask a question" }));
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Which language?" } });
    fireEvent.click(await screen.findByRole("radio", { name: "Product owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(client.ask).toHaveBeenCalledWith(expect.objectContaining({ issueId: "1", tags: ["hub-steward"], targetRole: "product-owner" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(vi.mocked(client.forIssue).mock.calls.length).toBeGreaterThan(1);
  });

  it("shows the role's name where the question was stored with its code", async () => {
    const stored = { ...question, targetRole: "product-owner" };
    render(<IssueQuestions issueId="1" client={asking({ forIssue: vi.fn(async () => [stored]), standing: async () => ({ holds: () => false, nameOf: () => "Product owner", canAsk: true }) })} />);
    expect(await screen.findByText("For: Product owner")).toBeInTheDocument();
    expect(screen.getByText("Only Product owner can answer this question.")).toBeInTheDocument();
    expect(screen.queryByText(/product-owner/)).toBeNull();
  });

  it("offers no Ask button when the client cannot ask", async () => {
    render(<IssueQuestions issueId="1" client={clientOf()} />);
    await screen.findByText("Q-14");
    expect(screen.queryByRole("button", { name: "Ask a question" })).toBeNull();
  });

  it("files a question from the issue page with the issue's own tags", async () => {
    openAgency({ id: "hub-1", name: "Hub" } as never);
    const client = clientOf({ roles: vi.fn(async () => [{ id: "r1", code: "product-owner", name: "Product owner" }]), ask: vi.fn(async () => "Q-30"), forIssue: vi.fn(async () => []) });
    const tagged: BacklogsClient = { ...backlogs, issue: async () => ({ ...detail, topics: ["hub-steward"] }) };
    render(
      <MemoryRouter initialEntries={["/a/hub-1/backlogs/issue/1"]}>
        <Routes>
          <Route path="/a/:agencyId/backlogs/issue/:issueId" element={<IssuePage client={tagged} notesClient={notes} questionsClient={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Ask a question" }));
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Which?" } });
    fireEvent.click(await screen.findByRole("radio", { name: "Product owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(client.ask).toHaveBeenCalledWith(expect.objectContaining({ tags: ["hub-steward", "Backlog"], issueId: "1" })));
  });
});
