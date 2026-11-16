import { render, screen } from "@testing-library/react";
import type { FormQuestion } from "./api";
import { QuestionInput } from "./QuestionInput";

const helper = "Only if the change carries a cost, for example 4 800 000 Ft";

const question = (answer_type: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id: "q1",
  prompt: "Amount awarded",
  answer_type,
  required: true,
  options: [],
  ...extra,
});

const choices = [
  { id: "a", label: "Road" },
  { id: "b", label: "Bridge" },
];

const shownFor = (q: FormQuestion) => render(<QuestionInput q={q} value={{ text: "", options: [] }} onChange={() => {}} />);

describe("question helper", () => {
  it("shows under a free text question", () => {
    shownFor(question("free_text", { helper }));
    expect(screen.getByText(helper)).toBeInTheDocument();
  });

  it("shows under a single choice question", () => {
    shownFor(question("single_choice", { helper, options: choices }));
    expect(screen.getByText(helper)).toBeInTheDocument();
  });

  it("shows under a currency question", () => {
    shownFor(question("currency", { helper }));
    expect(screen.getByText(helper)).toBeInTheDocument();
  });

  it("shows under a yes or no question", () => {
    shownFor(question("yes_no", { helper }));
    expect(screen.getByText(helper)).toBeInTheDocument();
  });

  it("shows no helper text when the question has none", () => {
    const { container } = shownFor(question("free_text"));
    expect(screen.queryByText(helper)).not.toBeInTheDocument();
    expect(container.querySelector("p.meta")).toBeNull();
  });
});
