import { render, screen } from "@testing-library/react";
import type { FormQuestion } from "./api";
import { QuestionInput } from "./QuestionInput";
import { toAnswer } from "./answers";

const question = (answer_type: string): FormQuestion => ({ id: "q1", prompt: "Amount awarded", answer_type, required: true, options: [] });

const shownFor = (q: FormQuestion, text = "") =>
  render(<QuestionInput q={q} value={{ text, options: [] }} onChange={() => {}} />);

describe("currency question", () => {
  it("shows Ft after the input", () => {
    const { container } = shownFor(question("currency"));
    const unit = screen.getByText("Ft");
    const input = container.querySelector("input")!;
    expect(input.compareDocumentPosition(unit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no Ft for a number question", () => {
    shownFor(question("number"));
    expect(screen.queryByText("Ft")).not.toBeInTheDocument();
  });

  it("sends 4800000 as value_number", () => {
    const q = question("currency");
    expect(toAnswer(q, { q1: { text: "4800000", options: [] } })).toEqual({ question_id: "q1", value_number: 4800000 });
  });
});
