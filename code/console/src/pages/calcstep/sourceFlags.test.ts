import { describe, expect, it } from "vitest";
import { sourceFlag, sourceKind, sourceType, type InputRow, type Source } from "./sourceFlags";

const earlierAnswer = (question: string, type: InputRow["type"], questionNow?: string): Source => ({
  kind: "step",
  step: "Apply for a loan",
  question,
  type,
  questionNow,
});

const fromRecord = (question: string, type: InputRow["type"], questionNow?: string): Source => ({
  kind: "record",
  record: "Loan terms",
  question,
  type,
  questionNow,
});

describe("the flag of an input row", () => {
  it("flags a text answer given to a currency input as the wrong type", () => {
    const row: InputRow = { name: "principal", type: "currency", source: earlierAnswer("Reason for the loan", "text") };
    expect(sourceFlag(row)).toBe("wrong-type");
  });

  it("flags an input with no source", () => {
    expect(sourceFlag({ name: "monthly_rate", type: "number", source: null })).toBe("no-source");
  });

  it("flags a fixed value that has not been typed as no source", () => {
    expect(sourceFlag({ name: "monthly_rate", type: "number", source: { kind: "fixed", value: "  " } })).toBe("no-source");
  });

  it("flags a question that is now worded differently as reworded", () => {
    const row: InputRow = { name: "months", type: "number", source: fromRecord("Months", "number", "How many months?") };
    expect(sourceFlag(row)).toBe("reworded");
  });

  it("does not flag a question whose wording is unchanged", () => {
    const row: InputRow = { name: "months", type: "number", source: fromRecord("Months", "number", "Months") };
    expect(sourceFlag(row)).toBeNull();
  });

  it("does not flag a source that fits", () => {
    expect(sourceFlag({ name: "principal", type: "currency", source: earlierAnswer("Amount requested", "currency") })).toBeNull();
    expect(sourceFlag({ name: "monthly_rate", type: "number", source: { kind: "fixed", value: "0.01" } })).toBeNull();
  });

  it("reads the member's ledger balance as a currency", () => {
    expect(sourceType({ kind: "ledger" })).toBe("currency");
    expect(sourceFlag({ name: "balance", type: "currency", source: { kind: "ledger" } })).toBeNull();
    expect(sourceFlag({ name: "months", type: "number", source: { kind: "ledger" } })).toBe("wrong-type");
  });

  it("puts a reworded question before a wrong type", () => {
    const row: InputRow = { name: "months", type: "number", source: fromRecord("Months", "text", "How many months?") };
    expect(sourceFlag(row)).toBe("reworded");
  });

  it("lets the library's own rule of fit replace the default", () => {
    const row: InputRow = { name: "months", type: "number", source: { kind: "ledger" } };
    expect(sourceFlag(row, () => true)).toBeNull();
    expect(sourceFlag({ name: "principal", type: "currency", source: earlierAnswer("Amount", "currency") }, () => false)).toBe("wrong-type");
  });

  it("names the kind of a source", () => {
    expect(sourceKind(null)).toBeNull();
    expect(sourceKind({ kind: "fixed", value: "1" })).toBe("fixed");
    expect(sourceKind(fromRecord("Months", "number"))).toBe("record");
  });
});
