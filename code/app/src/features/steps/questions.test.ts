import { formQuestionsOf, answersOf, unsendable } from "./questions";

const questions = formQuestionsOf({
  questions: [
    { prompt: "Reason", answerType: "free_text", helper: "In a few words", required: true },
    { prompt: "How soon", answerType: "single_choice", helper: "", options: ["Same day", "This week"] },
    { prompt: "Visits", answerType: "number", helper: "" },
    { prompt: "Transport", answerType: "yes_no", helper: "" },
    { prompt: "Visit date", answerType: "date", helper: "" },
    { prompt: "Photo", answerType: "photo", helper: "" },
    { prompt: "Note", answerType: "free_text", helper: "" },
  ],
});

describe("a step's questions as form questions", () => {
  it("numbers them by place, keeps the prompt and type, and takes required only when the step says so", () => {
    expect(questions[0]).toMatchObject({ id: "0", prompt: "Reason", answer_type: "free_text", required: true, helper: "In a few words", options: [] });
    expect(questions[1]).toMatchObject({ id: "1", prompt: "How soon", answer_type: "single_choice", required: false, options: [{ id: "Same day", label: "Same day" }, { id: "This week", label: "This week" }] });
    expect(questions[1].helper).toBeUndefined();
  });

  it("calls a photo or file question unsendable from here", () => {
    expect(questions.map(unsendable)).toEqual([false, false, false, false, false, true, false]);
  });
});

describe("the answers sent, keyed by prompt, every value a string", () => {
  it("sends a number as its digits, yes or no as yes or no, a date as it is and a choice by its label, and leaves out what was not answered and what cannot be sent", () => {
    const draft = {
      "0": { text: " Needs a clinic check ", options: [] },
      "1": { text: "", options: ["Same day"] },
      "2": { text: "3", options: [] },
      "3": { text: "yes", options: [] },
      "4": { text: "2026-11-06", options: [] },
      "5": { text: "", options: [], files: ["x.png"] },
    };
    expect(answersOf(questions, draft)).toEqual({
      Reason: "Needs a clinic check",
      "How soon": "Same day",
      Visits: "3",
      Transport: "yes",
      "Visit date": "2026-11-06",
    });
  });
});
