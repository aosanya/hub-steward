import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionOptions } from "./QuestionOptions";
import type { Question } from "./types";

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
    { text: "Swahili first", recommended: false, reason: "Most members read Swahili." },
  ],
};

describe("the options of a question", () => {
  it("lists every option with its reason and marks only the recommended one", () => {
    render(<QuestionOptions question={question} canAnswer onAnswer={vi.fn()} />);
    expect(screen.getByText("The template is written in English.")).toBeInTheDocument();
    expect(screen.getByText("Most members read Swahili.")).toBeInTheDocument();
    expect(screen.getAllByText("Recommended")).toHaveLength(1);
    expect(screen.getByText("Choosing an answer closes the question. No decision is recorded.")).toBeInTheDocument();
  });

  it("answers by the index of the option tapped", () => {
    const onAnswer = vi.fn(async () => undefined);
    render(<QuestionOptions question={question} canAnswer onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /Swahili first/ }));
    expect(onAnswer).toHaveBeenCalledWith({ option: 1 });
  });

  it("opens a box under Other and sends the typed words, never an empty answer", () => {
    const onAnswer = vi.fn(async () => undefined);
    render(<QuestionOptions question={question} canAnswer onAnswer={onAnswer} />);
    expect(screen.queryByLabelText("Your own answer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    const send = screen.getByRole("button", { name: "Send answer" });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Your own answer"), { target: { value: "  Ask the council  " } });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(onAnswer).toHaveBeenCalledWith({ other: "Ask the council" });
  });

  it("shows the options read only, naming the role, to someone who does not hold it", () => {
    const onAnswer = vi.fn();
    render(<QuestionOptions question={question} canAnswer={false} onAnswer={onAnswer} />);
    expect(screen.getByText("English first")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /English first/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Other" })).toBeNull();
    expect(screen.getByText("Only Product owner can answer this question.")).toBeInTheDocument();
  });

  it("shows the words that closed an answered question and no options", () => {
    render(<QuestionOptions question={{ ...question, status: "answered", answer: "English first" }} canAnswer onAnswer={vi.fn()} />);
    expect(screen.getByText("Answered: English first")).toBeInTheDocument();
    expect(screen.queryByText("Swahili first")).toBeNull();
    expect(screen.queryByRole("button", { name: "Other" })).toBeNull();
  });

  it("says the answer was not saved when sending fails, and keeps the options to try again", async () => {
    const onAnswer = vi.fn(async () => Promise.reject(new Error("refused")));
    render(<QuestionOptions question={question} canAnswer onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /English first/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The answer was not saved. Try again.");
    expect(screen.getByRole("button", { name: /English first/ })).toBeEnabled();
  });
});
