import { describe, expect, it } from "vitest";
import { answersOf, fieldsOf, type Question } from "./records";

const question = (prompt: string, answer_type: string, extra: Partial<Question> = {}): Question => ({
  prompt,
  answerType: answer_type,
  required: false,
  options: [],
  ...extra,
});

describe("the fields of a record's form", () => {
  it("takes one field for each question, named by its prompt and required as the question is", () => {
    const fields = fieldsOf([question("Trading name", "free_text", { required: true }), question("Place", "free_text")]);

    expect(fields).toEqual([
      { name: "Trading name", component: "text", required: true },
      { name: "Place", component: "text", required: false },
    ]);
  });

  it("offers the options of a single choice as radios and of a multi select as chips", () => {
    const fields = fieldsOf([
      question("Status", "single_choice", { options: ["Active", "Closed"] }),
      question("Days", "multi_select", { options: ["Mon", "Tue"] }),
    ]);

    expect(fields.map((field) => [field.component, field.options])).toEqual([
      ["radios", ["Active", "Closed"]],
      ["chips", ["Mon", "Tue"]],
    ]);
  });

  it("maps numbers and currency to a number field, dates to a date field and yes or no to a toggle", () => {
    const fields = fieldsOf([question("Count", "number"), question("Fee", "currency"), question("Opened", "date"), question("Insured", "yes_no")]);

    expect(fields.map((field) => field.component)).toEqual(["number", "number", "date", "toggle"]);
  });

  it("falls back to a text field for a question type it does not know", () => {
    expect(fieldsOf([question("Opens at", "time")])[0].component).toBe("text");
  });
});

describe("the answers of a submitted form", () => {
  it("are text by prompt, a number written out, a toggle as yes or no and a missing answer empty", () => {
    const fields = fieldsOf([question("Name", "free_text"), question("Count", "number"), question("Insured", "yes_no"), question("Place", "free_text")]);

    expect(answersOf(fields, { Name: "Malomsor Bakery", Count: 12, Insured: true })).toEqual({
      Name: "Malomsor Bakery",
      Count: "12",
      Insured: "yes",
      Place: "",
    });
  });

  it("trims what was typed", () => {
    expect(answersOf(fieldsOf([question("Name", "free_text")]), { Name: "  Malomsor Bakery " })).toEqual({ Name: "Malomsor Bakery" });
  });
});
