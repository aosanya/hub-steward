import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionAnswers } from "./QuestionAnswers";
import { QuestionsList } from "./QuestionsList";
import type { Question, QuestionsClient } from "./types";

afterEach(cleanup);

const question = (code: string, over: Partial<Question> = {}): Question => ({
  id: code,
  code,
  title: `Title of ${code}`,
  body: "",
  priority: "P1",
  status: "open",
  targetRole: "Product owner",
  answer: "",
  tags: [],
  options: [
    { text: `Yes for ${code}`, recommended: true, reason: "It teaches faster." },
    { text: `No for ${code}`, recommended: false, reason: "" },
  ],
  ...over,
});

const clientOf = (over: Partial<QuestionsClient> = {}): QuestionsClient => ({
  forIssue: vi.fn(async () => []),
  read: vi.fn(async (code: string) => question(code)),
  list: vi.fn(async () => [question("Q-1"), question("Q-2", { targetRole: "Council" })]),
  answer: vi.fn(async () => undefined),
  standing: async () => ({ holds: (role: string) => role === "Product owner", nameOf: (role: string) => role, canAsk: true }),
  ...over,
});

describe("the answers of one question page", () => {
  it("shows the options of the question and answers by index, then shows the closing words", async () => {
    const client = clientOf();
    const onAnswered = vi.fn();
    render(<QuestionAnswers code="Q-1" client={client} onAnswered={onAnswered} />);
    fireEvent.click(await screen.findByRole("button", { name: /No for Q-1/ }));
    expect(client.answer).toHaveBeenCalledWith("Q-1", { option: 1 });
    expect(await screen.findByText("Answered: No for Q-1")).toBeInTheDocument();
    await waitFor(() => expect(onAnswered).toHaveBeenCalled());
  });

  it("shows nothing for a question that carries no options and no answer", async () => {
    const client = clientOf({ read: vi.fn(async () => question("Q-1", { options: [] })) });
    const { container } = render(<QuestionAnswers code="Q-1" client={client} onAnswered={vi.fn()} />);
    await waitFor(() => expect(client.read).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("reads the options only when the viewer does not hold the role", async () => {
    render(<QuestionAnswers code="Q-1" client={clientOf({ standing: async () => ({ holds: () => false, nameOf: (role: string) => role, canAsk: true }) })} onAnswered={vi.fn()} />);
    expect(await screen.findByText("Yes for Q-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yes for Q-1/ })).toBeNull();
  });
});

describe("the Questions tab", () => {
  const open = (client: QuestionsClient, statuses = ["open"]) =>
    render(
      <MemoryRouter>
        <QuestionsList backlogId="b1" statuses={statuses} client={client} state={{}} />
      </MemoryRouter>,
    );

  it("lists each open question with its role and its options, so it can be answered without opening it", async () => {
    const client = clientOf();
    open(client);
    expect(await screen.findByText("Title of Q-1")).toBeInTheDocument();
    expect(client.list).toHaveBeenCalledWith("b1", ["open"]);
    expect(screen.getByText("For: Product owner")).toBeInTheDocument();
    expect(screen.getByText("For: Council")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Yes for Q-1/ })).toBeInTheDocument();
  });

  it("greys out the options of a question for a role the viewer does not hold, and says who can answer", async () => {
    open(clientOf());
    await screen.findByText("Title of Q-2");
    expect(screen.queryByRole("button", { name: /Yes for Q-2/ })).toBeNull();
    expect(screen.getByText("Only Council can answer this question.")).toBeInTheDocument();
  });

  it("answers from the list and shows the closing words under that question", async () => {
    const client = clientOf();
    open(client);
    fireEvent.click(await screen.findByRole("button", { name: /Yes for Q-1/ }));
    expect(client.answer).toHaveBeenCalledWith("Q-1", { option: 0 });
    expect(await screen.findByText("Answered: Yes for Q-1")).toBeInTheDocument();
  });

  it("links the title to the question page", async () => {
    open(clientOf());
    const link = await screen.findByRole("link", { name: /Title of Q-1/ });
    expect(link.getAttribute("href")).toContain("Q-1");
  });
});
